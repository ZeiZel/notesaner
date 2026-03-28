/**
 * Keyboard shortcut definitions for Notesaner.
 *
 * Shortcuts are modeled as a declarative map so they can be:
 *  1. Rendered in a "keyboard shortcuts" help dialog
 *  2. Overridden per-user in settings (future)
 *  3. Consumed by useKeyboardShortcuts without scattered event listeners
 *
 * Modifier precedence (all must match):
 *   mod   → Cmd on macOS, Ctrl on Windows/Linux
 *   ctrl  → explicit Ctrl key (use sparingly; prefer mod)
 *   shift → Shift key
 *   alt   → Alt/Option key
 *
 * Editor-internal shortcuts (Bold, Italic, etc.) are handled by TipTap
 * extensions and are listed here as documentation only — they do NOT
 * register global listeners.
 */

/** A key combination that can trigger a shortcut. */
export interface KeyCombo {
  /** The key value (e.g. 'n', 'o', 'p', '[', ']', 'F'). Case-insensitive. */
  key: string;
  /** Platform-aware primary modifier: Cmd on macOS, Ctrl elsewhere. */
  mod?: boolean;
  /** Explicit Ctrl key (not platform-normalised). */
  ctrl?: boolean;
  /** Shift key. */
  shift?: boolean;
  /** Alt / Option key. */
  alt?: boolean;
}

/** Categories used to group shortcuts in the help UI. */
export type ShortcutCategory = 'navigation' | 'editor' | 'workspace' | 'search' | 'view' | 'plugin';

/**
 * A fully-described keyboard shortcut.
 *
 * `scope` determines where the shortcut fires:
 *  - 'global'  → always active when the window has focus
 *  - 'editor'  → only when the TipTap editor is focused (handled by TipTap,
 *                not by the global listener)
 */
export interface KeyboardShortcut {
  /** Unique action identifier. */
  id: string;
  /** Human-readable label for the shortcuts reference panel. */
  label: string;
  /** Grouping for display purposes. */
  category: ShortcutCategory;
  /** Key combination that fires this shortcut. */
  combo: KeyCombo;
  /**
   * 'global'  → registered by useKeyboardShortcuts as a window listener.
   * 'editor'  → handled inside the TipTap editor; listed for documentation only.
   */
  scope: 'global' | 'editor';
}

// ---------------------------------------------------------------------------
// Shortcut registry
// ---------------------------------------------------------------------------

/**
 * All keyboard shortcuts, in Obsidian-compatible order where applicable.
 *
 * Obsidian reference:
 *  Cmd+N  = New note
 *  Cmd+O  = Quick switcher
 *  Cmd+P  = Command palette
 *  Cmd+S  = Save note
 *  Cmd+F  = Find in note
 *  Cmd+H  = Find & replace in note
 *  Cmd+E  = Toggle reading view
 *  Cmd+[  = Navigate back
 *  Cmd+]  = Navigate forward
 *  Cmd+Shift+F = Global search
 *  Cmd+B  = Bold (editor)
 *  Cmd+I  = Italic (editor)
 *  Cmd+U  = Underline (editor)
 *  Cmd+K  = Insert link (editor)
 *  Cmd+1..6 = Headings (editor)
 *  Cmd+Z  = Undo (editor)
 *  Cmd+Shift+Z = Redo (editor)
 */
export const KEYBOARD_SHORTCUTS = [
  // --- Workspace / navigation ---
  {
    id: 'new-note',
    label: 'New note',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'n', mod: true },
  },
  {
    id: 'quick-switcher',
    label: 'Quick switcher',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'o', mod: true },
  },
  {
    id: 'command-palette',
    label: 'Command palette',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'p', mod: true },
  },
  {
    id: 'save-note',
    label: 'Save note',
    category: 'workspace',
    scope: 'global',
    combo: { key: 's', mod: true },
  },
  {
    id: 'global-search',
    label: 'Search in all notes',
    category: 'search',
    scope: 'global',
    combo: { key: 'f', mod: true, shift: true },
  },
  {
    id: 'global-search-replace',
    label: 'Search & replace in all notes',
    category: 'search',
    scope: 'global',
    combo: { key: 'h', mod: true, shift: true },
  },
  {
    id: 'toggle-left-sidebar',
    label: 'Toggle left sidebar',
    category: 'view',
    scope: 'global',
    combo: { key: '[', mod: true },
  },
  {
    id: 'toggle-right-sidebar',
    label: 'Toggle right sidebar',
    category: 'view',
    scope: 'global',
    combo: { key: ']', mod: true },
  },
  {
    id: 'find-in-note',
    label: 'Find in note',
    category: 'search',
    scope: 'global',
    combo: { key: 'f', mod: true },
  },
  {
    id: 'find-replace',
    label: 'Find & replace in note',
    category: 'search',
    scope: 'global',
    combo: { key: 'h', mod: true },
  },
  {
    id: 'toggle-source-preview',
    label: 'Cycle edit mode (WYSIWYG / Source / Live Preview)',
    category: 'editor',
    scope: 'global',
    combo: { key: 'e', mod: true },
  },
  {
    id: 'toggle-reading-mode',
    label: 'Toggle reading mode',
    category: 'editor',
    scope: 'global',
    combo: { key: 'e', mod: true, shift: true },
  },
  {
    id: 'quick-capture',
    label: 'Quick capture',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'n', mod: true, shift: true },
  },
  {
    id: 'workspace-switcher',
    label: 'Open workspace switcher',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'w', mod: true, shift: true },
  },
  // --- Navigation history ---
  {
    id: 'navigate-back',
    label: 'Navigate back',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'ArrowLeft', alt: true },
  },
  {
    id: 'navigate-forward',
    label: 'Navigate forward',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'ArrowRight', alt: true },
  },
  // --- Split pane ---
  {
    id: 'split-pane-horizontal',
    label: 'Split pane side-by-side',
    category: 'workspace',
    scope: 'global',
    combo: { key: '\\', mod: true },
  },
  {
    id: 'split-pane-vertical',
    label: 'Split pane top-bottom',
    category: 'workspace',
    scope: 'global',
    combo: { key: '\\', mod: true, shift: true },
  },
  {
    id: 'close-tab',
    label: 'Close active tab',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'w', mod: true },
  },
  {
    id: 'cycle-tab-forward',
    label: 'Next tab',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'Tab', mod: true },
  },
  {
    id: 'cycle-tab-backward',
    label: 'Previous tab',
    category: 'navigation',
    scope: 'global',
    combo: { key: 'Tab', mod: true, shift: true },
  },
  {
    id: 'toggle-theme',
    label: 'Toggle dark/light theme',
    category: 'view',
    scope: 'global',
    combo: { key: 'd', mod: true, shift: true },
  },
  // --- Panel controls ---
  {
    id: 'toggle-maximize-pane',
    label: 'Toggle maximize focused pane',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'm', mod: true, shift: true },
  },
  {
    id: 'toggle-minimize-pane',
    label: 'Toggle minimize focused pane',
    category: 'workspace',
    scope: 'global',
    combo: { key: '.', mod: true, shift: true },
  },
  // --- Favorites ---
  {
    id: 'toggle-favorite',
    label: 'Toggle favorite / bookmark',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'b', mod: true, shift: true },
  },
  // --- Clipboard ---
  {
    id: 'copy-note-path',
    label: 'Copy note path',
    category: 'workspace',
    scope: 'global',
    combo: { key: 'c', mod: true, shift: true },
  },
  // --- Shortcut cheatsheet ---
  {
    id: 'shortcut-cheatsheet',
    label: 'Show keyboard shortcut reference',
    category: 'navigation',
    scope: 'global',
    combo: { key: '/', mod: true },
  },
  // --- Editor-internal (TipTap handles these; listed for help panel only) ---
  {
    id: 'bold',
    label: 'Bold',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'b', mod: true },
  },
  {
    id: 'italic',
    label: 'Italic',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'i', mod: true },
  },
  {
    id: 'underline',
    label: 'Underline',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'u', mod: true },
  },
  {
    id: 'code-inline',
    label: 'Inline code',
    category: 'editor',
    scope: 'editor',
    // Cmd+` (backtick)
    combo: { key: '`', mod: true },
  },
  {
    id: 'insert-link',
    label: 'Insert link',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'k', mod: true },
  },
  {
    id: 'heading-1',
    label: 'Heading 1',
    category: 'editor',
    scope: 'editor',
    combo: { key: '1', mod: true },
  },
  {
    id: 'heading-2',
    label: 'Heading 2',
    category: 'editor',
    scope: 'editor',
    combo: { key: '2', mod: true },
  },
  {
    id: 'heading-3',
    label: 'Heading 3',
    category: 'editor',
    scope: 'editor',
    combo: { key: '3', mod: true },
  },
  {
    id: 'heading-4',
    label: 'Heading 4',
    category: 'editor',
    scope: 'editor',
    combo: { key: '4', mod: true },
  },
  {
    id: 'heading-5',
    label: 'Heading 5',
    category: 'editor',
    scope: 'editor',
    combo: { key: '5', mod: true },
  },
  {
    id: 'heading-6',
    label: 'Heading 6',
    category: 'editor',
    scope: 'editor',
    combo: { key: '6', mod: true },
  },
  {
    id: 'undo',
    label: 'Undo',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'z', mod: true },
  },
  {
    id: 'redo',
    label: 'Redo',
    category: 'editor',
    scope: 'editor',
    combo: { key: 'z', mod: true, shift: true },
  },
] as const satisfies readonly KeyboardShortcut[];

/** Type of all shortcut action IDs derived from the registry. */
export type ShortcutId = (typeof KEYBOARD_SHORTCUTS)[number]['id'];

/**
 * Returns true if the keyboard event matches the given key combo.
 *
 * 'mod' is treated as Cmd (metaKey) on macOS and Ctrl (ctrlKey) elsewhere.
 * This function is intentionally pure and has no browser side-effects.
 */
export function matchesCombo(event: KeyboardEvent, combo: KeyCombo): boolean {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  const modPressed = isMac ? event.metaKey : event.ctrlKey;

  const modRequired = combo.mod === true;
  const ctrlRequired = combo.ctrl === true;
  const shiftRequired = combo.shift === true;
  const altRequired = combo.alt === true;

  // Modifier checks
  if (modRequired && !modPressed) return false;
  if (!modRequired && combo.mod !== undefined && modPressed) return false;

  if (ctrlRequired && !event.ctrlKey) return false;
  if (!ctrlRequired && combo.ctrl !== undefined && event.ctrlKey) return false;

  if (shiftRequired !== event.shiftKey) return false;
  if (altRequired !== event.altKey) return false;

  // Key check — normalize to lower case
  return event.key.toLowerCase() === combo.key.toLowerCase();
}

/**
 * Returns the global shortcuts from the registry (scope === 'global').
 * These are the shortcuts managed by useKeyboardShortcuts.
 */
export function getGlobalShortcuts(): readonly KeyboardShortcut[] {
  return KEYBOARD_SHORTCUTS.filter((s) => s.scope === 'global');
}

/**
 * Formats a KeyCombo into a human-readable string (e.g. "⌘⇧F").
 * Uses Unicode symbols on macOS, text labels elsewhere.
 */
export function formatCombo(combo: KeyCombo): string {
  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  const parts: string[] = [];

  if (combo.mod) parts.push(isMac ? '⌘' : 'Ctrl');
  if (combo.ctrl) parts.push('Ctrl');
  if (combo.shift) parts.push(isMac ? '⇧' : 'Shift');
  if (combo.alt) parts.push(isMac ? '⌥' : 'Alt');

  const key = combo.key === ' ' ? 'Space' : combo.key.toUpperCase();
  parts.push(key);

  return isMac ? parts.join('') : parts.join('+');
}
