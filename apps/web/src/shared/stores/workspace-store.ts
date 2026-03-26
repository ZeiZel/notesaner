import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

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
  activeWorkspace: WorkspaceDto | null;
  members: WorkspaceMemberDto[];
  activeNoteId: string | null;
  isLoading: boolean;

  // Actions
  setActiveWorkspace: (id: string) => void;
  setWorkspaces: (workspaces: WorkspaceDto[]) => void;
  updateWorkspace: (id: string, patch: Partial<WorkspaceDto>) => void;
  setMembers: (members: WorkspaceMemberDto[]) => void;
  setActiveNote: (noteId: string | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useWorkspaceStore = create<WorkspaceState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        activeWorkspaceId: null,
        workspaces: [],
        activeWorkspace: null,
        members: [],
        activeNoteId: null,
        isLoading: false,

        // Actions
        setActiveWorkspace: (id) => {
          const workspace = get().workspaces.find((w) => w.id === id) ?? null;
          set(
            { activeWorkspaceId: id, activeWorkspace: workspace },
            false,
            'workspace/setActiveWorkspace',
          );
        },

        setWorkspaces: (workspaces) => {
          const activeWorkspaceId = get().activeWorkspaceId;
          const activeWorkspace =
            workspaces.find((w) => w.id === activeWorkspaceId) ?? null;
          set(
            { workspaces, activeWorkspace },
            false,
            'workspace/setWorkspaces',
          );
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

        setMembers: (members) =>
          set({ members }, false, 'workspace/setMembers'),

        setActiveNote: (noteId) =>
          set({ activeNoteId: noteId }, false, 'workspace/setActiveNote'),

        setLoading: (isLoading) =>
          set({ isLoading }, false, 'workspace/setLoading'),
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
