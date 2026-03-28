/**
 * status-bar-store.ts
 *
 * Zustand store for status bar state management.
 *
 * Aggregates status information from multiple sources:
 *   - Editor state: word count, character count, cursor position, view mode
 *   - Sync engine: sync status, connected peers
 *   - Plugin SDK: registered status items from plugins
 *
 * Design notes:
 *   - Store is NOT persisted — all status data is ephemeral.
 *   - Uses devtools for debugging.
 *   - Plugins register status items via the plugin SDK; this store merely
 *     holds the data structure for rendering.
 *   - Reading time is computed at render time from word count (not stored).
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EditorMode = 'edit' | 'preview' | 'source';

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error';

export interface CursorPosition {
  line: number;
  column: number;
}

export interface PluginStatusItem {
  /** Unique identifier for the status item (plugin-scoped). */
  id: string;
  /** Plugin ID that registered this item. */
  pluginId: string;
  /** Short label text shown in the status bar. */
  label: string;
  /** Optional tooltip text shown on hover. */
  tooltip?: string;
  /** Optional icon (SVG string or emoji). */
  icon?: string;
  /** Priority for ordering: higher = more to the left. Default 0. */
  priority: number;
  /** Optional click handler identifier (dispatched to plugin via postMessage). */
  onClick?: string;
}

export interface CollaboratorInfo {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  cursorColor: string;
}

interface StatusBarState {
  // Editor state
  wordCount: number;
  characterCount: number;
  cursorPosition: CursorPosition;
  editorMode: EditorMode;

  // Sync state
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;

  // Collaboration state
  collaborators: CollaboratorInfo[];

  // Plugin status items
  pluginStatusItems: PluginStatusItem[];

  // Actions
  setEditorStats: (wordCount: number, characterCount: number) => void;
  setCursorPosition: (position: CursorPosition) => void;
  setEditorMode: (mode: EditorMode) => void;
  setSyncStatus: (status: SyncStatus, error?: string | null) => void;
  setLastSyncedAt: (timestamp: string) => void;
  setCollaborators: (collaborators: CollaboratorInfo[]) => void;
  addCollaborator: (collaborator: CollaboratorInfo) => void;
  removeCollaborator: (userId: string) => void;
  registerPluginStatusItem: (item: PluginStatusItem) => void;
  unregisterPluginStatusItem: (id: string) => void;
  updatePluginStatusItem: (
    id: string,
    updates: Partial<Omit<PluginStatusItem, 'id' | 'pluginId'>>,
  ) => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_CURSOR: CursorPosition = { line: 1, column: 1 };

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useStatusBarStore = create<StatusBarState>()(
  devtools(
    (set) => ({
      // Initial state
      wordCount: 0,
      characterCount: 0,
      cursorPosition: INITIAL_CURSOR,
      editorMode: 'edit',
      syncStatus: 'synced',
      lastSyncedAt: null,
      syncError: null,
      collaborators: [],
      pluginStatusItems: [],

      // Actions
      setEditorStats: (wordCount, characterCount) =>
        set({ wordCount, characterCount }, false, 'statusBar/setEditorStats'),

      setCursorPosition: (cursorPosition) =>
        set({ cursorPosition }, false, 'statusBar/setCursorPosition'),

      setEditorMode: (editorMode) => set({ editorMode }, false, 'statusBar/setEditorMode'),

      setSyncStatus: (syncStatus, error = null) =>
        set({ syncStatus, syncError: error ?? null }, false, 'statusBar/setSyncStatus'),

      setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }, false, 'statusBar/setLastSyncedAt'),

      setCollaborators: (collaborators) =>
        set({ collaborators }, false, 'statusBar/setCollaborators'),

      addCollaborator: (collaborator) =>
        set(
          (state) => {
            // Prevent duplicates
            if (state.collaborators.some((c) => c.userId === collaborator.userId)) {
              return state;
            }
            return { collaborators: [...state.collaborators, collaborator] };
          },
          false,
          'statusBar/addCollaborator',
        ),

      removeCollaborator: (userId) =>
        set(
          (state) => ({
            collaborators: state.collaborators.filter((c) => c.userId !== userId),
          }),
          false,
          'statusBar/removeCollaborator',
        ),

      registerPluginStatusItem: (item) =>
        set(
          (state) => {
            // Replace existing item with same id or add new
            const filtered = state.pluginStatusItems.filter((i) => i.id !== item.id);
            const updated = [...filtered, item].sort((a, b) => b.priority - a.priority);
            return { pluginStatusItems: updated };
          },
          false,
          'statusBar/registerPluginStatus',
        ),

      unregisterPluginStatusItem: (id) =>
        set(
          (state) => ({
            pluginStatusItems: state.pluginStatusItems.filter((i) => i.id !== id),
          }),
          false,
          'statusBar/unregisterPluginStatus',
        ),

      updatePluginStatusItem: (id, updates) =>
        set(
          (state) => ({
            pluginStatusItems: state.pluginStatusItems.map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            ),
          }),
          false,
          'statusBar/updatePluginStatus',
        ),

      reset: () =>
        set(
          {
            wordCount: 0,
            characterCount: 0,
            cursorPosition: INITIAL_CURSOR,
            editorMode: 'edit',
            syncStatus: 'synced',
            lastSyncedAt: null,
            syncError: null,
            collaborators: [],
            pluginStatusItems: [],
          },
          false,
          'statusBar/reset',
        ),
    }),
    { name: 'StatusBarStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors / computed values
// ---------------------------------------------------------------------------

/**
 * Compute reading time from word count.
 * Average reading speed: 200 words per minute.
 */
export function computeReadingTime(wordCount: number): string {
  if (wordCount === 0) return '0 min';

  const minutes = Math.ceil(wordCount / 200);
  if (minutes < 1) return '< 1 min';
  return `${minutes} min`;
}

/**
 * Format cursor position for display.
 */
export function formatCursorPosition(position: CursorPosition): string {
  return `Ln ${position.line}, Col ${position.column}`;
}

/**
 * Get a human-readable label for the editor mode.
 */
export function formatEditorMode(mode: EditorMode): string {
  switch (mode) {
    case 'edit':
      return 'Editing';
    case 'preview':
      return 'Reading';
    case 'source':
      return 'Source';
  }
}

/**
 * Get a human-readable label for the sync status.
 */
export function formatSyncStatus(status: SyncStatus): string {
  switch (status) {
    case 'synced':
      return 'Synced';
    case 'syncing':
      return 'Syncing...';
    case 'offline':
      return 'Offline';
    case 'error':
      return 'Sync error';
  }
}
