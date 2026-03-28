// NOTE: Business store — editor undo/redo history metadata. Not persisted
// (session-only by design). Domain logic includes stack management, cursor
// tracking, and content-change description inference.
/**
 * history-store.ts
 *
 * Zustand store tracking editor history actions for undo/redo visualization.
 *
 * This store maintains a list of human-readable action descriptions with
 * timestamps that mirror the editor's internal undo/redo stack. It provides:
 *
 *   - Action descriptions (e.g., "typed text", "formatted bold", "deleted paragraph")
 *   - Timestamps for each action
 *   - A cursor pointing to the current position in the history stack
 *   - Actions for pushing, undoing, redoing, and jumping to a specific point
 *
 * Design decisions:
 *   - Editor-engine agnostic: works with CodeMirror, TipTap, or any future editor.
 *   - The actual undo/redo is performed by the editor engine. This store only
 *     tracks the metadata for UI visualization.
 *   - Actions are debounced externally before being pushed (e.g., rapid typing
 *     is collapsed into a single "typed text" entry).
 *   - NOT persisted to localStorage — history is session-only.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Categories of editor actions for grouping and display. */
export type HistoryActionType =
  | 'insert'
  | 'delete'
  | 'format'
  | 'replace'
  | 'paste'
  | 'cut'
  | 'structure'
  | 'other';

/** A single recorded history entry. */
export interface HistoryEntry {
  /** Unique identifier for this entry. */
  id: string;
  /** Human-readable description of the action. */
  description: string;
  /** Category of the action for icon/styling purposes. */
  type: HistoryActionType;
  /** When the action occurred. */
  timestamp: number;
}

export interface HistoryState {
  /** All recorded history entries, oldest first. */
  entries: HistoryEntry[];

  /**
   * Index of the current position in the history stack.
   * Points to the last applied entry. -1 means no entries have been applied
   * (initial state / all undone).
   */
  cursor: number;

  // ---- Actions ----

  /** Push a new action onto the history stack. Truncates any redo entries. */
  pushEntry: (description: string, type: HistoryActionType) => void;

  /** Move the cursor back by one (undo). Returns the undone entry or null. */
  undo: () => HistoryEntry | null;

  /** Move the cursor forward by one (redo). Returns the redone entry or null. */
  redo: () => HistoryEntry | null;

  /** Jump to a specific point in history by entry index. */
  jumpTo: (index: number) => void;

  /** Clear all history entries and reset the cursor. */
  clear: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let entryIdCounter = 0;

function createEntryId(): string {
  entryIdCounter += 1;
  return `hist_${Date.now()}_${entryIdCounter}`;
}

/** Maximum number of history entries to retain. */
const MAX_HISTORY_ENTRIES = 200;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useHistoryStore = create<HistoryState>()(
  devtools(
    (set, get) => ({
      entries: [],
      cursor: -1,

      pushEntry: (description, type) => {
        const state = get();
        // Truncate any entries after the current cursor (discard redo stack).
        const truncated = state.entries.slice(0, state.cursor + 1);

        const newEntry: HistoryEntry = {
          id: createEntryId(),
          description,
          type,
          timestamp: Date.now(),
        };

        // Enforce max entries limit — drop oldest entries.
        const entries =
          truncated.length >= MAX_HISTORY_ENTRIES
            ? [...truncated.slice(truncated.length - MAX_HISTORY_ENTRIES + 1), newEntry]
            : [...truncated, newEntry];

        set({ entries, cursor: entries.length - 1 }, false, 'history/pushEntry');
      },

      undo: () => {
        const state = get();
        if (state.cursor < 0) return null;

        const undoneEntry = state.entries[state.cursor];
        set({ cursor: state.cursor - 1 }, false, 'history/undo');
        return undoneEntry ?? null;
      },

      redo: () => {
        const state = get();
        if (state.cursor >= state.entries.length - 1) return null;

        const redoneEntry = state.entries[state.cursor + 1];
        set({ cursor: state.cursor + 1 }, false, 'history/redo');
        return redoneEntry ?? null;
      },

      jumpTo: (index) => {
        const state = get();
        const clampedIndex = Math.max(-1, Math.min(index, state.entries.length - 1));
        set({ cursor: clampedIndex }, false, 'history/jumpTo');
      },

      clear: () => {
        set({ entries: [], cursor: -1 }, false, 'history/clear');
      },
    }),
    { name: 'HistoryStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Whether undo is available. */
export function selectCanUndo(state: HistoryState): boolean {
  return state.cursor >= 0;
}

/** Whether redo is available. */
export function selectCanRedo(state: HistoryState): boolean {
  return state.cursor < state.entries.length - 1;
}

/** The entry that would be undone next, or null. */
export function selectUndoEntry(state: HistoryState): HistoryEntry | null {
  if (state.cursor < 0) return null;
  return state.entries[state.cursor] ?? null;
}

/** The entry that would be redone next, or null. */
export function selectRedoEntry(state: HistoryState): HistoryEntry | null {
  if (state.cursor >= state.entries.length - 1) return null;
  return state.entries[state.cursor + 1] ?? null;
}

/** Entries in the "past" (applied), most recent first. */
export function selectPastEntries(state: HistoryState): HistoryEntry[] {
  if (state.cursor < 0) return [];
  return state.entries.slice(0, state.cursor + 1).reverse();
}

/** Entries in the "future" (can be redone), next first. */
export function selectFutureEntries(state: HistoryState): HistoryEntry[] {
  if (state.cursor >= state.entries.length - 1) return [];
  return state.entries.slice(state.cursor + 1);
}

// ---------------------------------------------------------------------------
// Action Description Helpers
// ---------------------------------------------------------------------------

/**
 * Infer a human-readable action description from an editor content change.
 * Used by the editor integration layer to translate low-level changes into
 * user-friendly descriptions.
 */
export function describeContentChange(
  changeType: 'insert' | 'delete' | 'replace',
  content: string,
): { description: string; type: HistoryActionType } {
  const trimmed = content.trim();

  if (changeType === 'delete') {
    if (trimmed.includes('\n')) {
      return { description: 'Deleted paragraph', type: 'delete' };
    }
    if (trimmed.length > 20) {
      return { description: 'Deleted text', type: 'delete' };
    }
    if (trimmed.length > 0) {
      return { description: `Deleted "${trimmed.slice(0, 20)}"`, type: 'delete' };
    }
    return { description: 'Deleted character', type: 'delete' };
  }

  if (changeType === 'replace') {
    return { description: 'Replaced text', type: 'replace' };
  }

  // Insert
  if (trimmed.startsWith('#')) {
    const level = trimmed.match(/^#{1,6}/)?.[0].length ?? 1;
    return { description: `Added heading ${level}`, type: 'structure' };
  }
  if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('+ ')) {
    return { description: 'Added list item', type: 'structure' };
  }
  if (trimmed.startsWith('```')) {
    return { description: 'Added code block', type: 'structure' };
  }
  if (trimmed.startsWith('>')) {
    return { description: 'Added blockquote', type: 'structure' };
  }
  if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
    return { description: 'Added horizontal rule', type: 'structure' };
  }
  if (trimmed.includes('\n')) {
    return { description: 'Typed text', type: 'insert' };
  }
  if (trimmed.length <= 1) {
    return { description: 'Typed character', type: 'insert' };
  }
  return { description: 'Typed text', type: 'insert' };
}

/**
 * Describe a formatting action.
 */
export function describeFormatAction(format: string): {
  description: string;
  type: HistoryActionType;
} {
  const formatLabels: Record<string, string> = {
    bold: 'Formatted bold',
    italic: 'Formatted italic',
    strikethrough: 'Formatted strikethrough',
    code: 'Formatted as code',
    link: 'Added link',
    underline: 'Formatted underline',
    highlight: 'Highlighted text',
  };

  return {
    description: formatLabels[format] ?? `Applied ${format}`,
    type: 'format',
  };
}
