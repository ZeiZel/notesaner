/**
 * Tests for export-store.
 *
 * Covers all actions, selectors, and edge cases for the Zustand export settings
 * store including batch selection management and settings reset.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  useExportStore,
  DEFAULT_EXPORT_SETTINGS,
  selectBatchCount,
  selectHasBatchItems,
  selectBatchSelection,
} from '../export-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore() {
  if (typeof localStorage !== 'undefined') localStorage.clear();
  useExportStore.setState({ ...DEFAULT_EXPORT_SETTINGS });
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('initial state', () => {
  beforeEach(resetStore);

  it('has the correct default format', () => {
    expect(useExportStore.getState().format).toBe('pdf');
  });

  it('has the correct default pageSize', () => {
    expect(useExportStore.getState().pageSize).toBe('A4');
  });

  it('has non-zero default margins', () => {
    const { margins } = useExportStore.getState();
    expect(margins.top).toBeGreaterThan(0);
    expect(margins.right).toBeGreaterThan(0);
    expect(margins.bottom).toBeGreaterThan(0);
    expect(margins.left).toBeGreaterThan(0);
  });

  it('has an empty batch selection', () => {
    expect(useExportStore.getState().batchSelection).toHaveLength(0);
  });

  it('has includeToc false by default', () => {
    expect(useExportStore.getState().includeToc).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setFormat
// ---------------------------------------------------------------------------

describe('setFormat', () => {
  beforeEach(resetStore);

  it('changes the format to docx', () => {
    useExportStore.getState().setFormat('docx');
    expect(useExportStore.getState().format).toBe('docx');
  });

  it('changes the format to html', () => {
    useExportStore.getState().setFormat('html');
    expect(useExportStore.getState().format).toBe('html');
  });

  it('changes back to pdf', () => {
    useExportStore.getState().setFormat('docx');
    useExportStore.getState().setFormat('pdf');
    expect(useExportStore.getState().format).toBe('pdf');
  });
});

// ---------------------------------------------------------------------------
// setPageSize
// ---------------------------------------------------------------------------

describe('setPageSize', () => {
  beforeEach(resetStore);

  it('sets Letter', () => {
    useExportStore.getState().setPageSize('Letter');
    expect(useExportStore.getState().pageSize).toBe('Letter');
  });

  it('sets Legal', () => {
    useExportStore.getState().setPageSize('Legal');
    expect(useExportStore.getState().pageSize).toBe('Legal');
  });
});

// ---------------------------------------------------------------------------
// setMargins
// ---------------------------------------------------------------------------

describe('setMargins', () => {
  beforeEach(resetStore);

  it('updates a single margin side', () => {
    useExportStore.getState().setMargins({ top: 50 });
    expect(useExportStore.getState().margins.top).toBe(50);
  });

  it('preserves other margins on partial update', () => {
    const original = { ...useExportStore.getState().margins };
    useExportStore.getState().setMargins({ top: 50 });
    const updated = useExportStore.getState().margins;
    expect(updated.right).toBe(original.right);
    expect(updated.bottom).toBe(original.bottom);
    expect(updated.left).toBe(original.left);
  });

  it('updates all margins at once', () => {
    useExportStore.getState().setMargins({ top: 10, right: 15, bottom: 20, left: 25 });
    const { margins } = useExportStore.getState();
    expect(margins).toMatchObject({ top: 10, right: 15, bottom: 20, left: 25 });
  });
});

// ---------------------------------------------------------------------------
// setFontSize
// ---------------------------------------------------------------------------

describe('setFontSize', () => {
  beforeEach(resetStore);

  it('sets a valid font size', () => {
    useExportStore.getState().setFontSize(16);
    expect(useExportStore.getState().fontSize).toBe(16);
  });

  it('clamps to minimum of 8', () => {
    useExportStore.getState().setFontSize(2);
    expect(useExportStore.getState().fontSize).toBe(8);
  });

  it('clamps to maximum of 36', () => {
    useExportStore.getState().setFontSize(100);
    expect(useExportStore.getState().fontSize).toBe(36);
  });
});

// ---------------------------------------------------------------------------
// setPreset
// ---------------------------------------------------------------------------

describe('setPreset', () => {
  beforeEach(resetStore);

  it('sets academic preset', () => {
    useExportStore.getState().setPreset('academic');
    expect(useExportStore.getState().preset).toBe('academic');
  });

  it('sets minimal preset', () => {
    useExportStore.getState().setPreset('minimal');
    expect(useExportStore.getState().preset).toBe('minimal');
  });
});

// ---------------------------------------------------------------------------
// setCustomCSS
// ---------------------------------------------------------------------------

describe('setCustomCSS', () => {
  beforeEach(resetStore);

  it('stores custom CSS', () => {
    useExportStore.getState().setCustomCSS('body { color: red; }');
    expect(useExportStore.getState().customCSS).toBe('body { color: red; }');
  });
});

// ---------------------------------------------------------------------------
// Content options
// ---------------------------------------------------------------------------

describe('content options', () => {
  beforeEach(resetStore);

  it('setIncludeToc toggles TOC', () => {
    useExportStore.getState().setIncludeToc(true);
    expect(useExportStore.getState().includeToc).toBe(true);
    useExportStore.getState().setIncludeToc(false);
    expect(useExportStore.getState().includeToc).toBe(false);
  });

  it('setIncludeImages toggles images', () => {
    useExportStore.getState().setIncludeImages(false);
    expect(useExportStore.getState().includeImages).toBe(false);
  });

  it('setPageBreakBeforeH2 toggles page breaks', () => {
    useExportStore.getState().setPageBreakBeforeH2(false);
    expect(useExportStore.getState().pageBreakBeforeH2).toBe(false);
  });

  it('setTocMaxDepth clamps to 1–6', () => {
    useExportStore.getState().setTocMaxDepth(0);
    expect(useExportStore.getState().tocMaxDepth).toBe(1);
    useExportStore.getState().setTocMaxDepth(10);
    expect(useExportStore.getState().tocMaxDepth).toBe(6);
    useExportStore.getState().setTocMaxDepth(3);
    expect(useExportStore.getState().tocMaxDepth).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// Batch selection
// ---------------------------------------------------------------------------

describe('addToBatch', () => {
  beforeEach(resetStore);

  it('adds a note id to the selection', () => {
    useExportStore.getState().addToBatch('note-1');
    expect(useExportStore.getState().batchSelection).toContain('note-1');
  });

  it('does not add duplicates', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().addToBatch('note-1');
    expect(useExportStore.getState().batchSelection.filter((id) => id === 'note-1')).toHaveLength(
      1,
    );
  });
});

describe('removeFromBatch', () => {
  beforeEach(resetStore);

  it('removes an existing note id', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().removeFromBatch('note-1');
    expect(useExportStore.getState().batchSelection).not.toContain('note-1');
  });

  it('is a no-op for non-existent id', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().removeFromBatch('note-999');
    expect(useExportStore.getState().batchSelection).toHaveLength(1);
  });
});

describe('setBatchSelection', () => {
  beforeEach(resetStore);

  it('replaces the entire selection', () => {
    useExportStore.getState().addToBatch('old-note');
    useExportStore.getState().setBatchSelection(['new-1', 'new-2']);
    expect(useExportStore.getState().batchSelection).toEqual(['new-1', 'new-2']);
  });

  it('deduplicates the input', () => {
    useExportStore.getState().setBatchSelection(['a', 'b', 'a', 'b', 'c']);
    expect(useExportStore.getState().batchSelection).toHaveLength(3);
  });
});

describe('clearBatchSelection', () => {
  beforeEach(resetStore);

  it('empties the selection', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().addToBatch('note-2');
    useExportStore.getState().clearBatchSelection();
    expect(useExportStore.getState().batchSelection).toHaveLength(0);
  });
});

describe('toggleBatchItem', () => {
  beforeEach(resetStore);

  it('adds item when not present', () => {
    useExportStore.getState().toggleBatchItem('note-1');
    expect(useExportStore.getState().batchSelection).toContain('note-1');
  });

  it('removes item when present', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().toggleBatchItem('note-1');
    expect(useExportStore.getState().batchSelection).not.toContain('note-1');
  });
});

describe('isBatchSelected', () => {
  beforeEach(resetStore);

  it('returns true for selected notes', () => {
    useExportStore.getState().addToBatch('note-1');
    expect(useExportStore.getState().isBatchSelected('note-1')).toBe(true);
  });

  it('returns false for non-selected notes', () => {
    expect(useExportStore.getState().isBatchSelected('not-selected')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// resetToDefaults
// ---------------------------------------------------------------------------

describe('resetToDefaults', () => {
  beforeEach(resetStore);

  it('restores all settings to default values', () => {
    useExportStore.getState().setFormat('docx');
    useExportStore.getState().setPageSize('Letter');
    useExportStore.getState().setFontSize(20);
    useExportStore.getState().setPreset('academic');
    useExportStore.getState().setCustomCSS('body { color: red; }');

    useExportStore.getState().resetToDefaults();

    const state = useExportStore.getState();
    expect(state.format).toBe(DEFAULT_EXPORT_SETTINGS.format);
    expect(state.pageSize).toBe(DEFAULT_EXPORT_SETTINGS.pageSize);
    expect(state.fontSize).toBe(DEFAULT_EXPORT_SETTINGS.fontSize);
    expect(state.preset).toBe(DEFAULT_EXPORT_SETTINGS.preset);
    expect(state.customCSS).toBe(DEFAULT_EXPORT_SETTINGS.customCSS);
  });

  it('does not clear the batch selection', () => {
    useExportStore.getState().addToBatch('note-1');
    useExportStore.getState().resetToDefaults();
    // Batch selection is intentionally preserved
    expect(useExportStore.getState().batchSelection).toContain('note-1');
  });
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

describe('selectBatchCount', () => {
  beforeEach(resetStore);

  it('returns 0 for empty selection', () => {
    expect(selectBatchCount(useExportStore.getState())).toBe(0);
  });

  it('returns correct count', () => {
    useExportStore.getState().setBatchSelection(['a', 'b', 'c']);
    expect(selectBatchCount(useExportStore.getState())).toBe(3);
  });
});

describe('selectHasBatchItems', () => {
  beforeEach(resetStore);

  it('returns false for empty selection', () => {
    expect(selectHasBatchItems(useExportStore.getState())).toBe(false);
  });

  it('returns true when items exist', () => {
    useExportStore.getState().addToBatch('note-1');
    expect(selectHasBatchItems(useExportStore.getState())).toBe(true);
  });
});

describe('selectBatchSelection', () => {
  beforeEach(resetStore);

  it('returns a copy (not the same reference)', () => {
    useExportStore.getState().addToBatch('note-1');
    const state = useExportStore.getState();
    const selected = selectBatchSelection(state);
    expect(selected).not.toBe(state.batchSelection);
    expect(selected).toEqual(state.batchSelection);
  });
});
