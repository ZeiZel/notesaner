/**
 * note-state-store.ts
 *
 * Zustand store for tracking the currently active note and workspace context.
 *
 * Used primarily by sidebar panels (LocalGraph, Properties) that need
 * to know which note is currently open without prop-drilling.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { NoteDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Store state & actions
// ---------------------------------------------------------------------------

interface NoteStateStoreState {
  /** The currently active/open note, or null if none is open. */
  activeNote: NoteDto | null;

  /** The workspace ID for the currently active context. */
  activeWorkspaceId: string | null;

  /** Set the active note (called when a note is opened). */
  setActiveNote: (note: NoteDto | null) => void;

  /** Set the active workspace ID. */
  setActiveWorkspaceId: (workspaceId: string | null) => void;

  /** Clear the active note and workspace. */
  clearActiveNote: () => void;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useNoteStateStore = create<NoteStateStoreState>()(
  devtools(
    (set) => ({
      activeNote: null,
      activeWorkspaceId: null,

      setActiveNote: (note) => set({ activeNote: note }, false, 'noteState/setActiveNote'),

      setActiveWorkspaceId: (workspaceId) =>
        set({ activeWorkspaceId: workspaceId }, false, 'noteState/setActiveWorkspaceId'),

      clearActiveNote: () =>
        set({ activeNote: null, activeWorkspaceId: null }, false, 'noteState/clearActiveNote'),
    }),
    { name: 'NoteStateStore' },
  ),
);
