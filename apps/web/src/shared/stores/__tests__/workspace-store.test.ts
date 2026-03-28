/**
 * Tests for workspace-store.ts
 *
 * Covers:
 *   - fetchWorkspaces — happy path, error, auto-select when active removed
 *   - switchWorkspace — happy path, error, no-op for same workspace
 *   - setActiveWorkspace — updates role from summaries
 *   - clearError — resets error field
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useWorkspaceStore } from '../workspace-store';

// Mock the workspaces API
vi.mock('@/shared/api/workspaces', () => ({
  workspacesApi: {
    listWorkspaces: vi.fn(),
    switchWorkspace: vi.fn(),
  },
}));

import { workspacesApi } from '@/shared/api/workspaces';

const mockListWorkspaces = workspacesApi.listWorkspaces as ReturnType<typeof vi.fn>;
const mockSwitchWorkspace = workspacesApi.switchWorkspace as ReturnType<typeof vi.fn>;

describe('WorkspaceStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the Zustand store between tests
    useWorkspaceStore.setState({
      activeWorkspaceId: null,
      workspaces: [],
      workspaceSummaries: [],
      activeWorkspace: null,
      activeWorkspaceRole: null,
      members: [],
      activeNoteId: null,
      isLoading: false,
      isSwitching: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // fetchWorkspaces
  // -----------------------------------------------------------------------

  describe('fetchWorkspaces', () => {
    it('should fetch and store workspace summaries', async () => {
      const summaries = [
        {
          id: 'ws-1',
          name: 'Workspace A',
          slug: 'workspace-a',
          description: null,
          isPublic: false,
          role: 'OWNER',
          memberCount: 3,
          noteCount: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
      ];

      mockListWorkspaces.mockResolvedValue(summaries);

      await useWorkspaceStore.getState().fetchWorkspaces('token-123');

      const state = useWorkspaceStore.getState();
      expect(state.workspaceSummaries).toHaveLength(1);
      expect(state.workspaceSummaries[0]!.name).toBe('Workspace A');
      expect(state.workspaces).toHaveLength(1);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should set error on failure', async () => {
      mockListWorkspaces.mockRejectedValue(new Error('Network error'));

      await expect(useWorkspaceStore.getState().fetchWorkspaces('token-123')).rejects.toThrow(
        'Network error',
      );

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Network error');
      expect(state.isLoading).toBe(false);
    });

    it('should auto-select first workspace when active workspace is removed', async () => {
      // Set up state with an active workspace that will not be in the new list
      useWorkspaceStore.setState({ activeWorkspaceId: 'ws-removed' });

      const summaries = [
        {
          id: 'ws-new',
          name: 'New Workspace',
          slug: 'new',
          description: null,
          isPublic: false,
          role: 'EDITOR',
          memberCount: 1,
          noteCount: 0,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
      ];

      mockListWorkspaces.mockResolvedValue(summaries);

      await useWorkspaceStore.getState().fetchWorkspaces('token-123');

      const state = useWorkspaceStore.getState();
      expect(state.activeWorkspaceId).toBe('ws-new');
      expect(state.activeWorkspaceRole).toBe('EDITOR');
    });
  });

  // -----------------------------------------------------------------------
  // switchWorkspace
  // -----------------------------------------------------------------------

  describe('switchWorkspace', () => {
    it('should switch to a new workspace', async () => {
      mockSwitchWorkspace.mockResolvedValue({
        workspace: {
          id: 'ws-2',
          name: 'Workspace B',
          slug: 'workspace-b',
          description: 'Team workspace',
          isPublic: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-03-28T00:00:00.000Z',
        },
        membership: {
          role: 'ADMIN',
          joinedAt: '2026-02-01T00:00:00.000Z',
        },
      });

      await useWorkspaceStore.getState().switchWorkspace('token-123', 'ws-2');

      const state = useWorkspaceStore.getState();
      expect(state.activeWorkspaceId).toBe('ws-2');
      expect(state.activeWorkspace?.name).toBe('Workspace B');
      expect(state.activeWorkspaceRole).toBe('ADMIN');
      expect(state.activeNoteId).toBeNull(); // reset on switch
      expect(state.isSwitching).toBe(false);
    });

    it('should not switch to the same workspace', async () => {
      useWorkspaceStore.setState({ activeWorkspaceId: 'ws-1' });

      await useWorkspaceStore.getState().switchWorkspace('token-123', 'ws-1');

      expect(mockSwitchWorkspace).not.toHaveBeenCalled();
    });

    it('should set error on switch failure', async () => {
      mockSwitchWorkspace.mockRejectedValue(new Error('Forbidden'));

      await expect(
        useWorkspaceStore.getState().switchWorkspace('token-123', 'ws-bad'),
      ).rejects.toThrow('Forbidden');

      const state = useWorkspaceStore.getState();
      expect(state.error).toBe('Forbidden');
      expect(state.isSwitching).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // setActiveWorkspace
  // -----------------------------------------------------------------------

  describe('setActiveWorkspace', () => {
    it('should set active workspace and derive role from summaries', () => {
      useWorkspaceStore.setState({
        workspaces: [
          {
            id: 'ws-1',
            name: 'WS',
            slug: 'ws',
            description: null,
            avatarUrl: null,
            ownerId: '',
            createdAt: '',
            updatedAt: '',
          },
        ],
        workspaceSummaries: [
          {
            id: 'ws-1',
            name: 'WS',
            slug: 'ws',
            description: null,
            isPublic: false,
            role: 'VIEWER',
            memberCount: 1,
            noteCount: 0,
            createdAt: '',
            updatedAt: '',
          },
        ],
      });

      useWorkspaceStore.getState().setActiveWorkspace('ws-1');

      const state = useWorkspaceStore.getState();
      expect(state.activeWorkspaceId).toBe('ws-1');
      expect(state.activeWorkspaceRole).toBe('VIEWER');
    });
  });

  // -----------------------------------------------------------------------
  // clearError
  // -----------------------------------------------------------------------

  describe('clearError', () => {
    it('should reset error to null', () => {
      useWorkspaceStore.setState({ error: 'Some error' });

      useWorkspaceStore.getState().clearError();

      expect(useWorkspaceStore.getState().error).toBeNull();
    });
  });
});
