/**
 * Tests for excalidraw-store.ts
 *
 * Covers:
 * - Store actions: initDrawing, updateDrawing, setSaving, markSaved, setSaveError, removeDrawing
 * - Derived state: isDirty flag transitions
 * - Serialization: serializeDrawing produces correct JSON structure
 * - Parsing: parseExcalidrawFile validates and normalizes input
 * - selectDrawing selector
 */

import { describe, it, expect } from 'vitest';
import {
  useExcalidrawStore,
  serializeDrawing,
  parseExcalidrawFile,
  selectDrawing,
  DEFAULT_APP_STATE,
  type ExcalidrawFileData,
  type ExcalidrawElement,
} from '../excalidraw-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function freshStore() {
  // Reset store state between tests by re-initializing
  useExcalidrawStore.setState({ drawings: new Map() });
  return useExcalidrawStore.getState();
}

const SAMPLE_ELEMENT: ExcalidrawElement = {
  id: 'el-1',
  type: 'rectangle',
  x: 10,
  y: 20,
  width: 100,
  height: 50,
};

const SAMPLE_FILE_DATA: ExcalidrawFileData = {
  type: 'excalidraw',
  version: 2,
  elements: [SAMPLE_ELEMENT],
  appState: { viewBackgroundColor: '#f0f0f0' },
  files: {},
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ExcalidrawStore — initDrawing', () => {
  it('adds a new drawing entry', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const state = useExcalidrawStore.getState();
    const drawing = state.drawings.get('drawings/test.excalidraw');
    expect(drawing).toBeDefined();
    expect(drawing?.elements).toHaveLength(1);
    expect(drawing?.elements[0]?.id).toBe('el-1');
    expect(drawing?.isDirty).toBe(false);
  });

  it('overwrites an existing entry on re-init', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.initDrawing('drawings/test.excalidraw', {
      ...SAMPLE_FILE_DATA,
      elements: [],
    });
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.elements).toHaveLength(0);
  });

  it('sets isDirty to false on init', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.isDirty).toBe(false);
  });
});

describe('ExcalidrawStore — updateDrawing', () => {
  it('marks drawing as dirty', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.updateDrawing('drawings/test.excalidraw', [SAMPLE_ELEMENT], {}, {});
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.isDirty).toBe(true);
  });

  it('updates element list', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const newEl: ExcalidrawElement = { id: 'el-2', type: 'ellipse' };
    actions.updateDrawing('drawings/test.excalidraw', [newEl], {}, {});
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.elements).toHaveLength(1);
    expect(drawing?.elements[0]?.id).toBe('el-2');
  });

  it('clears saveError on update', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.setSaveError('drawings/test.excalidraw', 'Network error');
    actions.updateDrawing('drawings/test.excalidraw', [], {}, {});
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.saveError).toBeNull();
  });

  it('is a no-op for unknown file path', () => {
    const { actions } = freshStore();
    // Should not throw
    actions.updateDrawing('drawings/unknown.excalidraw', [], {}, {});
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/unknown.excalidraw');
    // Creates a new entry with the update
    expect(drawing).toBeDefined();
  });
});

describe('ExcalidrawStore — setSaving / markSaved / setSaveError', () => {
  it('setSaving sets isSaving flag', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.setSaving('drawings/test.excalidraw', true);
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.isSaving).toBe(true);
  });

  it('markSaved clears dirty flag and records timestamp', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.updateDrawing('drawings/test.excalidraw', [], {}, {});
    actions.markSaved('drawings/test.excalidraw');
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.isDirty).toBe(false);
    expect(drawing?.isSaving).toBe(false);
    expect(drawing?.lastSaved).not.toBeNull();
  });

  it('setSaveError records error and clears isSaving', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.setSaving('drawings/test.excalidraw', true);
    actions.setSaveError('drawings/test.excalidraw', 'Disk full');
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing?.saveError).toBe('Disk full');
    expect(drawing?.isSaving).toBe(false);
  });

  it('markSaved is a no-op for unknown file path', () => {
    const { actions } = freshStore();
    // Should not throw
    expect(() => actions.markSaved('drawings/unknown.excalidraw')).not.toThrow();
  });
});

describe('ExcalidrawStore — removeDrawing', () => {
  it('removes the drawing from the map', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    actions.removeDrawing('drawings/test.excalidraw');
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw');
    expect(drawing).toBeUndefined();
  });

  it('is a no-op for unknown file path', () => {
    const { actions } = freshStore();
    expect(() => actions.removeDrawing('drawings/nonexistent.excalidraw')).not.toThrow();
  });
});

describe('selectDrawing', () => {
  it('returns the drawing state for a given file path', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const state = useExcalidrawStore.getState();
    const drawing = selectDrawing(state, 'drawings/test.excalidraw');
    expect(drawing).toBeDefined();
    expect(drawing?.filePath).toBe('drawings/test.excalidraw');
  });

  it('returns undefined for unknown file path', () => {
    const state = freshStore();
    const drawing = selectDrawing(state, 'drawings/unknown.excalidraw');
    expect(drawing).toBeUndefined();
  });
});

describe('serializeDrawing', () => {
  it('produces valid excalidraw JSON structure', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw')!;
    const result = serializeDrawing(drawing);
    expect(result.type).toBe('excalidraw');
    expect(result.version).toBe(2);
    expect(result.elements).toEqual(drawing.elements);
    expect(result.appState).toEqual(drawing.appState);
  });

  it('includes source field', () => {
    const { actions } = freshStore();
    actions.initDrawing('drawings/test.excalidraw', SAMPLE_FILE_DATA);
    const drawing = useExcalidrawStore.getState().drawings.get('drawings/test.excalidraw')!;
    const result = serializeDrawing(drawing);
    expect(result.source).toBe('https://notesaner.app');
  });
});

describe('parseExcalidrawFile', () => {
  it('parses a valid excalidraw JSON string', () => {
    const json = JSON.stringify(SAMPLE_FILE_DATA);
    const result = parseExcalidrawFile(json);
    expect(result.type).toBe('excalidraw');
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]?.id).toBe('el-1');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseExcalidrawFile('not-json')).toThrow('Invalid JSON');
  });

  it('throws on JSON that is not an excalidraw file', () => {
    const json = JSON.stringify({ type: 'other', data: 123 });
    expect(() => parseExcalidrawFile(json)).toThrow('not a valid .excalidraw file');
  });

  it('defaults elements to empty array when missing', () => {
    const json = JSON.stringify({ type: 'excalidraw', version: 2, appState: {} });
    const result = parseExcalidrawFile(json);
    expect(result.elements).toEqual([]);
  });

  it('defaults appState to DEFAULT_APP_STATE when missing', () => {
    const json = JSON.stringify({ type: 'excalidraw', version: 2, elements: [] });
    const result = parseExcalidrawFile(json);
    expect(result.appState).toEqual(DEFAULT_APP_STATE);
  });

  it('defaults files to empty object when missing', () => {
    const json = JSON.stringify({ type: 'excalidraw', version: 2, elements: [] });
    const result = parseExcalidrawFile(json);
    expect(result.files).toEqual({});
  });

  it('normalizes non-number version to 2', () => {
    const json = JSON.stringify({ type: 'excalidraw', version: 'old', elements: [] });
    const result = parseExcalidrawFile(json);
    expect(result.version).toBe(2);
  });
});
