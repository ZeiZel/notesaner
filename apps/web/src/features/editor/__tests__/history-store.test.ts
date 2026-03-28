/**
 * Tests for history-store.ts
 *
 * Covers:
 *   - pushEntry — adds entries, truncates redo stack, enforces max limit
 *   - undo — moves cursor back, returns undone entry
 *   - redo — moves cursor forward, returns redone entry
 *   - jumpTo — jumps to arbitrary position, clamps to valid range
 *   - clear — resets all state
 *   - Selectors: selectCanUndo, selectCanRedo, selectUndoEntry, selectRedoEntry,
 *     selectPastEntries, selectFutureEntries
 *   - describeContentChange — infers action descriptions from content changes
 *   - describeFormatAction — generates format action descriptions
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useHistoryStore,
  selectCanUndo,
  selectCanRedo,
  selectUndoEntry,
  selectRedoEntry,
  selectPastEntries,
  selectFutureEntries,
  describeContentChange,
  describeFormatAction,
} from '../model/history.store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  useHistoryStore.getState().clear();
}

function pushEntries(count: number): void {
  const store = useHistoryStore.getState();
  for (let i = 0; i < count; i++) {
    store.pushEntry(`Action ${i + 1}`, 'insert');
  }
}

function getState() {
  return useHistoryStore.getState();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useHistoryStore', () => {
  beforeEach(() => {
    resetStore();
  });

  // -------------------------------------------------------------------------
  // pushEntry
  // -------------------------------------------------------------------------

  describe('pushEntry', () => {
    it('should add an entry and advance cursor', () => {
      getState().pushEntry('Typed text', 'insert');

      const state = getState();
      expect(state.entries).toHaveLength(1);
      expect(state.cursor).toBe(0);
      expect(state.entries[0].description).toBe('Typed text');
      expect(state.entries[0].type).toBe('insert');
      expect(state.entries[0].id).toMatch(/^hist_/);
      expect(state.entries[0].timestamp).toBeGreaterThan(0);
    });

    it('should add multiple entries sequentially', () => {
      pushEntries(3);

      const state = getState();
      expect(state.entries).toHaveLength(3);
      expect(state.cursor).toBe(2);
      expect(state.entries[0].description).toBe('Action 1');
      expect(state.entries[2].description).toBe('Action 3');
    });

    it('should truncate redo stack when pushing after undo', () => {
      pushEntries(5);
      getState().undo();
      getState().undo();

      // Cursor is at 2 (entries 0,1,2 are past). Push new entry.
      getState().pushEntry('New action', 'insert');

      const state = getState();
      // Should have entries 0,1,2 + new = 4 entries. Entries 3,4 should be gone.
      expect(state.entries).toHaveLength(4);
      expect(state.cursor).toBe(3);
      expect(state.entries[3].description).toBe('New action');
    });

    it('should enforce maximum entries limit', () => {
      // Push 200 entries (the max)
      for (let i = 0; i < 200; i++) {
        getState().pushEntry(`Entry ${i + 1}`, 'insert');
      }
      expect(getState().entries).toHaveLength(200);

      // Push one more — oldest should be dropped
      getState().pushEntry('Entry 201', 'insert');
      expect(getState().entries).toHaveLength(200);
      // First entry should now be "Entry 2" (Entry 1 was dropped)
      expect(getState().entries[0].description).toBe('Entry 2');
      expect(getState().entries[199].description).toBe('Entry 201');
    });

    it('should store different action types', () => {
      getState().pushEntry('Formatted bold', 'format');
      getState().pushEntry('Deleted paragraph', 'delete');
      getState().pushEntry('Pasted text', 'paste');

      expect(getState().entries[0].type).toBe('format');
      expect(getState().entries[1].type).toBe('delete');
      expect(getState().entries[2].type).toBe('paste');
    });
  });

  // -------------------------------------------------------------------------
  // undo
  // -------------------------------------------------------------------------

  describe('undo', () => {
    it('should move cursor back and return undone entry', () => {
      pushEntries(3);

      const undone = getState().undo();
      expect(undone).not.toBeNull();
      expect(undone!.description).toBe('Action 3');
      expect(getState().cursor).toBe(1);
    });

    it('should return null when nothing to undo', () => {
      const undone = getState().undo();
      expect(undone).toBeNull();
      expect(getState().cursor).toBe(-1);
    });

    it('should return null when already fully undone', () => {
      pushEntries(2);
      getState().undo();
      getState().undo();

      const undone = getState().undo();
      expect(undone).toBeNull();
      expect(getState().cursor).toBe(-1);
    });

    it('should allow sequential undos', () => {
      pushEntries(3);

      getState().undo(); // cursor: 1
      getState().undo(); // cursor: 0
      getState().undo(); // cursor: -1

      expect(getState().cursor).toBe(-1);
      // Entries are still there (not deleted)
      expect(getState().entries).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // redo
  // -------------------------------------------------------------------------

  describe('redo', () => {
    it('should move cursor forward and return redone entry', () => {
      pushEntries(3);
      getState().undo();

      const redone = getState().redo();
      expect(redone).not.toBeNull();
      expect(redone!.description).toBe('Action 3');
      expect(getState().cursor).toBe(2);
    });

    it('should return null when nothing to redo', () => {
      pushEntries(3);

      const redone = getState().redo();
      expect(redone).toBeNull();
      expect(getState().cursor).toBe(2);
    });

    it('should return null when history is empty', () => {
      const redone = getState().redo();
      expect(redone).toBeNull();
    });

    it('should work after multiple undos', () => {
      pushEntries(3);
      getState().undo(); // cursor: 1
      getState().undo(); // cursor: 0
      getState().undo(); // cursor: -1

      const r1 = getState().redo();
      expect(r1!.description).toBe('Action 1');
      expect(getState().cursor).toBe(0);

      const r2 = getState().redo();
      expect(r2!.description).toBe('Action 2');
      expect(getState().cursor).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // jumpTo
  // -------------------------------------------------------------------------

  describe('jumpTo', () => {
    it('should jump to a specific index', () => {
      pushEntries(5);

      getState().jumpTo(2);
      expect(getState().cursor).toBe(2);
    });

    it('should jump to initial state (index -1)', () => {
      pushEntries(3);

      getState().jumpTo(-1);
      expect(getState().cursor).toBe(-1);
    });

    it('should clamp to valid range (lower bound)', () => {
      pushEntries(3);

      getState().jumpTo(-10);
      expect(getState().cursor).toBe(-1);
    });

    it('should clamp to valid range (upper bound)', () => {
      pushEntries(3);

      getState().jumpTo(100);
      expect(getState().cursor).toBe(2);
    });

    it('should jump forward from an undone state', () => {
      pushEntries(5);
      getState().undo();
      getState().undo();
      getState().undo();
      // cursor is at 1

      getState().jumpTo(4);
      expect(getState().cursor).toBe(4);
    });
  });

  // -------------------------------------------------------------------------
  // clear
  // -------------------------------------------------------------------------

  describe('clear', () => {
    it('should reset entries and cursor', () => {
      pushEntries(5);
      getState().undo();

      getState().clear();

      expect(getState().entries).toHaveLength(0);
      expect(getState().cursor).toBe(-1);
    });
  });

  // -------------------------------------------------------------------------
  // Selectors
  // -------------------------------------------------------------------------

  describe('selectors', () => {
    describe('selectCanUndo', () => {
      it('should return false when cursor is at -1', () => {
        expect(selectCanUndo(getState())).toBe(false);
      });

      it('should return true when cursor is >= 0', () => {
        pushEntries(1);
        expect(selectCanUndo(getState())).toBe(true);
      });

      it('should return false after all undone', () => {
        pushEntries(2);
        getState().undo();
        getState().undo();
        expect(selectCanUndo(getState())).toBe(false);
      });
    });

    describe('selectCanRedo', () => {
      it('should return false when at latest entry', () => {
        pushEntries(3);
        expect(selectCanRedo(getState())).toBe(false);
      });

      it('should return true after undo', () => {
        pushEntries(3);
        getState().undo();
        expect(selectCanRedo(getState())).toBe(true);
      });

      it('should return false when history is empty', () => {
        expect(selectCanRedo(getState())).toBe(false);
      });
    });

    describe('selectUndoEntry', () => {
      it('should return the entry at the cursor', () => {
        pushEntries(3);
        const entry = selectUndoEntry(getState());
        expect(entry!.description).toBe('Action 3');
      });

      it('should return null when cursor is -1', () => {
        expect(selectUndoEntry(getState())).toBeNull();
      });
    });

    describe('selectRedoEntry', () => {
      it('should return the next entry after cursor', () => {
        pushEntries(3);
        getState().undo();
        const entry = selectRedoEntry(getState());
        expect(entry!.description).toBe('Action 3');
      });

      it('should return null when at latest entry', () => {
        pushEntries(3);
        expect(selectRedoEntry(getState())).toBeNull();
      });
    });

    describe('selectPastEntries', () => {
      it('should return entries up to cursor in reverse order', () => {
        pushEntries(5);
        getState().undo();
        getState().undo();
        // cursor is at 2

        const past = selectPastEntries(getState());
        expect(past).toHaveLength(3);
        expect(past[0].description).toBe('Action 3'); // most recent first
        expect(past[2].description).toBe('Action 1');
      });

      it('should return empty array when cursor is -1', () => {
        expect(selectPastEntries(getState())).toHaveLength(0);
      });
    });

    describe('selectFutureEntries', () => {
      it('should return entries after cursor', () => {
        pushEntries(5);
        getState().undo();
        getState().undo();
        // cursor is at 2, entries 3,4 are future

        const future = selectFutureEntries(getState());
        expect(future).toHaveLength(2);
        expect(future[0].description).toBe('Action 4'); // next first
        expect(future[1].description).toBe('Action 5');
      });

      it('should return empty array when at latest', () => {
        pushEntries(3);
        expect(selectFutureEntries(getState())).toHaveLength(0);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Integration: undo-push-redo
  // -------------------------------------------------------------------------

  describe('undo-push integration', () => {
    it('should discard redo stack when new action is pushed after undo', () => {
      pushEntries(5);
      getState().undo(); // cursor 3
      getState().undo(); // cursor 2

      expect(selectCanRedo(getState())).toBe(true);

      getState().pushEntry('Branch action', 'insert');

      // Redo should no longer be available
      expect(selectCanRedo(getState())).toBe(false);
      expect(getState().entries).toHaveLength(4); // 0,1,2 + branch
      expect(getState().entries[3].description).toBe('Branch action');
    });
  });
});

// ---------------------------------------------------------------------------
// describeContentChange
// ---------------------------------------------------------------------------

describe('describeContentChange', () => {
  it('should describe a single character deletion', () => {
    const result = describeContentChange('delete', 'a');
    expect(result.description).toBe('Deleted "a"');
    expect(result.type).toBe('delete');
  });

  it('should describe a paragraph deletion', () => {
    const result = describeContentChange('delete', 'Line one\nLine two');
    expect(result.description).toBe('Deleted paragraph');
  });

  it('should describe a long text deletion', () => {
    const result = describeContentChange(
      'delete',
      'This is a fairly long piece of text that was deleted',
    );
    expect(result.description).toBe('Deleted text');
  });

  it('should describe a single character insert', () => {
    const result = describeContentChange('insert', 'a');
    expect(result.description).toBe('Typed character');
    expect(result.type).toBe('insert');
  });

  it('should describe multi-character insert as typed text', () => {
    const result = describeContentChange('insert', 'hello world');
    expect(result.description).toBe('Typed text');
  });

  it('should detect heading insertions', () => {
    const result = describeContentChange('insert', '## My Heading');
    expect(result.description).toBe('Added heading 2');
    expect(result.type).toBe('structure');
  });

  it('should detect list item insertions', () => {
    const result = describeContentChange('insert', '- List item');
    expect(result.description).toBe('Added list item');
    expect(result.type).toBe('structure');
  });

  it('should detect code block insertions', () => {
    const result = describeContentChange('insert', '```typescript\ncode\n```');
    expect(result.description).toBe('Added code block');
    expect(result.type).toBe('structure');
  });

  it('should detect blockquote insertions', () => {
    const result = describeContentChange('insert', '> A quote');
    expect(result.description).toBe('Added blockquote');
    expect(result.type).toBe('structure');
  });

  it('should detect horizontal rule insertions', () => {
    const result = describeContentChange('insert', '---');
    expect(result.description).toBe('Added horizontal rule');
    expect(result.type).toBe('structure');
  });

  it('should describe replacements', () => {
    const result = describeContentChange('replace', 'any');
    expect(result.description).toBe('Replaced text');
    expect(result.type).toBe('replace');
  });

  it('should describe empty deletion as deleted character', () => {
    const result = describeContentChange('delete', '');
    expect(result.description).toBe('Deleted character');
  });
});

// ---------------------------------------------------------------------------
// describeFormatAction
// ---------------------------------------------------------------------------

describe('describeFormatAction', () => {
  it('should describe known format actions', () => {
    expect(describeFormatAction('bold').description).toBe('Formatted bold');
    expect(describeFormatAction('italic').description).toBe('Formatted italic');
    expect(describeFormatAction('strikethrough').description).toBe('Formatted strikethrough');
    expect(describeFormatAction('code').description).toBe('Formatted as code');
    expect(describeFormatAction('link').description).toBe('Added link');
  });

  it('should handle unknown format actions gracefully', () => {
    const result = describeFormatAction('superscript');
    expect(result.description).toBe('Applied superscript');
    expect(result.type).toBe('format');
  });
});
