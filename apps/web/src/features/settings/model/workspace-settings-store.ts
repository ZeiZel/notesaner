/**
 * workspace-settings-store.ts
 *
 * Zustand store for workspace-level settings management.
 *
 * NOT persisted to localStorage -- workspace settings are authoritative
 * on the server and always fetched fresh.
 *
 * Provides:
 *   - Full workspace settings state
 *   - Async actions for fetch, save, delete, transfer
 *   - Debounced auto-save support via the `dirty` flag
 *   - Loading / saving / error states
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  workspaceSettingsApi,
  type WorkspaceSettingsDto,
  type UpdateWorkspaceGeneralPayload,
  type UpdateWorkspaceAppearancePayload,
  type UpdateWorkspacePublishPayload,
  type PublishedNoteDto,
} from '@/shared/api/workspace-settings';

// ---------------------------------------------------------------------------
// Store State
// ---------------------------------------------------------------------------

interface WorkspaceSettingsState {
  // ---- Data ----
  settings: WorkspaceSettingsDto | null;
  publishedNotes: PublishedNoteDto[];

  // ---- UI state ----
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // ---- Actions ----

  /** Fetch workspace settings from the server. */
  fetchSettings: (token: string, workspaceId: string) => Promise<void>;

  /** Update general settings (name, slug, description, icon). */
  updateGeneral: (
    token: string,
    workspaceId: string,
    payload: UpdateWorkspaceGeneralPayload,
  ) => Promise<void>;

  /** Update appearance settings (theme, CSS, sidebar). */
  updateAppearance: (
    token: string,
    workspaceId: string,
    payload: UpdateWorkspaceAppearancePayload,
  ) => Promise<void>;

  /** Update publish settings (isPublic, publicSlug). */
  updatePublish: (
    token: string,
    workspaceId: string,
    payload: UpdateWorkspacePublishPayload,
  ) => Promise<void>;

  /** Fetch published notes list. */
  fetchPublishedNotes: (token: string, workspaceId: string) => Promise<void>;

  /** Unpublish a specific note. */
  unpublishNote: (token: string, workspaceId: string, noteId: string) => Promise<void>;

  /** Transfer workspace ownership. */
  transferOwnership: (token: string, workspaceId: string, newOwnerId: string) => Promise<void>;

  /** Delete the workspace. */
  deleteWorkspace: (token: string, workspaceId: string) => Promise<void>;

  /** Clear error state. */
  clearError: () => void;

  /** Reset to initial state (on workspace change). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial State
// ---------------------------------------------------------------------------

const INITIAL_STATE = {
  settings: null as WorkspaceSettingsDto | null,
  publishedNotes: [] as PublishedNoteDto[],
  isLoading: false,
  isSaving: false,
  error: null as string | null,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkspaceSettingsStore = create<WorkspaceSettingsState>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      fetchSettings: async (token, workspaceId) => {
        set({ isLoading: true, error: null }, false, 'wsSettings/fetch/start');
        try {
          const settings = await workspaceSettingsApi.getSettings(token, workspaceId);
          set({ settings, isLoading: false }, false, 'wsSettings/fetch/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load settings';
          set({ error: message, isLoading: false }, false, 'wsSettings/fetch/error');
        }
      },

      updateGeneral: async (token, workspaceId, payload) => {
        set({ isSaving: true, error: null }, false, 'wsSettings/general/start');
        try {
          const settings = await workspaceSettingsApi.updateGeneral(token, workspaceId, payload);
          set({ settings, isSaving: false }, false, 'wsSettings/general/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save settings';
          set({ error: message, isSaving: false }, false, 'wsSettings/general/error');
          throw err;
        }
      },

      updateAppearance: async (token, workspaceId, payload) => {
        set({ isSaving: true, error: null }, false, 'wsSettings/appearance/start');
        try {
          const settings = await workspaceSettingsApi.updateAppearance(token, workspaceId, payload);
          set({ settings, isSaving: false }, false, 'wsSettings/appearance/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save appearance';
          set({ error: message, isSaving: false }, false, 'wsSettings/appearance/error');
          throw err;
        }
      },

      updatePublish: async (token, workspaceId, payload) => {
        set({ isSaving: true, error: null }, false, 'wsSettings/publish/start');
        try {
          const settings = await workspaceSettingsApi.updatePublish(token, workspaceId, payload);
          set({ settings, isSaving: false }, false, 'wsSettings/publish/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save publish settings';
          set({ error: message, isSaving: false }, false, 'wsSettings/publish/error');
          throw err;
        }
      },

      fetchPublishedNotes: async (token, workspaceId) => {
        try {
          const notes = await workspaceSettingsApi.getPublishedNotes(token, workspaceId);
          set({ publishedNotes: notes }, false, 'wsSettings/publishedNotes/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to load published notes';
          set({ error: message }, false, 'wsSettings/publishedNotes/error');
        }
      },

      unpublishNote: async (token, workspaceId, noteId) => {
        // Optimistic removal
        const prev = get().publishedNotes;
        set(
          (s) => ({
            publishedNotes: s.publishedNotes.filter((n) => n.id !== noteId),
          }),
          false,
          'wsSettings/unpublish/optimistic',
        );

        try {
          await workspaceSettingsApi.unpublishNote(token, workspaceId, noteId);
        } catch (err) {
          // Rollback
          set({ publishedNotes: prev }, false, 'wsSettings/unpublish/rollback');
          const message = err instanceof Error ? err.message : 'Failed to unpublish note';
          set({ error: message }, false, 'wsSettings/unpublish/error');
          throw err;
        }
      },

      transferOwnership: async (token, workspaceId, newOwnerId) => {
        set({ isSaving: true, error: null }, false, 'wsSettings/transfer/start');
        try {
          await workspaceSettingsApi.transferOwnership(token, workspaceId, {
            newOwnerId,
          });
          set({ isSaving: false }, false, 'wsSettings/transfer/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to transfer ownership';
          set({ error: message, isSaving: false }, false, 'wsSettings/transfer/error');
          throw err;
        }
      },

      deleteWorkspace: async (token, workspaceId) => {
        set({ isSaving: true, error: null }, false, 'wsSettings/delete/start');
        try {
          await workspaceSettingsApi.deleteWorkspace(token, workspaceId);
          set({ isSaving: false }, false, 'wsSettings/delete/success');
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to delete workspace';
          set({ error: message, isSaving: false }, false, 'wsSettings/delete/error');
          throw err;
        }
      },

      clearError: () => set({ error: null }, false, 'wsSettings/clearError'),

      reset: () => set({ ...INITIAL_STATE }, false, 'wsSettings/reset'),
    }),
    { name: 'WorkspaceSettingsStore' },
  ),
);
