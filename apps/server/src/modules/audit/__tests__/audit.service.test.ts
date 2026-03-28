import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit.service';
import { AuditAction, AuditEntry } from '../audit.types';
import { ValkeyService } from '../../valkey/valkey.service';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

/** Build a minimal AuditEntry fixture. */
function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date('2025-06-01T12:00:00.000Z').toISOString(),
    action: AuditAction.NOTE_CREATED,
    userId: 'user-1',
    workspaceId: 'ws-1',
    metadata: { noteId: 'note-abc' },
    ipAddress: '127.0.0.1',
    userAgent: 'Mozilla/5.0',
    ...overrides,
  };
}

/** Build a mock Valkey client with spies for sorted-set operations. */
function makeValkeyClient() {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrevrangebyscore: vi.fn().mockResolvedValue([]),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zrem: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue({
      zrem: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  };
}

function makeValkeyService(clientOverrides: Partial<ReturnType<typeof makeValkeyClient>> = {}) {
  const client = { ...makeValkeyClient(), ...clientOverrides };
  return {
    getClient: vi.fn().mockReturnValue(client),
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    del: vi.fn().mockResolvedValue(1),
    // Expose client for assertion access
    _client: client,
  } as unknown as ValkeyService & { _client: ReturnType<typeof makeValkeyClient> };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

function buildService(valkeyOverride?: Partial<ReturnType<typeof makeValkeyClient>>) {
  const valkey = makeValkeyService(valkeyOverride);
  const service = new AuditService(valkey);
  return { service, valkey };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuditService', () => {
  // ─── log() ─────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('writes a serialised entry to the workspace sorted-set', async () => {
      const { service, valkey } = buildService();

      await service.log(
        AuditAction.NOTE_CREATED,
        'user-1',
        'ws-1',
        { noteId: 'note-abc' },
        '1.2.3.4',
        'TestAgent/1.0',
      );

      const client = (valkey as unknown as { _client: ReturnType<typeof makeValkeyClient> })
        ._client;
      expect(client.zadd).toHaveBeenCalledOnce();
      const [key, , value] = client.zadd.mock.calls[0] as [string, number, string];
      expect(key).toBe('audit:log:ws:ws-1');
      const parsed = JSON.parse(value) as AuditEntry;
      expect(parsed.action).toBe(AuditAction.NOTE_CREATED);
      expect(parsed.userId).toBe('user-1');
      expect(parsed.ipAddress).toBe('1.2.3.4');
    });

    it('writes to global log when workspaceId is null', async () => {
      const { service, valkey } = buildService();

      await service.log(AuditAction.AUTH_LOGIN, 'user-1', null, {}, '::1', '');

      const client = (valkey as unknown as { _client: ReturnType<typeof makeValkeyClient> })
        ._client;
      const [key] = client.zadd.mock.calls[0] as [string, number, string];
      expect(key).toBe('audit:log:global');
    });

    it('does not throw when Valkey write fails (fire-and-forget)', async () => {
      const zaddFailing = vi.fn().mockRejectedValue(new Error('Valkey down'));
      const { service } = buildService({ zadd: zaddFailing });

      // Should NOT throw
      await expect(
        service.log(AuditAction.AUTH_LOGIN, 'u1', 'ws-1', {}, '', ''),
      ).resolves.toBeUndefined();
    });

    it('includes all required fields in the persisted entry', async () => {
      const { service, valkey } = buildService();

      await service.log(
        AuditAction.MEMBER_INVITED,
        'admin-1',
        'ws-99',
        { invitedEmail: 'bob@example.com' },
        '10.0.0.1',
        'curl/8.0',
      );

      const client = (valkey as unknown as { _client: ReturnType<typeof makeValkeyClient> })
        ._client;
      const [, , raw] = client.zadd.mock.calls[0] as [string, number, string];
      const entry = JSON.parse(raw) as AuditEntry;

      expect(entry).toMatchObject({
        action: AuditAction.MEMBER_INVITED,
        userId: 'admin-1',
        workspaceId: 'ws-99',
        metadata: { invitedEmail: 'bob@example.com' },
        ipAddress: '10.0.0.1',
        userAgent: 'curl/8.0',
      });
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.timestamp).toBe('string');
    });

    it('stores score as current Unix timestamp (ms)', async () => {
      const before = Date.now();
      const { service, valkey } = buildService();

      await service.log(AuditAction.AUTH_LOGIN, 'u1', 'ws-1', {}, '', '');

      const after = Date.now();
      const client = (valkey as unknown as { _client: ReturnType<typeof makeValkeyClient> })
        ._client;
      const [, score] = client.zadd.mock.calls[0] as [string, number, string];
      expect(score).toBeGreaterThanOrEqual(before);
      expect(score).toBeLessThanOrEqual(after);
    });
  });

  // ─── query() ───────────────────────────────────────────────────────────────

  describe('query()', () => {
    it('returns empty page when no entries exist', async () => {
      const { service } = buildService();
      const page = await service.query('ws-1');
      expect(page.entries).toHaveLength(0);
      expect(page.nextCursor).toBeNull();
      expect(page.total).toBe(0);
    });

    it('deserialises entries returned by Valkey', async () => {
      const entry = makeEntry();
      const rawEntries = [JSON.stringify(entry)];
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue(rawEntries);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1');
      expect(page.entries).toHaveLength(1);
      expect(page.entries[0].id).toBe(entry.id);
    });

    it('filters by userId', async () => {
      const e1 = makeEntry({ userId: 'user-1' });
      const e2 = makeEntry({ userId: 'user-2' });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(e1), JSON.stringify(e2)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', { filter: { userId: 'user-1' } });
      expect(page.entries).toHaveLength(1);
      expect(page.entries[0].userId).toBe('user-1');
    });

    it('filters by action type', async () => {
      const login = makeEntry({ action: AuditAction.AUTH_LOGIN });
      const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([
        JSON.stringify(login),
        JSON.stringify(noteCreated),
      ]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', {
        filter: { actions: [AuditAction.AUTH_LOGIN] },
      });
      expect(page.entries).toHaveLength(1);
      expect(page.entries[0].action).toBe(AuditAction.AUTH_LOGIN);
    });

    it('filters by multiple action types (OR)', async () => {
      const login = makeEntry({ action: AuditAction.AUTH_LOGIN });
      const logout = makeEntry({ action: AuditAction.AUTH_LOGOUT });
      const note = makeEntry({ action: AuditAction.NOTE_CREATED });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([
        JSON.stringify(login),
        JSON.stringify(logout),
        JSON.stringify(note),
      ]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', {
        filter: { actions: [AuditAction.AUTH_LOGIN, AuditAction.AUTH_LOGOUT] },
      });
      expect(page.entries).toHaveLength(2);
    });

    it('filters by search string (case-insensitive)', async () => {
      const e1 = makeEntry({ metadata: { noteId: 'note-ALPHA' } });
      const e2 = makeEntry({ metadata: { noteId: 'note-beta' } });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(e1), JSON.stringify(e2)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', { filter: { search: 'ALPHA' } });
      expect(page.entries).toHaveLength(1);
    });

    it('respects the limit option', async () => {
      const entries = Array.from({ length: 10 }, () => makeEntry());
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue(entries.map((e) => JSON.stringify(e)));
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', { limit: 3 });
      expect(page.entries).toHaveLength(3);
      expect(page.nextCursor).not.toBeNull();
    });

    it('returns nextCursor=null on the last page', async () => {
      const entries = Array.from({ length: 2 }, () => makeEntry());
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue(entries.map((e) => JSON.stringify(e)));
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1', { limit: 10 });
      expect(page.nextCursor).toBeNull();
    });

    it('silently skips corrupt (non-parseable) entries', async () => {
      const valid = makeEntry();
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue(['NOT_VALID_JSON{{{{', JSON.stringify(valid)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const page = await service.query('ws-1');
      expect(page.entries).toHaveLength(1);
      expect(page.entries[0].id).toBe(valid.id);
    });
  });

  // ─── exportCsv() ───────────────────────────────────────────────────────────

  describe('exportCsv()', () => {
    it('returns CSV string with header row', async () => {
      const entry = makeEntry();
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(entry)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const csv = await service.exportCsv('ws-1');
      // Headers are RFC-4180 quoted
      expect(csv).toContain('"ID","Timestamp","Action"');
      expect(csv).toContain(entry.id);
    });

    it('returns header-only CSV when no entries match', async () => {
      const { service } = buildService();
      const csv = await service.exportCsv('ws-1');
      const lines = csv.split('\r\n').filter(Boolean);
      expect(lines).toHaveLength(1); // header only
    });

    it('applies filter when exporting', async () => {
      const e1 = makeEntry({ userId: 'user-1' });
      const e2 = makeEntry({ userId: 'user-2' });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(e1), JSON.stringify(e2)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const csv = await service.exportCsv('ws-1', { userId: 'user-1' });
      const lines = csv.split('\r\n').filter(Boolean);
      expect(lines).toHaveLength(2); // header + 1 data row
      expect(csv).toContain('user-1');
      expect(csv).not.toContain('user-2');
    });
  });

  // ─── getRetentionConfig() / setRetentionConfig() ───────────────────────────

  describe('getRetentionConfig()', () => {
    it('returns defaults when no config is stored', async () => {
      const { service } = buildService();
      const config = await service.getRetentionConfig('ws-1', 'admin-1');
      expect(config.retentionDays).toBe(90);
    });

    it('returns stored config when present', async () => {
      const stored = {
        retentionDays: 180,
        updatedAt: '2025-01-01T00:00:00.000Z',
        updatedBy: 'admin-1',
      };
      const { service, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(stored));

      const config = await service.getRetentionConfig('ws-1', 'admin-1');
      expect(config.retentionDays).toBe(180);
    });
  });

  describe('setRetentionConfig()', () => {
    it('persists the new config to Valkey', async () => {
      const { service, valkey } = buildService();
      const client = (valkey as unknown as { _client: ReturnType<typeof makeValkeyClient> })
        ._client;
      // Make subsequent zadd (from the audit log call) not throw
      client.zadd.mockResolvedValue(1);

      const config = await service.setRetentionConfig('ws-1', 120, 'admin-1');

      expect(config.retentionDays).toBe(120);
      expect(config.updatedBy).toBe('admin-1');
      expect(valkey.set as ReturnType<typeof vi.fn>).toHaveBeenCalledWith(
        'audit:retention:ws-1',
        expect.stringContaining('120'),
      );
    });

    it('clamps retention to 30 days minimum', async () => {
      const { service } = buildService();
      const config = await service.setRetentionConfig('ws-1', 5, 'admin-1');
      expect(config.retentionDays).toBe(30);
    });

    it('clamps retention to 365 days maximum', async () => {
      const { service } = buildService();
      const config = await service.setRetentionConfig('ws-1', 9999, 'admin-1');
      expect(config.retentionDays).toBe(365);
    });
  });

  // ─── purgeOlderThan() ──────────────────────────────────────────────────────

  describe('purgeOlderThan()', () => {
    it('calls ZREMRANGEBYSCORE with the correct cutoff score', async () => {
      const removedCount = 42;
      const zrem = vi.fn().mockResolvedValue(removedCount);
      const { service } = buildService({ zremrangebyscore: zrem });

      const result = await service.purgeOlderThan('ws-1', 30);

      expect(result).toBe(removedCount);
      expect(zrem).toHaveBeenCalledOnce();
      const [key, min, max] = zrem.mock.calls[0] as [string, string, number];
      expect(key).toBe('audit:log:ws:ws-1');
      expect(min).toBe('-inf');
      // max should be roughly now - 30 days in ms
      const expectedCutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
      expect(Number(max)).toBeLessThanOrEqual(expectedCutoff);
    });

    it('returns 0 when Valkey fails (non-fatal)', async () => {
      const failingZrem = vi.fn().mockRejectedValue(new Error('Valkey error'));
      const { service } = buildService({ zremrangebyscore: failingZrem });
      const result = await service.purgeOlderThan('ws-1', 30);
      expect(result).toBe(0);
    });
  });

  // ─── getSubjectData() ──────────────────────────────────────────────────────

  describe('getSubjectData()', () => {
    it('returns all entries for a specific user', async () => {
      const e1 = makeEntry({ userId: 'user-gdpr' });
      const e2 = makeEntry({ userId: 'other-user' });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(e1), JSON.stringify(e2)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const data = await service.getSubjectData('user-gdpr', 'ws-1');

      expect(data.userId).toBe('user-gdpr');
      expect(data.entries).toHaveLength(1);
      expect(data.totalEntries).toBe(1);
      expect(data.entries[0].userId).toBe('user-gdpr');
    });

    it('returns empty result for unknown user', async () => {
      const { service } = buildService();
      const data = await service.getSubjectData('no-such-user', 'ws-1');
      expect(data.entries).toHaveLength(0);
      expect(data.totalEntries).toBe(0);
    });
  });

  // ─── anonymizeUser() ───────────────────────────────────────────────────────

  describe('anonymizeUser()', () => {
    it('replaces userId, ipAddress, userAgent with sentinel for matching entries', async () => {
      const target = makeEntry({
        userId: 'user-target',
        ipAddress: '1.2.3.4',
        userAgent: 'Mozilla',
      });
      const other = makeEntry({ userId: 'user-other' });

      const capturedInserts: string[] = [];
      const pipelineMock = {
        zrem: vi.fn().mockReturnThis(),
        zadd: vi.fn((key: string, score: number, value: string) => {
          capturedInserts.push(value);
          return pipelineMock;
        }),
        exec: vi.fn().mockResolvedValue([]),
      };
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(target), JSON.stringify(other)]);
      client.pipeline.mockReturnValue(pipelineMock);

      const valkey = makeValkeyService({
        zrevrangebyscore: client.zrevrangebyscore,
        pipeline: client.pipeline,
      });
      const service = new AuditService(valkey);

      const count = await service.anonymizeUser('user-target', 'ws-1');

      expect(count).toBe(1);
      expect(capturedInserts).toHaveLength(1);
      const anonymised = JSON.parse(capturedInserts[0]) as AuditEntry;
      expect(anonymised.userId).toBe('[deleted]');
      expect(anonymised.ipAddress).toBe('[deleted]');
      expect(anonymised.userAgent).toBe('[deleted]');
    });

    it('returns 0 when user has no entries', async () => {
      const other = makeEntry({ userId: 'different-user' });
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(other)]);
      const valkey = makeValkeyService({ zrevrangebyscore: client.zrevrangebyscore });
      const service = new AuditService(valkey);

      const count = await service.anonymizeUser('ghost-user', 'ws-1');
      expect(count).toBe(0);
    });

    it('redacts PII keys from metadata', async () => {
      const entry = makeEntry({
        userId: 'user-pii',
        metadata: { email: 'alice@example.com', noteId: 'note-123' },
      });
      const capturedInserts: string[] = [];
      const pipelineMock = {
        zrem: vi.fn().mockReturnThis(),
        zadd: vi.fn((_k: string, _s: number, v: string) => {
          capturedInserts.push(v);
          return pipelineMock;
        }),
        exec: vi.fn().mockResolvedValue([]),
      };
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(entry)]);
      client.pipeline.mockReturnValue(pipelineMock);
      const valkey = makeValkeyService({
        zrevrangebyscore: client.zrevrangebyscore,
        pipeline: client.pipeline,
      });
      const service = new AuditService(valkey);

      await service.anonymizeUser('user-pii', 'ws-1');

      const anonymised = JSON.parse(capturedInserts[0]) as AuditEntry;
      expect(anonymised.metadata['email']).toBe('[deleted]');
      // Non-PII fields are preserved
      expect(anonymised.metadata['noteId']).toBe('note-123');
    });

    it('preserves non-target user entries unchanged', async () => {
      const target = makeEntry({ userId: 'user-target' });
      const bystander = makeEntry({ userId: 'user-bystander' });

      const pipelineMock = {
        zrem: vi.fn().mockReturnThis(),
        zadd: vi.fn().mockReturnThis(),
        exec: vi.fn().mockResolvedValue([]),
      };
      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([
        JSON.stringify(target),
        JSON.stringify(bystander),
      ]);
      client.pipeline.mockReturnValue(pipelineMock);
      const valkey = makeValkeyService({
        zrevrangebyscore: client.zrevrangebyscore,
        pipeline: client.pipeline,
      });
      const service = new AuditService(valkey);

      await service.anonymizeUser('user-target', 'ws-1');

      // Only the target entry should be in the zrem/zadd pipeline
      const zremCalls = pipelineMock.zrem.mock.calls as unknown[][];
      expect(zremCalls).toHaveLength(1);
    });
  });

  // ─── AuditAction enum coverage ─────────────────────────────────────────────

  describe('AuditAction enum', () => {
    it('contains at least 30 action types', () => {
      const count = Object.keys(AuditAction).length;
      expect(count).toBeGreaterThanOrEqual(30);
    });

    it('covers auth domain actions', () => {
      expect(AuditAction.AUTH_LOGIN).toBeDefined();
      expect(AuditAction.AUTH_LOGOUT).toBeDefined();
      expect(AuditAction.AUTH_PASSWORD_CHANGED).toBeDefined();
      expect(AuditAction.AUTH_TOTP_ENABLED).toBeDefined();
    });

    it('covers note domain actions', () => {
      expect(AuditAction.NOTE_CREATED).toBeDefined();
      expect(AuditAction.NOTE_DELETED).toBeDefined();
      expect(AuditAction.NOTE_PUBLISHED).toBeDefined();
    });

    it('covers GDPR actions', () => {
      expect(AuditAction.GDPR_DATA_REQUESTED).toBeDefined();
      expect(AuditAction.GDPR_DATA_DELETED).toBeDefined();
    });

    it('covers plugin actions', () => {
      expect(AuditAction.PLUGIN_INSTALLED).toBeDefined();
      expect(AuditAction.PLUGIN_REMOVED).toBeDefined();
    });
  });
});
