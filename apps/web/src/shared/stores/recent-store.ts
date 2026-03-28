// NOTE: Business store — recently opened notes. Zustand kept because:
//   - Recent notes list is persisted to localStorage so it survives page reloads.
//   - Auto-population on note open is domain logic (deduplication, max size).
//   - Cross-feature: consumed by sidebar panel, command palette, and quick switcher.
/**
 * recent-store.ts
 *
 * Zustand store for tracking recently opened notes.
 *
 * Each recent entry stores:
 *   - noteId: the unique note ID
 *   - title: display title
 *   - path: file path
 *   - openedAt: ISO timestamp of the most recent open
 *
 * Design notes:
 *   - Most recently opened note is at index 0.
 *   - Maximum 20 entries retained.
 *   - Deduplication: reopening a note moves it to the top.
 *   - Persisted to localStorage only (session/local state, not synced to server).
 *   - Cleared on workspace switch (different workspace = different file tree).
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_RECENT_NOTES = 20;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RecentNoteEntry {
  /** The note ID. */
  noteId: string;
  /** Display title of the note. */
  title: string;
  /** Full file path. */
  path: string;
  /** ISO timestamp of the most recent open. */
  openedAt: string;
}

interface RecentState {
  // State
  /** Most-recently-opened-first list of recent notes. */
  recentNotes: RecentNoteEntry[];
  /** The workspace ID these recents belong to. */
  workspaceId: string | null;

  // Actions
  /** Record a note as opened. Moves to top if already present. */
  addRecent: (noteId: string, title: string, path: string) => void;
  /** Remove a specific note from the recent list. */
  removeRecent: (noteId: string) => void;
  /** Update the title of a recent note (e.g. on rename). */
  updateRecentTitle: (noteId: string, title: string) => void;
  /** Update the path of a recent note (e.g. on move). */
  updateRecentPath: (noteId: string, path: string) => void;
  /** Clear all recent notes (e.g. on workspace switch). */
  clearAll: (newWorkspaceId?: string) => void;
  /** Set the workspace ID (clears recents if it changed). */
  setWorkspaceId: (workspaceId: string) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useRecentStore = create<RecentState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        recentNotes: [],
        workspaceId: null,

        addRecent: (noteId, title, path) =>
          set(
            (state) => {
              // Remove existing entry if present (will re-add at top)
              const filtered = state.recentNotes.filter((r) => r.noteId !== noteId);

              const entry: RecentNoteEntry = {
                noteId,
                title,
                path,
                openedAt: new Date().toISOString(),
              };

              // Prepend new entry, trim to max
              return {
                recentNotes: [entry, ...filtered].slice(0, MAX_RECENT_NOTES),
              };
            },
            false,
            'recent/add',
          ),

        removeRecent: (noteId) =>
          set(
            (state) => ({
              recentNotes: state.recentNotes.filter((r) => r.noteId !== noteId),
            }),
            false,
            'recent/remove',
          ),

        updateRecentTitle: (noteId, title) =>
          set(
            (state) => ({
              recentNotes: state.recentNotes.map((r) =>
                r.noteId === noteId ? { ...r, title } : r,
              ),
            }),
            false,
            'recent/updateTitle',
          ),

        updateRecentPath: (noteId, path) =>
          set(
            (state) => ({
              recentNotes: state.recentNotes.map((r) => (r.noteId === noteId ? { ...r, path } : r)),
            }),
            false,
            'recent/updatePath',
          ),

        clearAll: (newWorkspaceId) =>
          set(
            {
              recentNotes: [],
              workspaceId: newWorkspaceId ?? null,
            },
            false,
            'recent/clearAll',
          ),

        setWorkspaceId: (workspaceId) => {
          const current = get().workspaceId;
          if (current !== workspaceId) {
            // Different workspace — clear recents
            set({ recentNotes: [], workspaceId }, false, 'recent/setWorkspaceId');
          }
        },
      }),
      {
        name: 'notesaner-recent-notes',
        partialize: (state) => ({
          recentNotes: state.recentNotes,
          workspaceId: state.workspaceId,
        }),
      },
    ),
    { name: 'RecentStore' },
  ),
);
