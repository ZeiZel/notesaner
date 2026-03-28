import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { workspacesApi } from '@/shared/api/workspaces';
import type { WorkspaceSummaryDto } from '@/shared/api/workspaces';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  avatarUrl: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMemberDto {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  displayName: string;
  avatarUrl: string | null;
}

interface WorkspaceState {
  // State
  activeWorkspaceId: string | null;
  workspaces: WorkspaceDto[];
  /** Enriched workspace list with role and stats from the server. */
  workspaceSummaries: WorkspaceSummaryDto[];
  activeWorkspace: WorkspaceDto | null;
  /** Current user's role in the active workspace. */
  activeWorkspaceRole: string | null;
  members: WorkspaceMemberDto[];
  activeNoteId: string | null;
  isLoading: boolean;
  isSwitching: boolean;
  error: string | null;

  // Actions
  setActiveWorkspace: (id: string) => void;
  setWorkspaces: (workspaces: WorkspaceDto[]) => void;
  updateWorkspace: (id: string, patch: Partial<WorkspaceDto>) => void;
  setMembers: (members: WorkspaceMemberDto[]) => void;
  setActiveNote: (noteId: string | null) => void;
  setLoading: (loading: boolean) => void;

  /** Fetch all workspaces the user belongs to from the server. */
  fetchWorkspaces: (token: string) => Promise<void>;

  /**
   * Switch to a different workspace. Validates membership via server call
   * and updates all workspace-related state.
   */
  switchWorkspace: (token: string, workspaceId: string) => Promise<void>;

  /** Clear error state. */
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
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

        // Actions
        setActiveWorkspace: (id) => {
          const workspace = get().workspaces.find((w) => w.id === id) ?? null;
          const summary = get().workspaceSummaries.find((w) => w.id === id);
          set(
            {
              activeWorkspaceId: id,
              activeWorkspace: workspace,
              activeWorkspaceRole: summary?.role ?? null,
            },
            false,
            'workspace/setActiveWorkspace',
          );
        },

        setWorkspaces: (workspaces) => {
          const activeWorkspaceId = get().activeWorkspaceId;
          const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
          set({ workspaces, activeWorkspace }, false, 'workspace/setWorkspaces');
        },

        updateWorkspace: (id, patch) =>
          set(
            (state) => {
              const workspaces = state.workspaces.map((w) =>
                w.id === id ? { ...w, ...patch } : w,
              );
              const activeWorkspace =
                state.activeWorkspaceId === id && state.activeWorkspace !== null
                  ? { ...state.activeWorkspace, ...patch }
                  : state.activeWorkspace;
              return { workspaces, activeWorkspace };
            },
            false,
            'workspace/updateWorkspace',
          ),

        setMembers: (members) => set({ members }, false, 'workspace/setMembers'),

        setActiveNote: (noteId) => set({ activeNoteId: noteId }, false, 'workspace/setActiveNote'),

        setLoading: (isLoading) => set({ isLoading }, false, 'workspace/setLoading'),

        fetchWorkspaces: async (token) => {
          set({ isLoading: true, error: null }, false, 'workspace/fetchWorkspaces/start');
          try {
            const summaries = await workspacesApi.listWorkspaces(token);
            const workspaces: WorkspaceDto[] = summaries.map((s) => ({
              id: s.id,
              name: s.name,
              slug: s.slug,
              description: s.description,
              avatarUrl: null,
              ownerId: '',
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            }));

            const currentActiveId = get().activeWorkspaceId;
            const stillExists = summaries.some((s) => s.id === currentActiveId);

            set(
              {
                workspaceSummaries: summaries,
                workspaces,
                isLoading: false,
                // If the active workspace was removed, auto-select the first one
                ...(currentActiveId && !stillExists && summaries.length > 0 && summaries[0]
                  ? {
                      activeWorkspaceId: summaries[0].id,
                      activeWorkspace: workspaces[0] ?? null,
                      activeWorkspaceRole: summaries[0].role,
                    }
                  : {}),
              },
              false,
              'workspace/fetchWorkspaces/success',
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load workspaces';
            set({ error: message, isLoading: false }, false, 'workspace/fetchWorkspaces/error');
            throw err;
          }
        },

        switchWorkspace: async (token, workspaceId) => {
          if (get().activeWorkspaceId === workspaceId) return;

          set({ isSwitching: true, error: null }, false, 'workspace/switch/start');
          try {
            const result = await workspacesApi.switchWorkspace(token, workspaceId);

            const workspaceDto: WorkspaceDto = {
              id: result.workspace.id,
              name: result.workspace.name,
              slug: result.workspace.slug,
              description: result.workspace.description,
              avatarUrl: null,
              ownerId: '',
              createdAt: result.workspace.createdAt,
              updatedAt: result.workspace.updatedAt,
            };

            set(
              {
                activeWorkspaceId: workspaceId,
                activeWorkspace: workspaceDto,
                activeWorkspaceRole: result.membership.role,
                activeNoteId: null, // Reset active note on workspace switch
                isSwitching: false,
              },
              false,
              'workspace/switch/success',
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to switch workspace';
            set({ error: message, isSwitching: false }, false, 'workspace/switch/error');
            throw err;
          }
        },

        clearError: () => set({ error: null }, false, 'workspace/clearError'),
      }),
      {
        name: 'notesaner-workspace',
        partialize: (state) => ({
          activeWorkspaceId: state.activeWorkspaceId,
          activeNoteId: state.activeNoteId,
        }),
      },
    ),
    { name: 'WorkspaceStore' },
  ),
);
