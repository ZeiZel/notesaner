/**
 * export-store — Zustand store for PDF/DOCX export settings.
 *
 * Persists user preferences to localStorage so settings survive page reloads.
 * Provides actions for updating individual settings and managing the batch
 * selection (list of note IDs queued for batch export).
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { PageSize, PageMargins, StylePreset } from './export-styles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported export output formats. */
export type ExportFormat = 'pdf' | 'docx' | 'html';

/** Complete export settings state. */
export interface ExportSettingsState {
  // ---- Format ----
  /** Target output format. */
  format: ExportFormat;

  // ---- Page layout ----
  /** Page size for PDF export. */
  pageSize: PageSize;
  /** Page margins in millimetres. */
  margins: PageMargins;

  // ---- Typography ----
  /** Base font size in pixels. */
  fontSize: number;
  /** CSS font-family string. Empty string uses preset default. */
  fontFamily: string;

  // ---- Style ----
  /** Named style preset. */
  preset: StylePreset;
  /** User-supplied CSS appended after preset. */
  customCSS: string;

  // ---- Content options ----
  /** Whether to include a table of contents. */
  includeToc: boolean;
  /** Whether to embed images in the output. */
  includeImages: boolean;
  /** Whether to add page-break hints before h2 headings. */
  pageBreakBeforeH2: boolean;
  /** Maximum TOC depth (1–6). */
  tocMaxDepth: number;

  // ---- Batch export ----
  /** IDs of notes selected for batch export. */
  batchSelection: string[];
}

/** Actions on the export store. */
export interface ExportSettingsActions {
  /** Set the export format. */
  setFormat: (format: ExportFormat) => void;
  /** Set the page size. */
  setPageSize: (pageSize: PageSize) => void;
  /** Set page margins. Partial updates are merged. */
  setMargins: (margins: Partial<PageMargins>) => void;
  /** Set the base font size. */
  setFontSize: (fontSize: number) => void;
  /** Set the font family. */
  setFontFamily: (fontFamily: string) => void;
  /** Set the style preset. */
  setPreset: (preset: StylePreset) => void;
  /** Set custom CSS. */
  setCustomCSS: (css: string) => void;
  /** Toggle table of contents inclusion. */
  setIncludeToc: (includeToc: boolean) => void;
  /** Toggle image inclusion. */
  setIncludeImages: (includeImages: boolean) => void;
  /** Toggle page break before h2. */
  setPageBreakBeforeH2: (enabled: boolean) => void;
  /** Set maximum TOC depth. */
  setTocMaxDepth: (depth: number) => void;

  // ---- Batch selection ----
  /** Add a note ID to the batch selection. No-op if already present. */
  addToBatch: (noteId: string) => void;
  /** Remove a note ID from the batch selection. */
  removeFromBatch: (noteId: string) => void;
  /** Replace the entire batch selection. */
  setBatchSelection: (noteIds: string[]) => void;
  /** Clear the batch selection. */
  clearBatchSelection: () => void;
  /** Toggle a note in/out of the batch selection. */
  toggleBatchItem: (noteId: string) => void;
  /** Return true if a note ID is in the batch selection. */
  isBatchSelected: (noteId: string) => boolean;

  // ---- Reset ----
  /** Reset all settings to defaults (does not clear batch selection). */
  resetToDefaults: () => void;
}

export type ExportStore = ExportSettingsState & ExportSettingsActions;

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

export const DEFAULT_EXPORT_SETTINGS: ExportSettingsState = {
  format: 'pdf',
  pageSize: 'A4',
  margins: { top: 25, right: 25, bottom: 25, left: 25 },
  fontSize: 14,
  fontFamily: '',
  preset: 'default',
  customCSS: '',
  includeToc: false,
  includeImages: true,
  pageBreakBeforeH2: true,
  tocMaxDepth: 3,
  batchSelection: [],
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useExportStore = create<ExportStore>()(
  persist(
    (set, get) => ({
      // ----- initial state -----
      ...DEFAULT_EXPORT_SETTINGS,

      // ----- format -----
      setFormat(format: ExportFormat) {
        set({ format });
      },

      // ----- page layout -----
      setPageSize(pageSize: PageSize) {
        set({ pageSize });
      },

      setMargins(partial: Partial<PageMargins>) {
        set((state) => ({
          margins: { ...state.margins, ...partial },
        }));
      },

      // ----- typography -----
      setFontSize(fontSize: number) {
        const clamped = Math.max(8, Math.min(36, fontSize));
        set({ fontSize: clamped });
      },

      setFontFamily(fontFamily: string) {
        set({ fontFamily });
      },

      // ----- style -----
      setPreset(preset: StylePreset) {
        set({ preset });
      },

      setCustomCSS(customCSS: string) {
        set({ customCSS });
      },

      // ----- content options -----
      setIncludeToc(includeToc: boolean) {
        set({ includeToc });
      },

      setIncludeImages(includeImages: boolean) {
        set({ includeImages });
      },

      setPageBreakBeforeH2(pageBreakBeforeH2: boolean) {
        set({ pageBreakBeforeH2 });
      },

      setTocMaxDepth(depth: number) {
        const clamped = Math.max(1, Math.min(6, depth));
        set({ tocMaxDepth: clamped });
      },

      // ----- batch selection -----
      addToBatch(noteId: string) {
        set((state) => {
          if (state.batchSelection.includes(noteId)) return state;
          return { batchSelection: [...state.batchSelection, noteId] };
        });
      },

      removeFromBatch(noteId: string) {
        set((state) => ({
          batchSelection: state.batchSelection.filter((id) => id !== noteId),
        }));
      },

      setBatchSelection(noteIds: string[]) {
        set({ batchSelection: [...new Set(noteIds)] });
      },

      clearBatchSelection() {
        set({ batchSelection: [] });
      },

      toggleBatchItem(noteId: string) {
        set((state) => {
          if (state.batchSelection.includes(noteId)) {
            return { batchSelection: state.batchSelection.filter((id) => id !== noteId) };
          }
          return { batchSelection: [...state.batchSelection, noteId] };
        });
      },

      isBatchSelected(noteId: string) {
        return get().batchSelection.includes(noteId);
      },

      // ----- reset -----
      resetToDefaults() {
        set({
          format: DEFAULT_EXPORT_SETTINGS.format,
          pageSize: DEFAULT_EXPORT_SETTINGS.pageSize,
          margins: { ...DEFAULT_EXPORT_SETTINGS.margins },
          fontSize: DEFAULT_EXPORT_SETTINGS.fontSize,
          fontFamily: DEFAULT_EXPORT_SETTINGS.fontFamily,
          preset: DEFAULT_EXPORT_SETTINGS.preset,
          customCSS: DEFAULT_EXPORT_SETTINGS.customCSS,
          includeToc: DEFAULT_EXPORT_SETTINGS.includeToc,
          includeImages: DEFAULT_EXPORT_SETTINGS.includeImages,
          pageBreakBeforeH2: DEFAULT_EXPORT_SETTINGS.pageBreakBeforeH2,
          tocMaxDepth: DEFAULT_EXPORT_SETTINGS.tocMaxDepth,
        });
      },
    }),
    {
      name: 'notesaner-pdf-export-settings',
      storage: createJSONStorage(() => {
        // Guard for SSR / non-browser environments.
        if (typeof window === 'undefined') {
          return {
            getItem: () => null,
            setItem: () => undefined,
            removeItem: () => undefined,
          };
        }
        return window.localStorage;
      }),
      // Only persist settings, not the batch selection (which is ephemeral).
      partialize: (state) => ({
        format: state.format,
        pageSize: state.pageSize,
        margins: state.margins,
        fontSize: state.fontSize,
        fontFamily: state.fontFamily,
        preset: state.preset,
        customCSS: state.customCSS,
        includeToc: state.includeToc,
        includeImages: state.includeImages,
        pageBreakBeforeH2: state.pageBreakBeforeH2,
        tocMaxDepth: state.tocMaxDepth,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Return the current batch selection count. */
export function selectBatchCount(state: ExportSettingsState): number {
  return state.batchSelection.length;
}

/** Return true when batch selection is non-empty. */
export function selectHasBatchItems(state: ExportSettingsState): boolean {
  return state.batchSelection.length > 0;
}

/** Return a copy of the current batch selection. */
export function selectBatchSelection(state: ExportSettingsState): string[] {
  return [...state.batchSelection];
}
