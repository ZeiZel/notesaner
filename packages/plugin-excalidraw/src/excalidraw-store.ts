/**
 * excalidraw-store — Zustand store for managing Excalidraw drawing state.
 *
 * Each drawing is identified by its file path (e.g. "drawings/my-sketch.excalidraw").
 * State is persisted to plugin storage on every save.
 *
 * The store is shared across all ExcalidrawEmbed instances in the same note
 * so that switching between embed and fullscreen views does not lose unsaved data.
 */

import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mirrors the Excalidraw library's ExcalidrawElement type minimally.
 * We avoid importing from @excalidraw/excalidraw at the store layer to
 * keep this file dependency-free and easily testable.
 */
export interface ExcalidrawElement {
  id: string;
  type: string;
  // Additional element properties are opaque to the store.
  [key: string]: unknown;
}

export interface ExcalidrawAppState {
  viewBackgroundColor?: string;
  [key: string]: unknown;
}

/** The on-disk format for a .excalidraw file. */
export interface ExcalidrawFileData {
  type: 'excalidraw';
  version: number;
  source?: string;
  elements: ExcalidrawElement[];
  appState: Partial<ExcalidrawAppState>;
  files?: Record<string, unknown>;
}

/** Runtime state for one drawing. */
export interface DrawingState {
  /** The .excalidraw file path relative to the workspace root. */
  filePath: string;
  /** Current elements in the canvas. Updated on every change event. */
  elements: ExcalidrawElement[];
  /** Current app state (background color, etc.). */
  appState: Partial<ExcalidrawAppState>;
  /** Binary files embedded in the drawing (images, etc.). */
  files: Record<string, unknown>;
  /** Whether there are unsaved changes. */
  isDirty: boolean;
  /** Whether a save is currently in progress. */
  isSaving: boolean;
  /** Last error message from a failed save, or null. */
  saveError: string | null;
  /** ISO date string of the last successful save. */
  lastSaved: string | null;
}

/** Operations available on the store. */
export interface DrawingActions {
  /**
   * Register an initial drawing state (called when an embed mounts and
   * has loaded data from the filesystem or plugin storage).
   */
  initDrawing(filePath: string, data: ExcalidrawFileData): void;

  /**
   * Update the drawing data after a change event from the Excalidraw canvas.
   * Marks the drawing as dirty.
   */
  updateDrawing(
    filePath: string,
    elements: ExcalidrawElement[],
    appState: Partial<ExcalidrawAppState>,
    files: Record<string, unknown>,
  ): void;

  /** Mark a save as started. */
  setSaving(filePath: string, saving: boolean): void;

  /**
   * Called after a successful save.
   * Clears the dirty flag and records the timestamp.
   */
  markSaved(filePath: string): void;

  /** Record a save error. */
  setSaveError(filePath: string, error: string): void;

  /** Remove a drawing from the store (called when the embed unmounts). */
  removeDrawing(filePath: string): void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

interface ExcalidrawStoreState {
  /** Map of filePath -> DrawingState */
  drawings: Map<string, DrawingState>;
  actions: DrawingActions;
}

/**
 * Default app state applied to new, empty drawings.
 */
export const DEFAULT_APP_STATE: Partial<ExcalidrawAppState> = {
  viewBackgroundColor: '#ffffff',
};

function buildEmptyState(filePath: string): DrawingState {
  return {
    filePath,
    elements: [],
    appState: DEFAULT_APP_STATE,
    files: {},
    isDirty: false,
    isSaving: false,
    saveError: null,
    lastSaved: null,
  };
}

export const useExcalidrawStore = create<ExcalidrawStoreState>((set) => ({
  drawings: new Map(),

  actions: {
    initDrawing(filePath, data) {
      set((state) => {
        const next = new Map(state.drawings);
        next.set(filePath, {
          filePath,
          elements: data.elements ?? [],
          appState: data.appState ?? DEFAULT_APP_STATE,
          files: data.files ?? {},
          isDirty: false,
          isSaving: false,
          saveError: null,
          lastSaved: null,
        });
        return { drawings: next };
      });
    },

    updateDrawing(filePath, elements, appState, files) {
      set((state) => {
        const next = new Map(state.drawings);
        const existing = next.get(filePath) ?? buildEmptyState(filePath);
        next.set(filePath, {
          ...existing,
          elements,
          appState,
          files,
          isDirty: true,
          saveError: null,
        });
        return { drawings: next };
      });
    },

    setSaving(filePath, saving) {
      set((state) => {
        const next = new Map(state.drawings);
        const existing = next.get(filePath);
        if (!existing) return state;
        next.set(filePath, { ...existing, isSaving: saving });
        return { drawings: next };
      });
    },

    markSaved(filePath) {
      set((state) => {
        const next = new Map(state.drawings);
        const existing = next.get(filePath);
        if (!existing) return state;
        next.set(filePath, {
          ...existing,
          isDirty: false,
          isSaving: false,
          saveError: null,
          lastSaved: new Date().toISOString(),
        });
        return { drawings: next };
      });
    },

    setSaveError(filePath, error) {
      set((state) => {
        const next = new Map(state.drawings);
        const existing = next.get(filePath);
        if (!existing) return state;
        next.set(filePath, {
          ...existing,
          isSaving: false,
          saveError: error,
        });
        return { drawings: next };
      });
    },

    removeDrawing(filePath) {
      set((state) => {
        const next = new Map(state.drawings);
        next.delete(filePath);
        return { drawings: next };
      });
    },
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Returns the DrawingState for a specific file, or undefined. */
export function selectDrawing(
  state: ExcalidrawStoreState,
  filePath: string,
): DrawingState | undefined {
  return state.drawings.get(filePath);
}

// ---------------------------------------------------------------------------
// Serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serialize current drawing state to the .excalidraw JSON format.
 * The result can be saved as a file or embedded in a note's frontmatter.
 */
export function serializeDrawing(drawing: DrawingState): ExcalidrawFileData {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://notesaner.app',
    elements: drawing.elements,
    appState: drawing.appState,
    files: drawing.files,
  };
}

/**
 * Parse a JSON string into ExcalidrawFileData with basic validation.
 * Throws a descriptive error on invalid input.
 */
export function parseExcalidrawFile(json: string): ExcalidrawFileData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON — not a valid .excalidraw file');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    (parsed as Record<string, unknown>)['type'] !== 'excalidraw'
  ) {
    throw new Error('File is not a valid .excalidraw file (missing type: "excalidraw")');
  }

  const data = parsed as Record<string, unknown>;

  return {
    type: 'excalidraw',
    version: typeof data['version'] === 'number' ? data['version'] : 2,
    source: typeof data['source'] === 'string' ? data['source'] : undefined,
    elements: Array.isArray(data['elements']) ? (data['elements'] as ExcalidrawElement[]) : [],
    appState:
      typeof data['appState'] === 'object' && data['appState'] !== null
        ? (data['appState'] as Partial<ExcalidrawAppState>)
        : DEFAULT_APP_STATE,
    files:
      typeof data['files'] === 'object' && data['files'] !== null
        ? (data['files'] as Record<string, unknown>)
        : {},
  };
}
