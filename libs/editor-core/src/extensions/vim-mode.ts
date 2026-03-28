/**
 * VimMode — TipTap extension for Vim-style keybindings in the editor.
 *
 * Implements a subset of Vim keybindings directly via TipTap/ProseMirror
 * keyboard handling, without requiring an external Vim emulator library.
 *
 * Supported modes:
 * - Normal mode: cursor movement, deletion, copy/paste, commands
 * - Insert mode: standard text editing (transparent pass-through)
 * - Visual mode: selection-based operations
 *
 * Supported motions and commands:
 *
 * Normal mode:
 *   Movement: h, j, k, l, w, b, e, 0, $, gg, G, ^
 *   Editing:  x (delete char), dd (delete line), D (delete to end of line)
 *             yy (yank line), p (paste after), P (paste before)
 *             o (open line below), O (open line above)
 *             u (undo), Ctrl-r (redo)
 *             J (join lines)
 *   Mode switches: i (insert), a (append), A (append at end of line)
 *                   I (insert at line start), v (visual), V (visual line)
 *   Search: / (forward search — delegates to browser find)
 *
 * Insert mode:
 *   Escape, Ctrl-[ → return to normal mode
 *
 * Visual mode:
 *   All movement keys extend the selection
 *   d (delete selection), y (yank selection), c (change selection)
 *   Escape → return to normal mode
 *
 * The extension maintains vim state in a ProseMirror plugin and emits a
 * custom event (`vim-mode-change`) when the mode changes. The VimStatusLine
 * component listens for this event.
 *
 * Usage:
 * ```ts
 * import { VimMode } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   VimMode.configure({ enabled: true }),
 * ];
 * ```
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Vim editor modes. */
export type VimModeType = 'normal' | 'insert' | 'visual' | 'visual-line';

/** State tracked by the VimMode plugin. */
export interface VimState {
  mode: VimModeType;
  /** Accumulated key buffer for multi-key commands (e.g. 'dd', 'gg'). */
  keyBuffer: string;
  /** Internal yank register (clipboard). */
  register: string;
  /** Whether the register contains a full line (for line-wise paste). */
  registerIsLine: boolean;
  /** Numeric prefix for repeat counts (e.g. '3j' to move 3 lines). */
  count: number;
}

/** Options for the VimMode extension. */
export interface VimModeOptions {
  /**
   * Whether Vim mode is enabled. Defaults to false.
   * When false, the extension is inert and does not intercept any keys.
   */
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const VIM_MODE_PLUGIN_KEY = new PluginKey<VimState>('vimMode');

const INITIAL_VIM_STATE: VimState = {
  mode: 'normal',
  keyBuffer: '',
  register: '',
  registerIsLine: false,
  count: 0,
};

// ---------------------------------------------------------------------------
// Custom event name for mode changes
// ---------------------------------------------------------------------------

export const VIM_MODE_CHANGE_EVENT = 'vim-mode-change';

/** Dispatch a custom DOM event when the vim mode changes. */
function emitModeChange(view: EditorView, mode: VimModeType): void {
  const event = new CustomEvent(VIM_MODE_CHANGE_EVENT, {
    detail: { mode },
    bubbles: true,
  });
  view.dom.dispatchEvent(event);
}

// ---------------------------------------------------------------------------
// TipTap commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    vimMode: {
      /**
       * Toggle Vim mode on/off.
       */
      toggleVimMode: () => ReturnType;

      /**
       * Enable Vim mode.
       */
      enableVimMode: () => ReturnType;

      /**
       * Disable Vim mode and return to standard editing.
       */
      disableVimMode: () => ReturnType;

      /**
       * Get the current Vim mode. Useful for status line display.
       */
      getVimMode: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Movement helpers
// ---------------------------------------------------------------------------

/** Move the cursor left by one character. */
function moveLeft(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const pos = extend ? selection.head : selection.from;
  if (pos <= 0) return;
  const newPos = pos - 1;
  const sel = TextSelection.create(state.doc, extend ? selection.anchor : newPos, newPos);
  dispatch(state.tr.setSelection(sel));
}

/** Move the cursor right by one character. */
function moveRight(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const pos = extend ? selection.head : selection.to;
  if (pos >= state.doc.content.size) return;
  const newPos = pos + 1;
  const sel = TextSelection.create(state.doc, extend ? selection.anchor : newPos, newPos);
  dispatch(state.tr.setSelection(sel));
}

/** Move the cursor down by one line (approximate). */
function moveDown(view: EditorView, extend: boolean): void {
  // Use the built-in DOM-level cursor movement for accurate line navigation
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);

  // Find the end of the current block
  const currentBlockEnd = $pos.end($pos.depth);
  const afterPos = Math.min(currentBlockEnd + 1, state.doc.content.size);

  if (afterPos >= state.doc.content.size) return;

  const $after = state.doc.resolve(afterPos);
  // Move into the next block
  const nextBlockStart = $after.start($after.depth);
  const offset = Math.min($pos.parentOffset, $after.parent.content.size);
  const target = nextBlockStart + offset;

  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move the cursor up by one line (approximate). */
function moveUp(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);

  // Find the start of the current block
  const currentBlockStart = $pos.start($pos.depth);
  const beforePos = Math.max(currentBlockStart - 1, 0);

  if (beforePos <= 0) return;

  const $before = state.doc.resolve(beforePos);
  const prevBlockStart = $before.start($before.depth);
  const offset = Math.min($pos.parentOffset, $before.parent.content.size);
  const target = prevBlockStart + offset;

  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move to start of line (0). */
function moveToLineStart(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const lineStart = $pos.start($pos.depth);
  const sel = TextSelection.create(state.doc, extend ? selection.anchor : lineStart, lineStart);
  dispatch(state.tr.setSelection(sel));
}

/** Move to end of line ($). */
function moveToLineEnd(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const lineEnd = $pos.end($pos.depth);
  const sel = TextSelection.create(state.doc, extend ? selection.anchor : lineEnd, lineEnd);
  dispatch(state.tr.setSelection(sel));
}

/** Move to first non-whitespace character of line (^). */
function moveToFirstNonWhitespace(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const lineStart = $pos.start($pos.depth);
  const lineText = $pos.parent.textContent;
  const firstNonWs = lineText.search(/\S/);
  const target = lineStart + (firstNonWs >= 0 ? firstNonWs : 0);
  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move forward one word (w). */
function moveWordForward(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const text = state.doc.textBetween(selection.head, state.doc.content.size, ' ');

  // Find the next word boundary
  const match = /^(\s*\S+\s*)/.exec(text);
  const advance = match ? match[1].length : 1;
  const target = Math.min(selection.head + advance, state.doc.content.size);

  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move backward one word (b). */
function moveWordBackward(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const text = state.doc.textBetween(0, selection.head, ' ');

  // Find the previous word boundary
  const match = /(\s*\S+\s*)$/.exec(text);
  const retreat = match ? match[1].length : 1;
  const target = Math.max(selection.head - retreat, 0);

  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move to end of current word (e). */
function moveToEndOfWord(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const text = state.doc.textBetween(selection.head, state.doc.content.size, ' ');

  // Skip current character, then find the end of the next word
  const match = /^.(\s*\S*)/.exec(text);
  const advance = match ? match[0].length : 1;
  const target = Math.min(selection.head + advance, state.doc.content.size);

  const sel = TextSelection.create(state.doc, extend ? selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

/** Move to start of document (gg). */
function moveToDocStart(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const sel = TextSelection.create(state.doc, extend ? state.selection.anchor : 1, 1);
  dispatch(state.tr.setSelection(sel));
}

/** Move to end of document (G). */
function moveToDocEnd(view: EditorView, extend: boolean): void {
  const { state, dispatch } = view;
  const target = state.doc.content.size - 1;
  const sel = TextSelection.create(state.doc, extend ? state.selection.anchor : target, target);
  dispatch(state.tr.setSelection(sel));
}

// ---------------------------------------------------------------------------
// Editing helpers
// ---------------------------------------------------------------------------

/** Delete the character at the cursor (x). */
function deleteCharAtCursor(view: EditorView): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const pos = selection.from;
  if (pos >= state.doc.content.size) return;
  dispatch(state.tr.delete(pos, pos + 1));
}

/** Delete the current line (dd). */
function deleteLine(view: EditorView): string {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);

  // Find the block node at the current position
  const blockStart = $pos.start($pos.depth);
  const blockEnd = $pos.end($pos.depth);

  // Include the node boundaries
  const nodeBeforePos = $pos.before($pos.depth);
  const nodeAfterPos = $pos.after($pos.depth);

  const yanked = state.doc.textBetween(blockStart, blockEnd);
  dispatch(state.tr.delete(nodeBeforePos, nodeAfterPos));
  return yanked;
}

/** Delete from cursor to end of line (D). */
function deleteToLineEnd(view: EditorView): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const lineEnd = $pos.end($pos.depth);
  if (selection.head < lineEnd) {
    dispatch(state.tr.delete(selection.head, lineEnd));
  }
}

/** Yank (copy) the current line (yy). */
function yankLine(view: EditorView): string {
  const { state } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const blockStart = $pos.start($pos.depth);
  const blockEnd = $pos.end($pos.depth);
  return state.doc.textBetween(blockStart, blockEnd);
}

/** Paste text after cursor (p). */
function pasteAfter(view: EditorView, text: string, isLine: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;

  if (isLine) {
    const $pos = state.doc.resolve(selection.head);
    const blockEnd = $pos.after($pos.depth);
    const { tr } = state;
    // Insert a new paragraph with the text after the current block
    const newParagraph = state.schema.nodes['paragraph']?.create(null, [state.schema.text(text)]);
    if (newParagraph) {
      tr.insert(blockEnd, newParagraph);
      dispatch(tr);
    }
  } else {
    const { tr } = state;
    tr.insertText(text, selection.to);
    dispatch(tr);
  }
}

/** Paste text before cursor (P). */
function pasteBefore(view: EditorView, text: string, isLine: boolean): void {
  const { state, dispatch } = view;
  const { selection } = state;

  if (isLine) {
    const $pos = state.doc.resolve(selection.head);
    const blockStart = $pos.before($pos.depth);
    const { tr } = state;
    const newParagraph = state.schema.nodes['paragraph']?.create(null, [state.schema.text(text)]);
    if (newParagraph) {
      tr.insert(blockStart, newParagraph);
      dispatch(tr);
    }
  } else {
    const { tr } = state;
    tr.insertText(text, selection.from);
    dispatch(tr);
  }
}

/** Open a new line below and enter insert mode (o). */
function openLineBelow(view: EditorView): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const blockEnd = $pos.after($pos.depth);
  const { tr } = state;
  const newParagraph = state.schema.nodes['paragraph']?.create();
  if (newParagraph) {
    tr.insert(blockEnd, newParagraph);
    // Move cursor into the new paragraph
    const newPos = blockEnd + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));
    dispatch(tr);
  }
}

/** Open a new line above and enter insert mode (O). */
function openLineAbove(view: EditorView): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const blockStart = $pos.before($pos.depth);
  const { tr } = state;
  const newParagraph = state.schema.nodes['paragraph']?.create();
  if (newParagraph) {
    tr.insert(blockStart, newParagraph);
    // Move cursor into the new paragraph
    const newPos = blockStart + 1;
    tr.setSelection(TextSelection.create(tr.doc, newPos));
    dispatch(tr);
  }
}

/** Join the current line with the next one (J). */
function joinLines(view: EditorView): void {
  const { state, dispatch } = view;
  const { selection } = state;
  const $pos = state.doc.resolve(selection.head);
  const blockEnd = $pos.end($pos.depth);
  const afterBlock = $pos.after($pos.depth);

  // Check if there is a next block
  if (afterBlock >= state.doc.content.size) return;

  const nextBlock = state.doc.nodeAt(afterBlock);
  if (!nextBlock) return;

  const nextBlockText = nextBlock.textContent;
  const { tr } = state;

  // Delete the next block
  tr.delete(afterBlock, afterBlock + nextBlock.nodeSize);
  // Insert space + text at end of current line
  const insertText = nextBlockText ? ` ${nextBlockText}` : '';
  tr.insertText(insertText, blockEnd);
  dispatch(tr);
}

// ---------------------------------------------------------------------------
// Key handler for Normal mode
// ---------------------------------------------------------------------------

function handleNormalModeKey(
  view: EditorView,
  key: string,
  vimState: VimState,
  _event: KeyboardEvent,
): { handled: boolean; newState: Partial<VimState> } {
  const extend = false;

  // Handle digit keys for count prefix (except 0 which is line-start)
  if (/^[1-9]$/.test(key) && vimState.keyBuffer === '') {
    return {
      handled: true,
      newState: {
        count: vimState.count * 10 + parseInt(key, 10),
      },
    };
  }
  if (key === '0' && vimState.count > 0) {
    return {
      handled: true,
      newState: {
        count: vimState.count * 10,
      },
    };
  }

  const repeatCount = Math.max(vimState.count, 1);

  // Multi-key sequences
  const buffer = vimState.keyBuffer + key;

  // gg — go to document start
  if (buffer === 'gg') {
    moveToDocStart(view, false);
    return { handled: true, newState: { keyBuffer: '', count: 0 } };
  }

  // dd — delete line
  if (buffer === 'dd') {
    let yanked = '';
    for (let i = 0; i < repeatCount; i++) {
      yanked = deleteLine(view);
    }
    return {
      handled: true,
      newState: {
        keyBuffer: '',
        count: 0,
        register: yanked,
        registerIsLine: true,
      },
    };
  }

  // yy — yank line
  if (buffer === 'yy') {
    const yanked = yankLine(view);
    return {
      handled: true,
      newState: {
        keyBuffer: '',
        count: 0,
        register: yanked,
        registerIsLine: true,
      },
    };
  }

  // Partial match for multi-key sequences — buffer the key
  if (key === 'g' || key === 'd' || key === 'y') {
    if (vimState.keyBuffer === '') {
      return { handled: true, newState: { keyBuffer: key } };
    }
  }

  // Single-key commands — clear buffer on mismatch
  switch (key) {
    // --- Movement ---
    case 'h':
      for (let i = 0; i < repeatCount; i++) moveLeft(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'j':
      for (let i = 0; i < repeatCount; i++) moveDown(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'k':
      for (let i = 0; i < repeatCount; i++) moveUp(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'l':
      for (let i = 0; i < repeatCount; i++) moveRight(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'w':
      for (let i = 0; i < repeatCount; i++) moveWordForward(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'b':
      for (let i = 0; i < repeatCount; i++) moveWordBackward(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'e':
      for (let i = 0; i < repeatCount; i++) moveToEndOfWord(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case '0':
      moveToLineStart(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case '$':
      moveToLineEnd(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case '^':
      moveToFirstNonWhitespace(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'G':
      moveToDocEnd(view, extend);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    // --- Editing ---
    case 'x':
      for (let i = 0; i < repeatCount; i++) deleteCharAtCursor(view);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'D':
      deleteToLineEnd(view);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'p':
      pasteAfter(view, vimState.register, vimState.registerIsLine);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'P':
      pasteBefore(view, vimState.register, vimState.registerIsLine);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'o':
      openLineBelow(view);
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };

    case 'O':
      openLineAbove(view);
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };

    case 'J':
      joinLines(view);
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    case 'u':
      // Trigger undo via prosemirror-history
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const historyMod = require('@tiptap/pm/history') as {
          undo: (state: unknown, dispatch: unknown) => boolean;
        };
        for (let i = 0; i < repeatCount; i++) {
          historyMod.undo(view.state, view.dispatch);
        }
      } catch {
        // history plugin not available
      }
      return { handled: true, newState: { keyBuffer: '', count: 0 } };

    // --- Mode switches ---
    case 'i':
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };

    case 'a': {
      // Append: move cursor one position right and enter insert mode
      moveRight(view, false);
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };
    }

    case 'A':
      moveToLineEnd(view, false);
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };

    case 'I':
      moveToFirstNonWhitespace(view, false);
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: { mode: 'insert', keyBuffer: '', count: 0 },
      };

    case 'v':
      emitModeChange(view, 'visual');
      return {
        handled: true,
        newState: { mode: 'visual', keyBuffer: '', count: 0 },
      };

    case 'V':
      // Visual line: select the entire current line
      {
        const { state, dispatch } = view;
        const $pos = state.doc.resolve(state.selection.head);
        const lineStart = $pos.start($pos.depth);
        const lineEnd = $pos.end($pos.depth);
        dispatch(state.tr.setSelection(TextSelection.create(state.doc, lineStart, lineEnd)));
      }
      emitModeChange(view, 'visual-line');
      return {
        handled: true,
        newState: { mode: 'visual-line', keyBuffer: '', count: 0 },
      };

    default:
      // Unhandled key — clear buffer
      return { handled: false, newState: { keyBuffer: '', count: 0 } };
  }
}

// ---------------------------------------------------------------------------
// Key handler for Visual mode
// ---------------------------------------------------------------------------

function handleVisualModeKey(
  view: EditorView,
  key: string,
  vimState: VimState,
): { handled: boolean; newState: Partial<VimState> } {
  const extend = true;
  const repeatCount = Math.max(vimState.count, 1);

  // Escape — return to normal mode
  if (key === 'Escape') {
    // Collapse selection to cursor
    const { state, dispatch } = view;
    dispatch(state.tr.setSelection(TextSelection.create(state.doc, state.selection.head)));
    emitModeChange(view, 'normal');
    return { handled: true, newState: { mode: 'normal', keyBuffer: '', count: 0 } };
  }

  // Movement keys extend selection
  switch (key) {
    case 'h':
      for (let i = 0; i < repeatCount; i++) moveLeft(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'j':
      for (let i = 0; i < repeatCount; i++) moveDown(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'k':
      for (let i = 0; i < repeatCount; i++) moveUp(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'l':
      for (let i = 0; i < repeatCount; i++) moveRight(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'w':
      for (let i = 0; i < repeatCount; i++) moveWordForward(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'b':
      for (let i = 0; i < repeatCount; i++) moveWordBackward(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'e':
      for (let i = 0; i < repeatCount; i++) moveToEndOfWord(view, extend);
      return { handled: true, newState: { count: 0 } };
    case '0':
      moveToLineStart(view, extend);
      return { handled: true, newState: { count: 0 } };
    case '$':
      moveToLineEnd(view, extend);
      return { handled: true, newState: { count: 0 } };
    case '^':
      moveToFirstNonWhitespace(view, extend);
      return { handled: true, newState: { count: 0 } };
    case 'G':
      moveToDocEnd(view, extend);
      return { handled: true, newState: { count: 0 } };

    // --- Visual editing ---
    case 'd':
    case 'x': {
      // Delete selection
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      const yanked = state.doc.textBetween(from, to);
      dispatch(state.tr.delete(from, to));
      emitModeChange(view, 'normal');
      return {
        handled: true,
        newState: {
          mode: 'normal',
          register: yanked,
          registerIsLine: vimState.mode === 'visual-line',
          keyBuffer: '',
          count: 0,
        },
      };
    }

    case 'y': {
      // Yank selection
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      const yanked = state.doc.textBetween(from, to);
      // Collapse selection to start
      dispatch(state.tr.setSelection(TextSelection.create(state.doc, from)));
      emitModeChange(view, 'normal');
      return {
        handled: true,
        newState: {
          mode: 'normal',
          register: yanked,
          registerIsLine: vimState.mode === 'visual-line',
          keyBuffer: '',
          count: 0,
        },
      };
    }

    case 'c': {
      // Change: delete selection and enter insert mode
      const { state, dispatch } = view;
      const { from, to } = state.selection;
      const yanked = state.doc.textBetween(from, to);
      dispatch(state.tr.delete(from, to));
      emitModeChange(view, 'insert');
      return {
        handled: true,
        newState: {
          mode: 'insert',
          register: yanked,
          registerIsLine: false,
          keyBuffer: '',
          count: 0,
        },
      };
    }

    default:
      // Handle count digits
      if (/^[1-9]$/.test(key)) {
        return {
          handled: true,
          newState: { count: vimState.count * 10 + parseInt(key, 10) },
        };
      }
      return { handled: false, newState: { count: 0 } };
  }
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function createVimPlugin(initialEnabled: boolean): Plugin<VimState> {
  const enabled = initialEnabled;
  let vimState: VimState = { ...INITIAL_VIM_STATE };

  return new Plugin<VimState>({
    key: VIM_MODE_PLUGIN_KEY,

    state: {
      init(): VimState {
        return { ...INITIAL_VIM_STATE };
      },
      apply(_tr, prev): VimState {
        return prev;
      },
    },

    props: {
      handleKeyDown(view: EditorView, event: KeyboardEvent): boolean {
        if (!enabled) return false;

        const key = event.key;

        // --- Insert mode ---
        if (vimState.mode === 'insert') {
          // Escape or Ctrl-[ returns to normal mode
          if (key === 'Escape' || (key === '[' && event.ctrlKey)) {
            event.preventDefault();
            vimState = {
              ...vimState,
              mode: 'normal',
              keyBuffer: '',
              count: 0,
            };
            emitModeChange(view, 'normal');
            return true;
          }
          // Pass through all other keys in insert mode
          return false;
        }

        // --- Normal or Visual mode ---
        // Ignore modifier-only presses
        if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
          return false;
        }

        // Ctrl-r for redo in normal mode
        if (key === 'r' && event.ctrlKey && vimState.mode === 'normal') {
          event.preventDefault();
          try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const historyMod = require('@tiptap/pm/history') as {
              redo: (state: unknown, dispatch: unknown) => boolean;
            };
            historyMod.redo(view.state, view.dispatch);
          } catch {
            // history not available
          }
          return true;
        }

        // Prevent default browser handling for most keys in normal/visual mode
        event.preventDefault();

        let result: { handled: boolean; newState: Partial<VimState> };

        if (vimState.mode === 'visual' || vimState.mode === 'visual-line') {
          result = handleVisualModeKey(view, key, vimState);
        } else {
          result = handleNormalModeKey(view, key, vimState, event);
        }

        // Update state
        vimState = { ...vimState, ...result.newState };

        return result.handled;
      },
    },

    view() {
      return {
        update(view) {
          // On first mount, emit the initial mode if vim is enabled
          if (enabled) {
            emitModeChange(view, vimState.mode);
          }
        },
      };
    },
  });
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const VimMode = Extension.create<VimModeOptions>({
  name: 'vimMode',

  addOptions() {
    return {
      enabled: false,
    };
  },

  addProseMirrorPlugins() {
    return [createVimPlugin(this.options.enabled)];
  },

  addCommands() {
    return {
      toggleVimMode:
        () =>
        ({ editor }) => {
          const currentOptions = editor.extensionManager.extensions.find(
            (ext) => ext.name === 'vimMode',
          )?.options as VimModeOptions | undefined;

          if (currentOptions) {
            currentOptions.enabled = !currentOptions.enabled;
          }
          return true;
        },

      enableVimMode:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find((e) => e.name === 'vimMode');
          if (ext) {
            (ext.options as VimModeOptions).enabled = true;
          }
          return true;
        },

      disableVimMode:
        () =>
        ({ editor }) => {
          const ext = editor.extensionManager.extensions.find((e) => e.name === 'vimMode');
          if (ext) {
            (ext.options as VimModeOptions).enabled = false;
          }
          return true;
        },

      getVimMode: () => () => {
        // This is a query command; callers check state via the plugin key
        return true;
      },
    };
  },
});
