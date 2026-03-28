/**
 * editor-mode-store.ts
 *
 * Zustand store managing the active editor mode.
 *
 * Modes:
 *   - wysiwyg:  Default TipTap rich-text editor.
 *   - source:   Plain CodeMirror editor with Markdown syntax highlighting.
 *   - preview:  Live Preview — split view with source on the left and rendered
 *               preview on the right, updated in real-time.
 *   - reading:  Read-only rendered HTML with reader-optimized typography.
 *
 * Lifecycle:
 *   - Mode switching is synchronous and persisted to localStorage.
 *   - Content is synced between modes via a shared markdown string.
 *   - The `cycleEditMode()` action cycles: wysiwyg -> source -> preview -> wysiwyg.
 *   - The `toggleReadingMode()` action toggles between reading and the last
 *     active edit mode.
 *
 * Reading mode settings (font, line-height, width) are separate from the editor
 * settings in settings-store.ts — they are reader-specific typography overrides.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The three editing modes the user can switch between. */
export type EditMode = 'wysiwyg' | 'source' | 'preview';

/** All possible view modes, including reading. */
export type EditorMode = EditMode | 'reading';

/** Font family options available in reading mode. */
export type ReadingFontFamily = 'sans' | 'serif' | 'mono' | 'system';

/** User-configurable reading mode typography settings. */
export interface ReadingSettings {
  /** Font size in pixels. Range: 14-28. */
  fontSize: number;
  /** Line-height multiplier. Range: 1.4-2.4. */
  lineHeight: number;
  /** Maximum content width in characters. Range: 40-100. */
  contentWidth: number;
  /** Font family for reading mode. */
  fontFamily: ReadingFontFamily;
}

export interface EditorModeState {
  /** Current active mode. */
  mode: EditorMode;

  /**
   * The last edit mode before entering reading mode.
   * Used to restore the previous editing state when exiting reading mode.
   */
  lastEditMode: EditMode;

  /** Reading mode typography settings. */
  readingSettings: ReadingSettings;

  /**
   * Shared markdown content string used as the source of truth when
   * switching between modes. Updated by whichever mode is currently active.
   */
  markdown: string;

  // ---- Actions ----

  /** Set mode to a specific value. */
  setMode: (mode: EditorMode) => void;

  /**
   * Cycle through the three edit modes: wysiwyg -> source -> preview -> wysiwyg.
   * If currently in reading mode, exits to the last active edit mode first.
   */
  cycleEditMode: () => void;

  /**
   * Toggle reading mode. If in an edit mode, enters reading mode (saving the
   * current edit mode). If already in reading mode, exits to the last edit mode.
   */
  toggleReadingMode: () => void;

  /** Update the shared markdown content. */
  setMarkdown: (markdown: string) => void;

  /** Partially update reading settings. */
  updateReadingSettings: (patch: Partial<ReadingSettings>) => void;

  /** Reset reading settings to defaults. */
  resetReadingSettings: () => void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_READING_SETTINGS: ReadingSettings = {
  fontSize: 18,
  lineHeight: 1.8,
  contentWidth: 65,
  fontFamily: 'serif',
};

const EDIT_MODE_CYCLE: readonly EditMode[] = ['wysiwyg', 'source', 'preview'];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useEditorModeStore = create<EditorModeState>()(
  devtools(
    persist(
      (set, get) => ({
        mode: 'wysiwyg',
        lastEditMode: 'wysiwyg',
        readingSettings: DEFAULT_READING_SETTINGS,
        markdown: '',

        setMode: (mode) => {
          const state = get();
          if (mode !== 'reading') {
            set({ mode, lastEditMode: mode as EditMode }, false, 'editorMode/setMode');
          } else {
            // Entering reading mode — save current edit mode.
            const lastEdit =
              state.mode !== 'reading' ? (state.mode as EditMode) : state.lastEditMode;
            set({ mode: 'reading', lastEditMode: lastEdit }, false, 'editorMode/setMode');
          }
        },

        cycleEditMode: () => {
          const state = get();
          const currentMode = state.mode === 'reading' ? state.lastEditMode : state.mode;
          const currentIndex = EDIT_MODE_CYCLE.indexOf(currentMode as EditMode);
          const nextIndex = (currentIndex + 1) % EDIT_MODE_CYCLE.length;
          const nextMode = EDIT_MODE_CYCLE[nextIndex];
          set({ mode: nextMode, lastEditMode: nextMode }, false, 'editorMode/cycleEditMode');
        },

        toggleReadingMode: () => {
          const state = get();
          if (state.mode === 'reading') {
            // Exit reading mode — restore last edit mode.
            set({ mode: state.lastEditMode }, false, 'editorMode/toggleReadingMode');
          } else {
            // Enter reading mode — save current mode.
            set(
              { mode: 'reading', lastEditMode: state.mode as EditMode },
              false,
              'editorMode/toggleReadingMode',
            );
          }
        },

        setMarkdown: (markdown) => {
          set({ markdown }, false, 'editorMode/setMarkdown');
        },

        updateReadingSettings: (patch) =>
          set(
            (state) => ({
              readingSettings: {
                ...state.readingSettings,
                ...patch,
                fontSize:
                  patch.fontSize !== undefined
                    ? Math.min(28, Math.max(14, patch.fontSize))
                    : state.readingSettings.fontSize,
                lineHeight:
                  patch.lineHeight !== undefined
                    ? Math.min(2.4, Math.max(1.4, patch.lineHeight))
                    : state.readingSettings.lineHeight,
                contentWidth:
                  patch.contentWidth !== undefined
                    ? Math.min(100, Math.max(40, patch.contentWidth))
                    : state.readingSettings.contentWidth,
              },
            }),
            false,
            'editorMode/updateReadingSettings',
          ),

        resetReadingSettings: () =>
          set(
            { readingSettings: DEFAULT_READING_SETTINGS },
            false,
            'editorMode/resetReadingSettings',
          ),
      }),
      {
        name: 'notesaner-editor-mode',
        partialize: (state) => ({
          mode: state.mode,
          lastEditMode: state.lastEditMode,
          readingSettings: state.readingSettings,
          // Do NOT persist markdown — it comes from the note content.
        }),
      },
    ),
    { name: 'EditorModeStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Whether the editor is in any edit mode (not reading). */
export function selectIsEditing(mode: EditorMode): boolean {
  return mode !== 'reading';
}

/** Whether the editor is in source or preview mode. */
export function selectIsSourceBased(mode: EditorMode): boolean {
  return mode === 'source' || mode === 'preview';
}

/** CSS font-family value for the reading mode font family. */
export function readingFontFamilyCss(family: ReadingFontFamily): string {
  switch (family) {
    case 'serif':
      return 'var(--ns-font-serif)';
    case 'sans':
      return 'var(--ns-font-sans)';
    case 'mono':
      return 'var(--ns-font-mono)';
    case 'system':
    default:
      return 'var(--ns-font-sans)';
  }
}

/** Human-readable label for an EditorMode. */
export const EDITOR_MODE_LABELS: Record<EditorMode, string> = {
  wysiwyg: 'WYSIWYG',
  source: 'Source',
  preview: 'Live Preview',
  reading: 'Reading',
};
