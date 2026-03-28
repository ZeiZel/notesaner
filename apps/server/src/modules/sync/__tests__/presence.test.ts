import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PresenceService } from '../presence.service';
import { PresenceGateway } from '../presence.gateway';
import { ValkeyService } from '../../valkey/valkey.service';
import {
  assignUserColor,
  presenceKey,
  PRESENCE_COLORS,
  PRESENCE_DEBOUNCE_MS,
  PRESENCE_TTL_SECONDS,
} from '@notesaner/sync-engine';
import type { PresenceUpdatePayload } from '@notesaner/sync-engine';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function makeValkeyClient() {
  return {
    hset: vi.fn().mockResolvedValue(1),
    hdel: vi.fn().mockResolvedValue(1),
    hgetall: vi.fn().mockResolvedValue({}),
    expire: vi.fn().mockResolvedValue(1),
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

function buildPresenceService(valkeyOverrides?: Partial<ReturnType<typeof makeValkeyClient>>) {
  const valkey = makeValkeyService(valkeyOverrides);
  const service = new PresenceService(valkey);
  return { service, valkey };
}

// ─── Shared Presence Types Tests ─────────────────────────────────────────────

describe('Shared Presence Helpers (libs/sync-engine)', () => {
  describe('assignUserColor()', () => {
    it('returns a color from the PRESENCE_COLORS palette', () => {
      const color = assignUserColor('user-123');
      expect(PRESENCE_COLORS).toContain(color);
    });

    it('returns the same color for the same user ID (deterministic)', () => {
      const color1 = assignUserColor('user-abc');
      const color2 = assignUserColor('user-abc');
      expect(color1).toBe(color2);
    });

    it('returns different colors for different user IDs (in most cases)', () => {
      // Technically not guaranteed (hash collisions), but with these distinct IDs
      // the probability of collision is extremely low.
      const colorA = assignUserColor('alice');
      const colorB = assignUserColor('bob');
      const colorC = assignUserColor('charlie');

      // At least 2 of 3 should be different
      const uniqueColors = new Set([colorA, colorB, colorC]);
      expect(uniqueColors.size).toBeGreaterThanOrEqual(2);
    });

    it('handles empty string user ID without throwing', () => {
      const color = assignUserColor('');
      expect(PRESENCE_COLORS).toContain(color);
    });

    it('handles very long user IDs', () => {
      const longId = 'u'.repeat(10000);
      const color = assignUserColor(longId);
      expect(PRESENCE_COLORS).toContain(color);
    });
  });

  describe('presenceKey()', () => {
    it('returns a namespaced ValKey key', () => {
      expect(presenceKey('note-abc')).toBe('sync:presence:note-abc');
    });
  });

  describe('PRESENCE_DEBOUNCE_MS', () => {
    it('is 50ms', () => {
      expect(PRESENCE_DEBOUNCE_MS).toBe(50);
    });
  });

  describe('PRESENCE_TTL_SECONDS', () => {
    it('is 300 seconds (5 minutes)', () => {
      expect(PRESENCE_TTL_SECONDS).toBe(300);
    });
  });
});

// ─── PresenceService Tests ───────────────────────────────────────────────────

describe('PresenceService', () => {
  describe('setPresence()', () => {
    it('stores presence and returns a broadcast payload', async () => {
      const { service } = buildPresenceService();

      const result = await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 42,
        length: 0,
      });

      expect(result.noteId).toBe('note-1');
      expect(result.clientId).toBe('client-abc');
      expect(result.userId).toBe('user-1');
      expect(result.userName).toBe('Alice');
      expect(result.color).toBe(assignUserColor('user-1'));
      expect(result.cursor).toEqual({ index: 42, length: 0 });
      expect(result.lastUpdatedAt).toBeDefined();
    });

    it('persists presence to ValKey hash', async () => {
      const { service, valkey } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 10,
        length: 5,
      });

      // Wait for fire-and-forget ValKey write
      await new Promise((resolve) => setTimeout(resolve, 10));

      const client = valkey._client;
      expect(client.hset).toHaveBeenCalledWith(
        'sync:presence:note-1',
        'client-abc',
        expect.any(String),
      );
      expect(client.expire).toHaveBeenCalledWith('sync:presence:note-1', PRESENCE_TTL_SECONDS);
    });

    it('assigns a deterministic color based on user ID', async () => {
      const { service } = buildPresenceService();

      const result1 = await service.setPresence('note-1', 'client-1', 'user-xyz', 'Bob', null);
      const result2 = await service.setPresence('note-2', 'client-2', 'user-xyz', 'Bob', null);

      expect(result1.color).toBe(result2.color);
    });

    it('handles null cursor (user has no focus)', async () => {
      const { service } = buildPresenceService();

      const result = await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', null);

      expect(result.cursor).toBeNull();
    });

    it('updates existing presence for the same client', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 0,
        length: 0,
      });
      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 50,
        length: 10,
      });

      const entries = service.getPresenceForNote('note-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].cursor).toEqual({ index: 50, length: 10 });
    });

    it('does not throw when ValKey persistence fails', async () => {
      const { service } = buildPresenceService({
        hset: vi.fn().mockRejectedValue(new Error('ValKey down')),
      });

      // Should not throw -- ValKey write is fire-and-forget
      const result = await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 0,
        length: 0,
      });

      expect(result.userId).toBe('user-1');
    });
  });

  describe('removePresence()', () => {
    it('removes a client from the in-memory presence map', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', {
        index: 0,
        length: 0,
      });
      expect(service.getPresenceCount('note-1')).toBe(1);

      await service.removePresence('note-1', 'client-abc');
      expect(service.getPresenceCount('note-1')).toBe(0);
    });

    it('removes the entry from ValKey', async () => {
      const { service, valkey } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', null);
      await service.removePresence('note-1', 'client-abc');

      const client = valkey._client;
      expect(client.hdel).toHaveBeenCalledWith('sync:presence:note-1', 'client-abc');
    });

    it('does nothing for a non-existent client', async () => {
      const { service } = buildPresenceService();

      // Should not throw
      await service.removePresence('note-1', 'non-existent');
      expect(service.getPresenceCount('note-1')).toBe(0);
    });

    it('cleans up empty note entries', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', null);
      await service.removePresence('note-1', 'client-abc');

      // Internal map should have no entry for this note
      expect(service.getPresenceForNote('note-1')).toHaveLength(0);
    });
  });

  describe('removeAllPresenceForClient()', () => {
    it('removes the client from all notes they are in', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-abc', 'user-1', 'Alice', null);
      await service.setPresence('note-2', 'client-abc', 'user-1', 'Alice', null);
      await service.setPresence('note-3', 'client-def', 'user-2', 'Bob', null);

      const affectedNotes = await service.removeAllPresenceForClient('client-abc');

      expect(affectedNotes).toContain('note-1');
      expect(affectedNotes).toContain('note-2');
      expect(affectedNotes).toHaveLength(2);
      expect(service.getPresenceCount('note-1')).toBe(0);
      expect(service.getPresenceCount('note-2')).toBe(0);
      // Bob's presence in note-3 should be untouched
      expect(service.getPresenceCount('note-3')).toBe(1);
    });

    it('returns empty array when client has no presence', async () => {
      const { service } = buildPresenceService();
      const affected = await service.removeAllPresenceForClient('non-existent');
      expect(affected).toHaveLength(0);
    });
  });

  describe('getPresenceForNote()', () => {
    it('returns all active users in a note', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-1', 'user-a', 'Alice', {
        index: 10,
        length: 0,
      });
      await service.setPresence('note-1', 'client-2', 'user-b', 'Bob', {
        index: 20,
        length: 5,
      });

      const entries = service.getPresenceForNote('note-1');

      expect(entries).toHaveLength(2);

      const alice = entries.find((e) => e.userId === 'user-a');
      const bob = entries.find((e) => e.userId === 'user-b');

      expect(alice).toBeDefined();
      expect(alice?.userName).toBe('Alice');
      expect(alice?.cursor).toEqual({ index: 10, length: 0 });

      expect(bob).toBeDefined();
      expect(bob?.userName).toBe('Bob');
      expect(bob?.cursor).toEqual({ index: 20, length: 5 });
    });

    it('returns empty array for note with no presence', () => {
      const { service } = buildPresenceService();
      expect(service.getPresenceForNote('empty-note')).toHaveLength(0);
    });
  });

  describe('getPresenceCount()', () => {
    it('returns 0 for a note with no presence', () => {
      const { service } = buildPresenceService();
      expect(service.getPresenceCount('note-1')).toBe(0);
    });

    it('returns the correct count', async () => {
      const { service } = buildPresenceService();

      await service.setPresence('note-1', 'client-1', 'user-a', 'Alice', null);
      await service.setPresence('note-1', 'client-2', 'user-b', 'Bob', null);
      await service.setPresence('note-1', 'client-3', 'user-c', 'Charlie', null);

      expect(service.getPresenceCount('note-1')).toBe(3);
    });
  });

  describe('loadPresenceFromValkey()', () => {
    it('returns empty array when no entries in ValKey', async () => {
      const { service } = buildPresenceService();
      const entries = await service.loadPresenceFromValkey('note-1');
      expect(entries).toHaveLength(0);
    });

    it('loads and parses valid entries from ValKey', async () => {
      const storedState = {
        userName: 'Alice',
        userId: 'user-a',
        color: '#e06c75',
        cursor: { index: 42, length: 0 },
        lastUpdatedAt: new Date().toISOString(),
      };

      const { service } = buildPresenceService({
        hgetall: vi.fn().mockResolvedValue({
          'client-1': JSON.stringify(storedState),
        }),
      });

      const entries = await service.loadPresenceFromValkey('note-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe('user-a');
      expect(entries[0].userName).toBe('Alice');
      expect(entries[0].cursor).toEqual({ index: 42, length: 0 });
    });

    it('skips stale entries older than TTL', async () => {
      const staleDate = new Date(Date.now() - (PRESENCE_TTL_SECONDS + 60) * 1000).toISOString();
      const storedState = {
        userName: 'Stale User',
        userId: 'user-stale',
        color: '#e06c75',
        cursor: null,
        lastUpdatedAt: staleDate,
      };

      const { service } = buildPresenceService({
        hgetall: vi.fn().mockResolvedValue({
          'client-stale': JSON.stringify(storedState),
        }),
      });

      const entries = await service.loadPresenceFromValkey('note-1');
      expect(entries).toHaveLength(0);
    });

    it('skips corrupt JSON entries', async () => {
      const validState = {
        userName: 'Valid',
        userId: 'user-valid',
        color: '#61afef',
        cursor: null,
        lastUpdatedAt: new Date().toISOString(),
      };

      const { service } = buildPresenceService({
        hgetall: vi.fn().mockResolvedValue({
          'client-corrupt': 'NOT_JSON{{{',
          'client-valid': JSON.stringify(validState),
        }),
      });

      const entries = await service.loadPresenceFromValkey('note-1');
      expect(entries).toHaveLength(1);
      expect(entries[0].userId).toBe('user-valid');
    });

    it('returns empty array when ValKey fails', async () => {
      const { service } = buildPresenceService({
        hgetall: vi.fn().mockRejectedValue(new Error('connection refused')),
      });

      const entries = await service.loadPresenceFromValkey('note-1');
      expect(entries).toHaveLength(0);
    });
  });
});

// ─── PresenceGateway Tests ───────────────────────────────────────────────────

describe('PresenceGateway', () => {
  let gateway: PresenceGateway;
  let presenceService: PresenceService;
  let mockServer: { clients: Set<unknown> };

  /**
   * Helper to create a mock AuthenticatedSocket.
   */
  function makeClient(overrides: Record<string, unknown> = {}) {
    const messages: string[] = [];
    return {
      id: overrides['id'] ?? `client-${Math.random().toString(36).slice(2)}`,
      userId: overrides['userId'] ?? 'user-1',
      userName: overrides['userName'] ?? 'TestUser',
      noteId: overrides['noteId'] ?? undefined,
      workspaceId: overrides['workspaceId'] ?? 'ws-1',
      readyState: 1, // WebSocket.OPEN
      send: vi.fn((msg: string) => messages.push(msg)),
      _messages: messages,
      ...overrides,
    };
  }

  beforeEach(() => {
    const valkey = makeValkeyService();
    presenceService = new PresenceService(valkey);
    gateway = new PresenceGateway(presenceService);

    // Inject a mock server with a clients set
    mockServer = { clients: new Set() };
    (gateway as unknown as { server: typeof mockServer }).server = mockServer;
  });

  describe('handleConnection()', () => {
    it('assigns an id if the client does not have one', () => {
      const client = makeClient({ id: undefined });
      gateway.handleConnection(client as never);
      expect(client.id).toBeDefined();
    });

    it('preserves existing client id', () => {
      const client = makeClient({ id: 'existing-id' });
      gateway.handleConnection(client as never);
      expect(client.id).toBe('existing-id');
    });
  });

  describe('handlePresenceUpdate()', () => {
    it('updates presence and broadcasts to peers', async () => {
      const sender = makeClient({
        id: 'sender',
        userId: 'user-a',
        userName: 'Alice',
        noteId: 'note-1',
      });
      const peer = makeClient({ id: 'peer', userId: 'user-b', userName: 'Bob', noteId: 'note-1' });

      mockServer.clients.add(sender);
      mockServer.clients.add(peer);

      const payload: PresenceUpdatePayload = {
        noteId: 'note-1',
        cursor: { index: 42, length: 0 },
      };

      await gateway.handlePresenceUpdate(sender as never, payload);

      // Peer should have received a presence:state message
      expect(peer.send).toHaveBeenCalledTimes(1);
      const receivedMessage = JSON.parse(peer._messages[0]);
      expect(receivedMessage.event).toBe('presence:state');
      expect(receivedMessage.data.userId).toBe('user-a');
      expect(receivedMessage.data.userName).toBe('Alice');
      expect(receivedMessage.data.cursor).toEqual({ index: 42, length: 0 });
      expect(receivedMessage.data.color).toBeDefined();

      // Sender should NOT receive their own broadcast
      expect(sender.send).not.toHaveBeenCalled();
    });

    it('applies server-side debounce (drops updates within PRESENCE_DEBOUNCE_MS)', async () => {
      const sender = makeClient({
        id: 'fast-sender',
        userId: 'user-a',
        userName: 'Alice',
        noteId: 'note-1',
      });
      const peer = makeClient({ id: 'peer', userId: 'user-b', userName: 'Bob', noteId: 'note-1' });

      mockServer.clients.add(sender);
      mockServer.clients.add(peer);

      // First update should go through
      await gateway.handlePresenceUpdate(sender as never, {
        noteId: 'note-1',
        cursor: { index: 0, length: 0 },
      });
      expect(peer.send).toHaveBeenCalledTimes(1);

      // Immediate second update should be debounced (dropped)
      await gateway.handlePresenceUpdate(sender as never, {
        noteId: 'note-1',
        cursor: { index: 10, length: 0 },
      });
      expect(peer.send).toHaveBeenCalledTimes(1); // Still 1, second was dropped
    });

    it('does not broadcast to clients in other notes', async () => {
      const sender = makeClient({
        id: 'sender',
        userId: 'user-a',
        userName: 'Alice',
        noteId: 'note-1',
      });
      const otherNote = makeClient({
        id: 'other',
        userId: 'user-c',
        userName: 'Charlie',
        noteId: 'note-2',
      });

      mockServer.clients.add(sender);
      mockServer.clients.add(otherNote);

      await gateway.handlePresenceUpdate(sender as never, {
        noteId: 'note-1',
        cursor: { index: 0, length: 0 },
      });

      expect(otherNote.send).not.toHaveBeenCalled();
    });
  });

  describe('handlePresenceSnapshot()', () => {
    it('returns the current presence state for a note', async () => {
      // Set up some presence
      await presenceService.setPresence('note-1', 'client-a', 'user-a', 'Alice', {
        index: 10,
        length: 0,
      });
      await presenceService.setPresence('note-1', 'client-b', 'user-b', 'Bob', {
        index: 20,
        length: 5,
      });

      const client = makeClient({ id: 'requester' });
      const result = gateway.handlePresenceSnapshot(client as never, { noteId: 'note-1' });

      expect(result.event).toBe('presence:snapshot');
      expect(result.data.noteId).toBe('note-1');
      expect(result.data.users).toHaveLength(2);
    });

    it('returns empty users array for a note with no presence', () => {
      const client = makeClient({ id: 'requester' });
      const result = gateway.handlePresenceSnapshot(client as never, { noteId: 'empty-note' });

      expect(result.data.users).toHaveLength(0);
    });
  });

  describe('handlePresenceLeave()', () => {
    it('removes presence and broadcasts removal to peers', async () => {
      const sender = makeClient({
        id: 'leaver',
        userId: 'user-a',
        userName: 'Alice',
        noteId: 'note-1',
      });
      const peer = makeClient({ id: 'peer', userId: 'user-b', userName: 'Bob', noteId: 'note-1' });

      mockServer.clients.add(sender);
      mockServer.clients.add(peer);

      // First set presence
      await presenceService.setPresence('note-1', 'leaver', 'user-a', 'Alice', {
        index: 0,
        length: 0,
      });

      // Then leave
      await gateway.handlePresenceLeave(sender as never, { noteId: 'note-1' });

      // Peer should receive a presence:remove message
      expect(peer.send).toHaveBeenCalledTimes(1);
      const receivedMessage = JSON.parse(peer._messages[0]);
      expect(receivedMessage.event).toBe('presence:remove');
      expect(receivedMessage.data.clientId).toBe('leaver');
      expect(receivedMessage.data.userId).toBe('user-a');

      // Presence should be cleared
      expect(presenceService.getPresenceCount('note-1')).toBe(0);
    });
  });

  describe('handleDisconnect()', () => {
    it('cleans up all presence for the disconnecting client', async () => {
      const client = makeClient({
        id: 'disconnector',
        userId: 'user-a',
        userName: 'Alice',
        noteId: 'note-1',
      });
      const peer = makeClient({ id: 'peer', userId: 'user-b', userName: 'Bob', noteId: 'note-1' });

      mockServer.clients.add(client);
      mockServer.clients.add(peer);

      // Set up presence
      await presenceService.setPresence('note-1', 'disconnector', 'user-a', 'Alice', {
        index: 0,
        length: 0,
      });

      // Simulate that presence:update was called (to populate clientNotes)
      await gateway.handlePresenceUpdate(client as never, {
        noteId: 'note-1',
        cursor: { index: 0, length: 0 },
      });

      // Reset peer's send mock to only track disconnect broadcast
      (peer.send as ReturnType<typeof vi.fn>).mockClear();

      // Disconnect
      await gateway.handleDisconnect(client as never);

      // Peer should receive removal notification
      const calls = (peer.send as ReturnType<typeof vi.fn>).mock.calls;
      const removeMessages = calls
        .map(([msg]: [string]) => JSON.parse(msg))
        .filter((m: { event: string }) => m.event === 'presence:remove');

      expect(removeMessages.length).toBeGreaterThanOrEqual(1);
      expect(removeMessages[0].data.clientId).toBe('disconnector');

      // Presence should be fully cleared
      expect(presenceService.getPresenceCount('note-1')).toBe(0);
    });
  });

  describe('getPresenceCount()', () => {
    it('delegates to PresenceService', async () => {
      await presenceService.setPresence('note-1', 'client-1', 'user-1', 'Alice', null);
      expect(gateway.getPresenceCount('note-1')).toBe(1);
    });
  });
});

// ─── Integration: Multi-User Presence Scenario ──────────────────────────────

describe('Multi-user presence scenario', () => {
  it('tracks multiple users, handles updates and departures correctly', async () => {
    const valkey = makeValkeyService();
    const service = new PresenceService(valkey);

    // 3 users join the same note
    await service.setPresence('note-1', 'client-a', 'user-a', 'Alice', {
      index: 0,
      length: 0,
    });
    await service.setPresence('note-1', 'client-b', 'user-b', 'Bob', {
      index: 100,
      length: 0,
    });
    await service.setPresence('note-1', 'client-c', 'user-c', 'Charlie', {
      index: 200,
      length: 10,
    });

    expect(service.getPresenceCount('note-1')).toBe(3);

    // All users should have valid palette colors
    const entries = service.getPresenceForNote('note-1');
    for (const entry of entries) {
      expect(PRESENCE_COLORS).toContain(entry.color);
    }

    // Alice moves her cursor
    const updatedAlice = await service.setPresence('note-1', 'client-a', 'user-a', 'Alice', {
      index: 50,
      length: 20,
    });
    expect(updatedAlice.cursor).toEqual({ index: 50, length: 20 });

    // Bob leaves
    await service.removePresence('note-1', 'client-b');
    expect(service.getPresenceCount('note-1')).toBe(2);

    // Charlie disconnects (from all notes)
    await service.setPresence('note-2', 'client-c', 'user-c', 'Charlie', null);
    const affected = await service.removeAllPresenceForClient('client-c');
    expect(affected).toContain('note-1');
    expect(affected).toContain('note-2');

    // Only Alice remains in note-1
    expect(service.getPresenceCount('note-1')).toBe(1);
    const remaining = service.getPresenceForNote('note-1');
    expect(remaining[0].userId).toBe('user-a');
    expect(remaining[0].userName).toBe('Alice');
  });
});
