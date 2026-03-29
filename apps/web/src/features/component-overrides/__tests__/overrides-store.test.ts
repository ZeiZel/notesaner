import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useOverridesStore, selectOverrideOp } from '../model/overrides-store';

// ── API mock ─────────────────────────────────────────────────────────────────

const mockApi = vi.hoisted(() => ({
  getRegistry: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  compile: vi.fn(),
  revert: vi.fn(),
  delete: vi.fn(),
  getAuditLog: vi.fn(),
}));

vi.mock('../api/component-overrides-api', () => ({
  componentOverridesApi: mockApi,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

const TOKEN = 'test-token';
const WS_ID = 'ws-1';
const COMPONENT_ID = 'NoteCard';

function makeOverride(status: string = 'draft') {
  return {
    id: 'ov-1',
    workspaceId: WS_ID,
    componentId: COMPONENT_ID,
    sourceCode: 'code',
    compiledCode: null as string | null,
    pinnedBaseVersion: '1.0.0',
    status,
    compileError: null as string | null,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    createdByUserId: 'user-1',
  };
}

function resetStore() {
  useOverridesStore.setState({
    overrides: {},
    registry: [],
    operations: {},
    activeComponentId: null,
    draftSources: {},
  });
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useOverridesStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetStore();
  });

  // ── loadOverrides ──────────────────────────────────────────────────────

  describe('loadOverrides', () => {
    it('populates overrides by componentId', async () => {
      const override = makeOverride();
      mockApi.list.mockResolvedValue([override]);

      await useOverridesStore.getState().loadOverrides(TOKEN, WS_ID);

      const { overrides } = useOverridesStore.getState();
      expect(overrides[COMPONENT_ID]).toEqual(override);
    });
  });

  // ── openEditor ────────────────────────────────────────────────────────

  describe('openEditor', () => {
    it('sets activeComponentId', () => {
      useOverridesStore.getState().openEditor(COMPONENT_ID);
      expect(useOverridesStore.getState().activeComponentId).toBe(COMPONENT_ID);
    });

    it('seeds draftSource from existing override', () => {
      const override = makeOverride();
      useOverridesStore.setState({ overrides: { [COMPONENT_ID]: override } });

      useOverridesStore.getState().openEditor(COMPONENT_ID);
      expect(useOverridesStore.getState().draftSources[COMPONENT_ID]).toBe(override.sourceCode);
    });
  });

  // ── closeEditor ───────────────────────────────────────────────────────

  describe('closeEditor', () => {
    it('clears activeComponentId', () => {
      useOverridesStore.setState({ activeComponentId: COMPONENT_ID });
      useOverridesStore.getState().closeEditor();
      expect(useOverridesStore.getState().activeComponentId).toBeNull();
    });
  });

  // ── setDraftSource ────────────────────────────────────────────────────

  describe('setDraftSource', () => {
    it('updates the draft source for the component', () => {
      useOverridesStore.getState().setDraftSource(COMPONENT_ID, 'new code');
      expect(useOverridesStore.getState().draftSources[COMPONENT_ID]).toBe('new code');
    });
  });

  // ── saveOverride — create ─────────────────────────────────────────────

  describe('saveOverride (create)', () => {
    it('calls create when no existing override', async () => {
      const created = makeOverride('draft');
      mockApi.create.mockResolvedValue(created);
      useOverridesStore.setState({ draftSources: { [COMPONENT_ID]: 'my code' } });

      await useOverridesStore.getState().saveOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(mockApi.create).toHaveBeenCalledWith(TOKEN, WS_ID, {
        componentId: COMPONENT_ID,
        sourceCode: 'my code',
      });
      expect(useOverridesStore.getState().overrides[COMPONENT_ID]).toEqual(created);
      expect(useOverridesStore.getState().operations[COMPONENT_ID]?.status).toBe('success');
    });

    it('sets error status on api failure', async () => {
      mockApi.create.mockRejectedValue(new Error('Network error'));
      useOverridesStore.setState({ draftSources: { [COMPONENT_ID]: 'code' } });

      await useOverridesStore.getState().saveOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(useOverridesStore.getState().operations[COMPONENT_ID]?.status).toBe('error');
      expect(useOverridesStore.getState().operations[COMPONENT_ID]?.error).toBe('Network error');
    });
  });

  // ── saveOverride — update ─────────────────────────────────────────────

  describe('saveOverride (update)', () => {
    it('calls update when an override exists', async () => {
      const existing = makeOverride('active');
      const updated = makeOverride('draft');
      mockApi.update.mockResolvedValue(updated);
      useOverridesStore.setState({
        overrides: { [COMPONENT_ID]: existing },
        draftSources: { [COMPONENT_ID]: 'edited code' },
      });

      await useOverridesStore.getState().saveOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(mockApi.update).toHaveBeenCalledWith(TOKEN, WS_ID, COMPONENT_ID, {
        sourceCode: 'edited code',
      });
      expect(useOverridesStore.getState().overrides[COMPONENT_ID]).toEqual(updated);
    });
  });

  // ── compileOverride ───────────────────────────────────────────────────

  describe('compileOverride', () => {
    it('updates override to compiled result', async () => {
      const compiled = { ...makeOverride('active'), compiledCode: 'var x = 1;' };
      mockApi.compile.mockResolvedValue(compiled);

      await useOverridesStore.getState().compileOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(useOverridesStore.getState().overrides[COMPONENT_ID]).toEqual(compiled);
      expect(useOverridesStore.getState().operations[COMPONENT_ID]?.status).toBe('success');
    });
  });

  // ── revertOverride ────────────────────────────────────────────────────

  describe('revertOverride', () => {
    it('sets override to reverted state', async () => {
      const reverted = makeOverride('reverted');
      mockApi.revert.mockResolvedValue(reverted);

      await useOverridesStore.getState().revertOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(useOverridesStore.getState().overrides[COMPONENT_ID]?.status).toBe('reverted');
    });
  });

  // ── deleteOverride ────────────────────────────────────────────────────

  describe('deleteOverride', () => {
    it('removes override from state', async () => {
      mockApi.delete.mockResolvedValue(undefined);
      useOverridesStore.setState({ overrides: { [COMPONENT_ID]: makeOverride() } });

      await useOverridesStore.getState().deleteOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(useOverridesStore.getState().overrides[COMPONENT_ID]).toBeUndefined();
    });

    it('clears activeComponentId if it was the deleted component', async () => {
      mockApi.delete.mockResolvedValue(undefined);
      useOverridesStore.setState({
        overrides: { [COMPONENT_ID]: makeOverride() },
        activeComponentId: COMPONENT_ID,
      });

      await useOverridesStore.getState().deleteOverride(TOKEN, WS_ID, COMPONENT_ID);

      expect(useOverridesStore.getState().activeComponentId).toBeNull();
    });
  });

  // ── selectOverrideOp ──────────────────────────────────────────────────

  describe('selectOverrideOp', () => {
    it('returns idle when no operation tracked', () => {
      const op = selectOverrideOp({}, 'unknown');
      expect(op.status).toBe('idle');
    });

    it('returns the tracked operation', () => {
      const ops = { [COMPONENT_ID]: { status: 'pending' as const } };
      expect(selectOverrideOp(ops, COMPONENT_ID).status).toBe('pending');
    });
  });
});
