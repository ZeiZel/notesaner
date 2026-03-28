import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { ConflictResolutionService } from '../conflict-resolution.service';
import {
  ConflictMergeType,
  TimestampedFrontmatter,
  ReconnectPayload,
} from '../conflict-resolution.types';
import { ValkeyService } from '../../valkey/valkey.service';
import { AuditService } from '../../audit/audit.service';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

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
    exists: vi.fn().mockResolvedValue(false),
    expire: vi.fn().mockResolvedValue(true),
    _client: client,
  } as unknown as ValkeyService & { _client: ReturnType<typeof makeValkeyClient> };
}

function makeAuditService() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  } as unknown as AuditService;
}

function buildService(valkeyOverride?: Partial<ReturnType<typeof makeValkeyClient>>) {
  const valkey = makeValkeyService(valkeyOverride);
  const audit = makeAuditService();
  const service = new ConflictResolutionService(valkey, audit);
  return { service, valkey, audit };
}

/**
 * Helper: create a Yjs document with some text content.
 */
function createDocWithContent(text: string): Y.Doc {
  const doc = new Y.Doc();
  const ytext = doc.getText('content');
  ytext.insert(0, text);
  return doc;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ConflictResolutionService', () => {
  // ─── resolveFrontmatter ───────────────────────────────────────────────────

  describe('resolveFrontmatter()', () => {
    it('merges non-overlapping fields from server and client', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        title: {
          value: 'Server Title',
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        tags: {
          value: ['important'],
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      expect(result.merged).toEqual({
        title: 'Server Title',
        tags: ['important'],
      });
      expect(result.noConflict).toContain('title');
      expect(result.noConflict).toContain('tags');
      expect(result.serverWins).toHaveLength(0);
      expect(result.clientWins).toHaveLength(0);
    });

    it('picks the client value when it has a newer timestamp', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        title: {
          value: 'Old Title',
          updatedAt: '2026-03-28T09:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        title: {
          value: 'New Title',
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      expect(result.merged['title']).toBe('New Title');
      expect(result.clientWins).toContain('title');
      expect(result.serverWins).toHaveLength(0);
    });

    it('picks the server value when it has a newer timestamp', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        status: {
          value: 'published',
          updatedAt: '2026-03-28T12:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        status: {
          value: 'draft',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      expect(result.merged['status']).toBe('published');
      expect(result.serverWins).toContain('status');
      expect(result.clientWins).toHaveLength(0);
    });

    it('server wins on equal timestamps (tie-breaker)', () => {
      const { service } = buildService();
      const sameTime = '2026-03-28T10:00:00.000Z';

      const server: TimestampedFrontmatter = {
        priority: {
          value: 'high',
          updatedAt: sameTime,
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        priority: {
          value: 'low',
          updatedAt: sameTime,
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      expect(result.merged['priority']).toBe('high');
      expect(result.serverWins).toContain('priority');
    });

    it('reports no conflict when values are identical', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        title: {
          value: 'Same Title',
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        title: {
          value: 'Same Title',
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      expect(result.merged['title']).toBe('Same Title');
      expect(result.noConflict).toContain('title');
      expect(result.serverWins).toHaveLength(0);
      expect(result.clientWins).toHaveLength(0);
    });

    it('handles empty frontmatter on both sides', () => {
      const { service } = buildService();
      const result = service.resolveFrontmatter({}, {});
      expect(result.merged).toEqual({});
      expect(result.noConflict).toHaveLength(0);
      expect(result.serverWins).toHaveLength(0);
      expect(result.clientWins).toHaveLength(0);
    });

    it('handles object values with deep equality', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        metadata: {
          value: { color: 'red', size: 10 },
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        metadata: {
          value: { color: 'red', size: 10 },
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);
      expect(result.noConflict).toContain('metadata');
    });

    it('resolves multiple conflicting fields independently', () => {
      const { service } = buildService();

      const server: TimestampedFrontmatter = {
        title: {
          value: 'Server Title',
          updatedAt: '2026-03-28T12:00:00.000Z',
          updatedBy: 'user-a',
        },
        status: {
          value: 'Server Status',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      const client: TimestampedFrontmatter = {
        title: {
          value: 'Client Title',
          updatedAt: '2026-03-28T09:00:00.000Z',
          updatedBy: 'user-b',
        },
        status: {
          value: 'Client Status',
          updatedAt: '2026-03-28T11:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const result = service.resolveFrontmatter(server, client);

      // Server title is newer
      expect(result.merged['title']).toBe('Server Title');
      expect(result.serverWins).toContain('title');

      // Client status is newer
      expect(result.merged['status']).toBe('Client Status');
      expect(result.clientWins).toContain('status');
    });
  });

  // ─── Yjs Document Management ──────────────────────────────────────────────

  describe('getOrCreateDoc()', () => {
    it('creates a new empty document when none exists', async () => {
      const { service } = buildService();
      const doc = await service.getOrCreateDoc('note-1');

      expect(doc).toBeDefined();
      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it('returns the same cached document on subsequent calls', async () => {
      const { service } = buildService();
      const doc1 = await service.getOrCreateDoc('note-1');
      const doc2 = await service.getOrCreateDoc('note-1');

      expect(doc1).toBe(doc2);
    });

    it('loads persisted state from Valkey', async () => {
      // Create a document with content and persist it
      const sourceDoc = createDocWithContent('Hello World');
      const state = Y.encodeStateAsUpdate(sourceDoc);
      const encoded = Buffer.from(state).toString('base64');

      const { service, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(encoded);

      const doc = await service.getOrCreateDoc('note-1');
      const content = doc.getText('content').toString();
      expect(content).toBe('Hello World');
    });

    it('creates empty doc when Valkey state is corrupt', async () => {
      const { service, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue('NOT_VALID_BASE64!!!');

      const doc = await service.getOrCreateDoc('note-1');
      // Should not throw — returns an empty doc
      expect(doc).toBeInstanceOf(Y.Doc);
    });
  });

  describe('applyUpdate()', () => {
    it('applies a Yjs update to the document', async () => {
      const { service } = buildService();

      // Create server doc
      await service.getOrCreateDoc('note-1');

      // Create a client doc with content and get the update
      const clientDoc = createDocWithContent('Client text');
      const update = Y.encodeStateAsUpdate(clientDoc);

      await service.applyUpdate('note-1', update);

      const serverDoc = await service.getOrCreateDoc('note-1');
      expect(serverDoc.getText('content').toString()).toBe('Client text');
    });
  });

  describe('getStateVector()', () => {
    it('returns the state vector of the server document', async () => {
      const { service } = buildService();
      const sv = await service.getStateVector('note-1');
      expect(sv).toBeInstanceOf(Uint8Array);
    });
  });

  describe('encodeServerDiff()', () => {
    it('returns the diff between server and client state', async () => {
      const { service } = buildService();

      // Set up server document with content
      const serverDoc = await service.getOrCreateDoc('note-1');
      const ytext = serverDoc.getText('content');
      ytext.insert(0, 'Server text');

      // Client has empty state vector (no knowledge)
      const emptyVector = Y.encodeStateVector(new Y.Doc());
      const diff = await service.encodeServerDiff('note-1', emptyVector);

      expect(diff).toBeInstanceOf(Uint8Array);
      expect(diff.byteLength).toBeGreaterThan(0);

      // Apply the diff to verify correctness
      const clientDoc = new Y.Doc();
      Y.applyUpdate(clientDoc, diff);
      expect(clientDoc.getText('content').toString()).toBe('Server text');
    });
  });

  describe('persistDocState()', () => {
    it('persists the document state to Valkey as base64', async () => {
      const { service, valkey } = buildService();

      const doc = createDocWithContent('Persist me');
      await service.persistDocState('note-1', 'ws-1', doc);

      expect(valkey.set).toHaveBeenCalledOnce();
      const [key, value] = (valkey.set as ReturnType<typeof vi.fn>).mock.calls[0] as [
        string,
        string,
      ];
      expect(key).toBe('sync:doc-state:note-1');
      expect(typeof value).toBe('string');

      // Verify it can be decoded
      const decoded = Buffer.from(value, 'base64');
      const restoredDoc = new Y.Doc();
      Y.applyUpdate(restoredDoc, new Uint8Array(decoded));
      expect(restoredDoc.getText('content').toString()).toBe('Persist me');
    });
  });

  describe('evictDoc()', () => {
    it('removes the document from in-memory cache', async () => {
      const { service } = buildService();

      const doc1 = await service.getOrCreateDoc('note-1');
      service.evictDoc('note-1');

      // Next call should create a new document
      const doc2 = await service.getOrCreateDoc('note-1');
      expect(doc2).not.toBe(doc1);
    });

    it('does nothing for non-existent documents', () => {
      const { service } = buildService();
      // Should not throw
      service.evictDoc('non-existent');
    });
  });

  // ─── Frontmatter Persistence ──────────────────────────────────────────────

  describe('loadFrontmatter()', () => {
    it('returns empty object when no frontmatter is stored', async () => {
      const { service } = buildService();
      const fm = await service.loadFrontmatter('note-1');
      expect(fm).toEqual({});
    });

    it('loads stored frontmatter from Valkey', async () => {
      const stored: TimestampedFrontmatter = {
        title: {
          value: 'My Note',
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-1',
        },
      };

      const { service, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(stored));

      const fm = await service.loadFrontmatter('note-1');
      expect(fm['title']?.value).toBe('My Note');
    });

    it('returns empty object when Valkey data is corrupt', async () => {
      const { service, valkey } = buildService();
      (valkey.get as ReturnType<typeof vi.fn>).mockResolvedValue('NOT_JSON{{');
      const fm = await service.loadFrontmatter('note-1');
      expect(fm).toEqual({});
    });
  });

  describe('persistFrontmatter()', () => {
    it('stores frontmatter to Valkey', async () => {
      const { service, valkey } = buildService();
      const fm: TimestampedFrontmatter = {
        title: {
          value: 'Test',
          updatedAt: '2026-03-28T10:00:00.000Z',
          updatedBy: 'user-1',
        },
      };

      await service.persistFrontmatter('note-1', fm);

      expect(valkey.set).toHaveBeenCalledWith('sync:frontmatter:note-1', JSON.stringify(fm));
    });
  });

  // ─── Conflict Logging ─────────────────────────────────────────────────────

  describe('logConflict()', () => {
    it('writes a conflict log entry to Valkey sorted-set', async () => {
      const { service, valkey } = buildService();

      const entry = await service.logConflict({
        noteId: 'note-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-abc',
        clientUpdateBytes: 256,
        serverDiffBytes: 128,
        frontmatterResult: {
          merged: {},
          mergedTimestamped: {},
          serverWins: [],
          clientWins: [],
          noConflict: [],
        },
        durationMs: 15,
      });

      expect(entry.id).toBeDefined();
      expect(entry.noteId).toBe('note-1');
      expect(entry.userId).toBe('user-1');
      expect(entry.mergeType).toBe(ConflictMergeType.CONTENT_CRDT);

      const client = valkey._client;
      expect(client.zadd).toHaveBeenCalledOnce();
    });

    it('sets merge type to FRONTMATTER_LWW when frontmatter conflicts exist', async () => {
      const { service } = buildService();

      const entry = await service.logConflict({
        noteId: 'note-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-abc',
        clientUpdateBytes: 0,
        serverDiffBytes: 0,
        frontmatterResult: {
          merged: { title: 'New' },
          mergedTimestamped: {
            title: {
              value: 'New',
              updatedAt: '2026-03-28T10:00:00.000Z',
              updatedBy: 'user-1',
            },
          },
          serverWins: ['title'],
          clientWins: [],
          noConflict: [],
        },
        durationMs: 5,
      });

      expect(entry.mergeType).toBe(ConflictMergeType.FRONTMATTER_LWW);
      expect(entry.frontmatterConflictCount).toBe(1);
    });

    it('does not throw when Valkey write fails', async () => {
      const failingZadd = vi.fn().mockRejectedValue(new Error('Valkey down'));
      const { service } = buildService({ zadd: failingZadd });

      const entry = await service.logConflict({
        noteId: 'note-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-abc',
        clientUpdateBytes: 0,
        serverDiffBytes: 0,
        frontmatterResult: {
          merged: {},
          mergedTimestamped: {},
          serverWins: [],
          clientWins: [],
          noConflict: [],
        },
        durationMs: 0,
      });

      // Should still return the entry (log failure is non-fatal)
      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();
    });
  });

  describe('queryConflictLog()', () => {
    it('returns empty array when no entries exist', async () => {
      const { service } = buildService();
      const entries = await service.queryConflictLog('ws-1');
      expect(entries).toHaveLength(0);
    });

    it('deserialises stored conflict log entries', async () => {
      const stored = {
        id: 'log-1',
        timestamp: '2026-03-28T10:00:00.000Z',
        noteId: 'note-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-1',
        mergeType: ConflictMergeType.CONTENT_CRDT,
        clientUpdateBytes: 100,
        serverDiffBytes: 50,
        frontmatterConflictCount: 0,
        frontmatterConflicts: [],
        durationMs: 10,
      };

      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue([JSON.stringify(stored)]);
      const { service } = buildService({
        zrevrangebyscore: client.zrevrangebyscore,
      });

      const entries = await service.queryConflictLog('ws-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('log-1');
    });

    it('skips corrupt entries', async () => {
      const valid = {
        id: 'log-1',
        timestamp: '2026-03-28T10:00:00.000Z',
        noteId: 'note-1',
        workspaceId: 'ws-1',
        userId: 'user-1',
        clientId: 'client-1',
        mergeType: ConflictMergeType.CONTENT_CRDT,
        clientUpdateBytes: 100,
        serverDiffBytes: 50,
        frontmatterConflictCount: 0,
        frontmatterConflicts: [],
        durationMs: 10,
      };

      const client = makeValkeyClient();
      client.zrevrangebyscore.mockResolvedValue(['INVALID_JSON{{{', JSON.stringify(valid)]);
      const { service } = buildService({
        zrevrangebyscore: client.zrevrangebyscore,
      });

      const entries = await service.queryConflictLog('ws-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe('log-1');
    });
  });

  // ─── handleReconnect (integration) ────────────────────────────────────────

  describe('handleReconnect()', () => {
    it('merges client offline edits with server state', async () => {
      const { service } = buildService();

      // 1. Simulate server document with some content
      const serverDoc = await service.getOrCreateDoc('note-1');
      const serverText = serverDoc.getText('content');
      serverText.insert(0, 'Server: Hello');

      // 2. Simulate a client that went offline after seeing initial state
      const clientDoc = new Y.Doc();
      // Apply the server state to the client first (so they share history)
      const serverState = Y.encodeStateAsUpdate(serverDoc);
      Y.applyUpdate(clientDoc, serverState);

      // Client makes offline edits
      const clientText = clientDoc.getText('content');
      clientText.insert(clientText.length, ' + Client offline');

      // Get the client's state vector and pending update
      const clientStateVector = Y.encodeStateVector(clientDoc);
      // Compute what the client has that the server doesn't
      const clientUpdate = Y.encodeStateAsUpdate(clientDoc, Y.encodeStateVector(serverDoc));

      // Meanwhile, server gets an edit from another user
      serverText.insert(serverText.length, ' + Server edit');

      // 3. Client reconnects
      const payload: ReconnectPayload = {
        noteId: 'note-1',
        workspaceId: 'ws-1',
        stateVector: Array.from(clientStateVector),
        pendingUpdates: [Array.from(clientUpdate)],
        frontmatter: {},
      };

      const response = await service.handleReconnect(payload, 'user-1', 'client-abc');

      // 4. Verify the merge
      expect(response.mergeInfo.contentMerged).toBe(true);
      expect(response.mergeInfo.conflictLogId).toBeDefined();

      // The server document should contain both edits merged
      const finalDoc = await service.getOrCreateDoc('note-1');
      const finalText = finalDoc.getText('content').toString();
      // Yjs CRDT merges both — exact ordering depends on client IDs,
      // but both strings must be present
      expect(finalText).toContain('Server: Hello');
      expect(finalText).toContain('Client offline');
      expect(finalText).toContain('Server edit');

      // Server diff should be non-empty (has the server edit the client missed)
      expect(response.serverUpdate.length).toBeGreaterThan(0);
    });

    it('resolves frontmatter conflicts during reconnect', async () => {
      const { service, valkey } = buildService();

      // Server frontmatter
      const serverFm: TimestampedFrontmatter = {
        title: {
          value: 'Server Title',
          updatedAt: '2026-03-28T12:00:00.000Z',
          updatedBy: 'user-a',
        },
        tags: {
          value: ['server-tag'],
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      // Mock loading server frontmatter
      (valkey.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key.startsWith('sync:frontmatter:')) {
          return Promise.resolve(JSON.stringify(serverFm));
        }
        return Promise.resolve(null);
      });

      // Initialize a server doc
      await service.getOrCreateDoc('note-1');

      // Client frontmatter — client has newer tags but older title
      const clientFm: TimestampedFrontmatter = {
        title: {
          value: 'Client Title',
          updatedAt: '2026-03-28T09:00:00.000Z',
          updatedBy: 'user-b',
        },
        tags: {
          value: ['client-tag'],
          updatedAt: '2026-03-28T13:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const emptyDoc = new Y.Doc();
      const payload: ReconnectPayload = {
        noteId: 'note-1',
        workspaceId: 'ws-1',
        stateVector: Array.from(Y.encodeStateVector(emptyDoc)),
        pendingUpdates: [],
        frontmatter: clientFm,
      };

      const response = await service.handleReconnect(payload, 'user-b', 'client-xyz');

      // Server title should win (newer timestamp)
      expect(response.frontmatter['title']).toBe('Server Title');
      // Client tags should win (newer timestamp)
      expect(response.frontmatter['tags']).toEqual(['client-tag']);
    });

    it('logs a conflict entry for every reconnect', async () => {
      const { service, valkey, audit } = buildService();

      await service.getOrCreateDoc('note-1');

      const emptyDoc = new Y.Doc();
      const payload: ReconnectPayload = {
        noteId: 'note-1',
        workspaceId: 'ws-1',
        stateVector: Array.from(Y.encodeStateVector(emptyDoc)),
        pendingUpdates: [],
      };

      await service.handleReconnect(payload, 'user-1', 'client-1');

      // Conflict log should be written to Valkey
      const client = valkey._client;
      expect(client.zadd).toHaveBeenCalled();

      // Audit service should be called
      expect(audit.log).toHaveBeenCalled();
    });
  });

  // ─── Two Clients Offline Scenario ─────────────────────────────────────────

  describe('two clients editing offline, reconnect, verify merge', () => {
    it('merges concurrent offline edits from two clients without data loss', async () => {
      const { service } = buildService();

      // 1. Establish a shared initial state
      const initialDoc = await service.getOrCreateDoc('note-shared');
      const initialText = initialDoc.getText('content');
      initialText.insert(0, 'Initial content.');

      // Capture the initial state
      const initialState = Y.encodeStateAsUpdate(initialDoc);
      const initialSV = Y.encodeStateVector(initialDoc);

      // 2. Client A goes offline, makes edits
      const clientA = new Y.Doc();
      Y.applyUpdate(clientA, initialState);
      const clientAText = clientA.getText('content');
      clientAText.insert(clientAText.length, ' Client A was here.');
      const clientAUpdate = Y.encodeStateAsUpdate(clientA, initialSV);
      const clientASV = Y.encodeStateVector(clientA);

      // 3. Client B goes offline, makes edits
      const clientB = new Y.Doc();
      Y.applyUpdate(clientB, initialState);
      const clientBText = clientB.getText('content');
      clientBText.insert(clientBText.length, ' Client B was here.');
      const clientBUpdate = Y.encodeStateAsUpdate(clientB, initialSV);
      const clientBSV = Y.encodeStateVector(clientB);

      // Meanwhile, server also gets an edit from a third user
      initialText.insert(initialText.length, ' Server edit.');

      // 4. Client A reconnects first
      const responseA = await service.handleReconnect(
        {
          noteId: 'note-shared',
          workspaceId: 'ws-1',
          stateVector: Array.from(clientASV),
          pendingUpdates: [Array.from(clientAUpdate)],
        },
        'user-a',
        'client-a',
      );

      expect(responseA.mergeInfo.contentMerged).toBe(true);

      // 5. Client B reconnects second
      const responseB = await service.handleReconnect(
        {
          noteId: 'note-shared',
          workspaceId: 'ws-1',
          stateVector: Array.from(clientBSV),
          pendingUpdates: [Array.from(clientBUpdate)],
        },
        'user-b',
        'client-b',
      );

      expect(responseB.mergeInfo.contentMerged).toBe(true);

      // 6. Verify the final document contains ALL edits — no data loss
      const finalDoc = await service.getOrCreateDoc('note-shared');
      const finalText = finalDoc.getText('content').toString();

      expect(finalText).toContain('Initial content.');
      expect(finalText).toContain('Client A was here.');
      expect(finalText).toContain('Client B was here.');
      expect(finalText).toContain('Server edit.');
    });

    it('handles frontmatter conflicts from two offline clients', async () => {
      const { service, valkey } = buildService();

      // Server frontmatter (baseline)
      const serverFm: TimestampedFrontmatter = {
        title: {
          value: 'Original Title',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-original',
        },
        status: {
          value: 'draft',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-original',
        },
        category: {
          value: 'general',
          updatedAt: '2026-03-28T08:00:00.000Z',
          updatedBy: 'user-original',
        },
      };

      // Track frontmatter persistence across reconnects
      let currentFm = serverFm;
      (valkey.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key.startsWith('sync:frontmatter:')) {
          return Promise.resolve(JSON.stringify(currentFm));
        }
        return Promise.resolve(null);
      });
      (valkey.set as ReturnType<typeof vi.fn>).mockImplementation((key: string, value: string) => {
        if (key.startsWith('sync:frontmatter:')) {
          currentFm = JSON.parse(value) as TimestampedFrontmatter;
        }
        return Promise.resolve(undefined);
      });

      await service.getOrCreateDoc('note-fm');

      // Client A: changes title (newer) and status (older)
      const clientAFm: TimestampedFrontmatter = {
        title: {
          value: 'Client A Title',
          updatedAt: '2026-03-28T12:00:00.000Z',
          updatedBy: 'user-a',
        },
        status: {
          value: 'client-a-status',
          updatedAt: '2026-03-28T09:00:00.000Z',
          updatedBy: 'user-a',
        },
      };

      // Client B: changes title (even newer) and category
      const clientBFm: TimestampedFrontmatter = {
        title: {
          value: 'Client B Title',
          updatedAt: '2026-03-28T14:00:00.000Z',
          updatedBy: 'user-b',
        },
        category: {
          value: 'technical',
          updatedAt: '2026-03-28T15:00:00.000Z',
          updatedBy: 'user-b',
        },
      };

      const emptyDoc = new Y.Doc();
      const emptySV = Array.from(Y.encodeStateVector(emptyDoc));

      // Client A reconnects first
      const responseA = await service.handleReconnect(
        {
          noteId: 'note-fm',
          workspaceId: 'ws-1',
          stateVector: emptySV,
          pendingUpdates: [],
          frontmatter: clientAFm,
        },
        'user-a',
        'client-a',
      );

      // After A: title should be A's (newer than server), status should be A's (newer than server)
      expect(responseA.frontmatter['title']).toBe('Client A Title');

      // Client B reconnects second
      const responseB = await service.handleReconnect(
        {
          noteId: 'note-fm',
          workspaceId: 'ws-1',
          stateVector: emptySV,
          pendingUpdates: [],
          frontmatter: clientBFm,
        },
        'user-b',
        'client-b',
      );

      // After B: title should be B's (even newer than A's), category should be B's
      expect(responseB.frontmatter['title']).toBe('Client B Title');
      expect(responseB.frontmatter['category']).toBe('technical');
    });
  });
});
