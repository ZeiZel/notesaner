/**
 * audit-workspace-admin.test.ts
 *
 * Unit tests for the workspace-admin audit enhancements:
 *   - New AuditAction values (STORAGE_QUOTA_CHANGED, API_KEY_CREATED, API_KEY_REVOKED)
 *   - AuditActionGroup enum and AUDIT_ACTION_GROUP_MAP
 *   - actionGroup filter in AuditService (resolves to action list, lower priority than actions)
 *   - AuditQueryDto accepts actionGroup as a valid enum value
 */

import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'crypto';
import { AuditService } from '../audit.service';
import { AUDIT_ACTION_GROUP_MAP, AuditAction, AuditActionGroup, AuditEntry } from '../audit.types';
import { ValkeyService } from '../../valkey/valkey.service';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { AuditQueryDto } from '../dto/audit-query.dto';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: randomUUID(),
    timestamp: new Date('2025-09-01T10:00:00.000Z').toISOString(),
    action: AuditAction.NOTE_CREATED,
    userId: 'user-1',
    workspaceId: 'ws-1',
    metadata: {},
    ipAddress: '127.0.0.1',
    userAgent: 'TestAgent/1.0',
    ...overrides,
  };
}

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function makeValkeyClient(rawEntries: string[] = []) {
  return {
    zadd: vi.fn().mockResolvedValue(1),
    zrevrangebyscore: vi.fn().mockResolvedValue(rawEntries),
    zremrangebyscore: vi.fn().mockResolvedValue(0),
    zrem: vi.fn().mockResolvedValue(1),
    pipeline: vi.fn().mockReturnValue({
      zrem: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    }),
  };
}

function makeValkeyService(rawEntries: string[] = []) {
  const client = makeValkeyClient(rawEntries);
  return {
    service: {
      getClient: vi.fn().mockReturnValue(client),
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(1),
    } as unknown as ValkeyService,
    client,
  };
}

// ─── AuditAction enum — new workspace-admin actions ──────────────────────────

describe('AuditAction — workspace admin additions', () => {
  it('has STORAGE_QUOTA_CHANGED', () => {
    expect(AuditAction.STORAGE_QUOTA_CHANGED).toBe('storage.quota_changed');
  });

  it('has API_KEY_CREATED', () => {
    expect(AuditAction.API_KEY_CREATED).toBe('api_key.created');
  });

  it('has API_KEY_REVOKED', () => {
    expect(AuditAction.API_KEY_REVOKED).toBe('api_key.revoked');
  });

  it('has API_KEY_ROTATED', () => {
    expect(AuditAction.API_KEY_ROTATED).toBe('api_key.rotated');
  });

  it('total action count is at least 34 after additions', () => {
    expect(Object.keys(AuditAction).length).toBeGreaterThanOrEqual(34);
  });
});

// ─── AuditActionGroup ─────────────────────────────────────────────────────────

describe('AuditActionGroup', () => {
  it('defines all expected groups', () => {
    expect(AuditActionGroup.AUTH).toBe('auth');
    expect(AuditActionGroup.NOTES).toBe('notes');
    expect(AuditActionGroup.MEMBERS).toBe('members');
    expect(AuditActionGroup.WORKSPACE_SETTINGS).toBe('workspace_settings');
    expect(AuditActionGroup.STORAGE).toBe('storage');
    expect(AuditActionGroup.API_KEYS).toBe('api_keys');
    expect(AuditActionGroup.PLUGINS).toBe('plugins');
    expect(AuditActionGroup.ADMIN).toBe('admin');
  });
});

// ─── AUDIT_ACTION_GROUP_MAP completeness ─────────────────────────────────────

describe('AUDIT_ACTION_GROUP_MAP', () => {
  it('has an entry for every AuditActionGroup value', () => {
    for (const group of Object.values(AuditActionGroup)) {
      expect(AUDIT_ACTION_GROUP_MAP[group]).toBeDefined();
      expect(Array.isArray(AUDIT_ACTION_GROUP_MAP[group])).toBe(true);
      expect(AUDIT_ACTION_GROUP_MAP[group].length).toBeGreaterThan(0);
    }
  });

  it('MEMBERS group contains all member management actions', () => {
    const members = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.MEMBERS];
    expect(members).toContain(AuditAction.MEMBER_INVITED);
    expect(members).toContain(AuditAction.MEMBER_REMOVED);
    expect(members).toContain(AuditAction.MEMBER_ROLE_CHANGED);
    expect(members).toContain(AuditAction.MEMBER_JOINED);
  });

  it('WORKSPACE_SETTINGS group contains workspace lifecycle and settings actions', () => {
    const wsSettings = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.WORKSPACE_SETTINGS];
    expect(wsSettings).toContain(AuditAction.WORKSPACE_CREATED);
    expect(wsSettings).toContain(AuditAction.WORKSPACE_UPDATED);
    expect(wsSettings).toContain(AuditAction.WORKSPACE_DELETED);
    expect(wsSettings).toContain(AuditAction.SETTINGS_CHANGED);
  });

  it('STORAGE group contains STORAGE_QUOTA_CHANGED', () => {
    const storage = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.STORAGE];
    expect(storage).toContain(AuditAction.STORAGE_QUOTA_CHANGED);
  });

  it('API_KEYS group contains API_KEY_CREATED, API_KEY_REVOKED, and API_KEY_ROTATED', () => {
    const apiKeys = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.API_KEYS];
    expect(apiKeys).toContain(AuditAction.API_KEY_CREATED);
    expect(apiKeys).toContain(AuditAction.API_KEY_REVOKED);
    expect(apiKeys).toContain(AuditAction.API_KEY_ROTATED);
  });

  it('AUTH group contains all auth actions', () => {
    const auth = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.AUTH];
    expect(auth).toContain(AuditAction.AUTH_LOGIN);
    expect(auth).toContain(AuditAction.AUTH_LOGOUT);
    expect(auth).toContain(AuditAction.AUTH_PASSWORD_CHANGED);
    expect(auth).toContain(AuditAction.AUTH_TOTP_ENABLED);
  });

  it('PLUGINS group contains all plugin actions', () => {
    const plugins = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.PLUGINS];
    expect(plugins).toContain(AuditAction.PLUGIN_INSTALLED);
    expect(plugins).toContain(AuditAction.PLUGIN_REMOVED);
    expect(plugins).toContain(AuditAction.PLUGIN_ENABLED);
    expect(plugins).toContain(AuditAction.PLUGIN_DISABLED);
    expect(plugins).toContain(AuditAction.PLUGIN_SETTINGS_CHANGED);
  });

  it('ADMIN group contains GDPR and audit log actions', () => {
    const admin = AUDIT_ACTION_GROUP_MAP[AuditActionGroup.ADMIN];
    expect(admin).toContain(AuditAction.AUDIT_LOG_EXPORTED);
    expect(admin).toContain(AuditAction.AUDIT_RETENTION_CHANGED);
    expect(admin).toContain(AuditAction.GDPR_DATA_REQUESTED);
    expect(admin).toContain(AuditAction.GDPR_DATA_DELETED);
  });

  it('no action appears in more than one group (no duplicates across groups)', () => {
    const seen = new Set<AuditAction>();
    const duplicates: AuditAction[] = [];

    for (const [, actions] of Object.entries(AUDIT_ACTION_GROUP_MAP)) {
      for (const action of actions) {
        if (seen.has(action)) {
          duplicates.push(action);
        }
        seen.add(action);
      }
    }

    expect(duplicates).toHaveLength(0);
  });

  it('all actions in the group map are valid AuditAction values', () => {
    const validActions = new Set(Object.values(AuditAction));
    for (const [, actions] of Object.entries(AUDIT_ACTION_GROUP_MAP)) {
      for (const action of actions) {
        expect(validActions.has(action)).toBe(true);
      }
    }
  });
});

// ─── AuditService — actionGroup filter ───────────────────────────────────────

describe('AuditService — actionGroup filter', () => {
  it('filters entries by actionGroup when no actions array is given', async () => {
    const memberInvited = makeEntry({ action: AuditAction.MEMBER_INVITED });
    const memberRemoved = makeEntry({ action: AuditAction.MEMBER_REMOVED });
    const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED });
    const authLogin = makeEntry({ action: AuditAction.AUTH_LOGIN });

    const { service } = makeValkeyService(
      [memberInvited, memberRemoved, noteCreated, authLogin].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.MEMBERS },
    });

    expect(page.entries).toHaveLength(2);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.MEMBER_INVITED);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.MEMBER_REMOVED);
  });

  it('uses actions array over actionGroup when both are provided', async () => {
    const memberInvited = makeEntry({ action: AuditAction.MEMBER_INVITED });
    const apiKeyCreated = makeEntry({ action: AuditAction.API_KEY_CREATED });
    const authLogin = makeEntry({ action: AuditAction.AUTH_LOGIN });

    const { service } = makeValkeyService(
      [memberInvited, apiKeyCreated, authLogin].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    // actions=[API_KEY_CREATED] should override actionGroup=MEMBERS
    const page = await auditService.query('ws-1', {
      filter: {
        actions: [AuditAction.API_KEY_CREATED],
        actionGroup: AuditActionGroup.MEMBERS,
      },
    });

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].action).toBe(AuditAction.API_KEY_CREATED);
  });

  it('filters STORAGE group — returns STORAGE_QUOTA_CHANGED entries', async () => {
    const quotaChanged = makeEntry({ action: AuditAction.STORAGE_QUOTA_CHANGED });
    const fileUploaded = makeEntry({ action: AuditAction.FILE_UPLOADED });
    const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED });

    const { service } = makeValkeyService(
      [quotaChanged, fileUploaded, noteCreated].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.STORAGE },
    });

    expect(page.entries).toHaveLength(2);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.STORAGE_QUOTA_CHANGED);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.FILE_UPLOADED);
  });

  it('filters API_KEYS group — returns API_KEY_CREATED, API_KEY_REVOKED, and API_KEY_ROTATED entries', async () => {
    const keyCreated = makeEntry({ action: AuditAction.API_KEY_CREATED });
    const keyRevoked = makeEntry({ action: AuditAction.API_KEY_REVOKED });
    const keyRotated = makeEntry({ action: AuditAction.API_KEY_ROTATED });
    const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED });

    const { service } = makeValkeyService(
      [keyCreated, keyRevoked, keyRotated, noteCreated].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.API_KEYS },
    });

    expect(page.entries).toHaveLength(3);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.API_KEY_CREATED);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.API_KEY_REVOKED);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.API_KEY_ROTATED);
  });

  it('filters WORKSPACE_SETTINGS group', async () => {
    const wsUpdated = makeEntry({ action: AuditAction.WORKSPACE_UPDATED });
    const settingsChanged = makeEntry({ action: AuditAction.SETTINGS_CHANGED });
    const memberInvited = makeEntry({ action: AuditAction.MEMBER_INVITED });

    const { service } = makeValkeyService(
      [wsUpdated, settingsChanged, memberInvited].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.WORKSPACE_SETTINGS },
    });

    expect(page.entries).toHaveLength(2);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.WORKSPACE_UPDATED);
    expect(page.entries.map((e) => e.action)).toContain(AuditAction.SETTINGS_CHANGED);
  });

  it('returns empty page when no entries match the actionGroup', async () => {
    const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED });

    const { service } = makeValkeyService([JSON.stringify(noteCreated)]);
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.API_KEYS },
    });

    expect(page.entries).toHaveLength(0);
    expect(page.nextCursor).toBeNull();
    expect(page.total).toBe(0);
  });

  it('can combine actionGroup with userId filter', async () => {
    const adminInvited = makeEntry({ action: AuditAction.MEMBER_INVITED, userId: 'admin-1' });
    const otherInvited = makeEntry({ action: AuditAction.MEMBER_INVITED, userId: 'admin-2' });
    const adminNote = makeEntry({ action: AuditAction.NOTE_CREATED, userId: 'admin-1' });

    const { service } = makeValkeyService(
      [adminInvited, otherInvited, adminNote].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const page = await auditService.query('ws-1', {
      filter: { actionGroup: AuditActionGroup.MEMBERS, userId: 'admin-1' },
    });

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0].userId).toBe('admin-1');
    expect(page.entries[0].action).toBe(AuditAction.MEMBER_INVITED);
  });
});

// ─── AuditService — new action types in log() ────────────────────────────────

describe('AuditService — log() with new workspace-admin actions', () => {
  it('persists STORAGE_QUOTA_CHANGED entry correctly', async () => {
    const { service, client } = makeValkeyService();
    const auditService = new AuditService(service);

    await auditService.log(
      AuditAction.STORAGE_QUOTA_CHANGED,
      'super-admin-1',
      'ws-42',
      { maxStorageBytes: '10737418240', previousBytes: '5368709120' },
      '10.0.0.1',
      'AdminCLI/1.0',
    );

    expect(client.zadd).toHaveBeenCalledOnce();
    const [key, , raw] = client.zadd.mock.calls[0] as [string, number, string];
    expect(key).toBe('audit:log:ws:ws-42');
    const entry = JSON.parse(raw) as AuditEntry;
    expect(entry.action).toBe(AuditAction.STORAGE_QUOTA_CHANGED);
    expect(entry.userId).toBe('super-admin-1');
    expect(entry.metadata['maxStorageBytes']).toBe('10737418240');
  });

  it('persists API_KEY_CREATED entry correctly', async () => {
    const { service, client } = makeValkeyService();
    const auditService = new AuditService(service);

    await auditService.log(
      AuditAction.API_KEY_CREATED,
      'user-99',
      null,
      { keyPrefix: 'nts_abc...', keyName: 'CI Pipeline' },
      '192.168.1.1',
      'PostmanRuntime/7.0',
    );

    const [key, , raw] = client.zadd.mock.calls[0] as [string, number, string];
    expect(key).toBe('audit:log:global');
    const entry = JSON.parse(raw) as AuditEntry;
    expect(entry.action).toBe(AuditAction.API_KEY_CREATED);
    expect(entry.metadata['keyName']).toBe('CI Pipeline');
    expect(entry.workspaceId).toBeNull();
  });

  it('persists API_KEY_REVOKED entry correctly', async () => {
    const { service, client } = makeValkeyService();
    const auditService = new AuditService(service);

    await auditService.log(
      AuditAction.API_KEY_REVOKED,
      'user-99',
      null,
      { keyId: 'key-uuid-123', keyName: 'Old Key' },
      '192.168.1.1',
      'curl/8.0',
    );

    const [, , raw] = client.zadd.mock.calls[0] as [string, number, string];
    const entry = JSON.parse(raw) as AuditEntry;
    expect(entry.action).toBe(AuditAction.API_KEY_REVOKED);
    expect(entry.metadata['keyId']).toBe('key-uuid-123');
  });
});

// ─── exportCsv() with actionGroup filter ─────────────────────────────────────

describe('AuditService — exportCsv() with actionGroup filter', () => {
  it('exports only entries matching the actionGroup', async () => {
    const memberInvited = makeEntry({ action: AuditAction.MEMBER_INVITED, userId: 'admin-1' });
    const noteCreated = makeEntry({ action: AuditAction.NOTE_CREATED, userId: 'user-1' });
    const memberRemoved = makeEntry({ action: AuditAction.MEMBER_REMOVED, userId: 'admin-1' });

    const { service } = makeValkeyService(
      [memberInvited, noteCreated, memberRemoved].map((e) => JSON.stringify(e)),
    );
    const auditService = new AuditService(service);

    const csv = await auditService.exportCsv('ws-1', { actionGroup: AuditActionGroup.MEMBERS });
    const lines = csv.split('\r\n').filter(Boolean);

    // header + 2 member entries
    expect(lines).toHaveLength(3);
    expect(csv).toContain(AuditAction.MEMBER_INVITED);
    expect(csv).toContain(AuditAction.MEMBER_REMOVED);
    expect(csv).not.toContain(AuditAction.NOTE_CREATED);
  });
});

// ─── AuditQueryDto validation — actionGroup ──────────────────────────────────

describe('AuditQueryDto — actionGroup validation', () => {
  it('accepts a valid AuditActionGroup value', async () => {
    const dto = plainToInstance(AuditQueryDto, { actionGroup: 'members' });
    const errors = await validate(dto);
    const actionGroupError = errors.find((e) => e.property === 'actionGroup');
    expect(actionGroupError).toBeUndefined();
    expect(dto.actionGroup).toBe(AuditActionGroup.MEMBERS);
  });

  it('accepts all valid AuditActionGroup values without errors', async () => {
    for (const group of Object.values(AuditActionGroup)) {
      const dto = plainToInstance(AuditQueryDto, { actionGroup: group });
      const errors = await validate(dto);
      const actionGroupError = errors.find((e) => e.property === 'actionGroup');
      expect(actionGroupError).toBeUndefined();
    }
  });

  it('rejects an invalid actionGroup value', async () => {
    const dto = plainToInstance(AuditQueryDto, { actionGroup: 'not_a_real_group' });
    const errors = await validate(dto);
    const actionGroupError = errors.find((e) => e.property === 'actionGroup');
    expect(actionGroupError).toBeDefined();
  });

  it('is optional — no error when omitted', async () => {
    const dto = plainToInstance(AuditQueryDto, {});
    const errors = await validate(dto);
    const actionGroupError = errors.find((e) => e.property === 'actionGroup');
    expect(actionGroupError).toBeUndefined();
    expect(dto.actionGroup).toBeUndefined();
  });

  it('accepts actionGroup alongside actions without validation error', async () => {
    const dto = plainToInstance(AuditQueryDto, {
      actions: ['auth.login'],
      actionGroup: 'members',
    });
    const errors = await validate(dto);
    expect(
      errors.filter((e) => e.property === 'actions' || e.property === 'actionGroup'),
    ).toHaveLength(0);
  });
});
