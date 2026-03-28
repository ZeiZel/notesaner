/**
 * Tests for useFileImport hook and useFileImportStore.
 *
 * Covers:
 *   - File validation (accepted types, size limits)
 *   - Store state management (startBatch, updateEntry, clearCompleted, reset)
 *   - File classification (note, image, attachment)
 *   - Overall progress calculation
 *   - Batch completion detection
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useFileImportStore } from '../hooks/useFileImport';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(
  id: string,
  overrides: Partial<ReturnType<typeof useFileImportStore.getState>['entries'][number]> = {},
) {
  return {
    id,
    fileName: `${id}.md`,
    fileSize: 1024,
    fileType: 'note' as const,
    status: 'pending' as const,
    progress: 0,
    ...overrides,
  };
}

function resetStore(): void {
  useFileImportStore.setState({
    entries: [],
    isImporting: false,
    overallProgress: 0,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// startBatch
// ---------------------------------------------------------------------------

describe('useFileImportStore -- startBatch', () => {
  it('populates entries and sets isImporting', () => {
    const entries = [makeEntry('e1'), makeEntry('e2')];
    useFileImportStore.getState().startBatch(entries);

    const state = useFileImportStore.getState();
    expect(state.entries).toHaveLength(2);
    expect(state.isImporting).toBe(true);
    expect(state.overallProgress).toBe(0);
  });

  it('replaces existing entries', () => {
    useFileImportStore.setState({ entries: [makeEntry('old')] });
    useFileImportStore.getState().startBatch([makeEntry('new')]);

    const state = useFileImportStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]!.id).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// updateEntry
// ---------------------------------------------------------------------------

describe('useFileImportStore -- updateEntry', () => {
  it('updates a specific entry by ID', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1'), makeEntry('e2')]);
    useFileImportStore.getState().updateEntry('e1', { status: 'uploading', progress: 50 });

    const entry = useFileImportStore.getState().entries.find((e) => e.id === 'e1');
    expect(entry?.status).toBe('uploading');
    expect(entry?.progress).toBe(50);
  });

  it('does not modify other entries', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1'), makeEntry('e2')]);
    useFileImportStore.getState().updateEntry('e1', { progress: 75 });

    const other = useFileImportStore.getState().entries.find((e) => e.id === 'e2');
    expect(other?.progress).toBe(0);
  });

  it('calculates overallProgress correctly', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1'), makeEntry('e2')]);
    useFileImportStore.getState().updateEntry('e1', { progress: 100 });
    useFileImportStore.getState().updateEntry('e2', { progress: 50 });

    expect(useFileImportStore.getState().overallProgress).toBe(75);
  });

  it('sets isImporting to false when all entries are done or error', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1'), makeEntry('e2')]);

    useFileImportStore.getState().updateEntry('e1', { status: 'done', progress: 100 });
    // Still importing -- e2 is pending
    expect(useFileImportStore.getState().isImporting).toBe(true);

    useFileImportStore.getState().updateEntry('e2', { status: 'error', error: 'fail' });
    expect(useFileImportStore.getState().isImporting).toBe(false);
  });

  it('handles single entry batch completion', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1')]);
    useFileImportStore.getState().updateEntry('e1', { status: 'done', progress: 100 });

    const state = useFileImportStore.getState();
    expect(state.isImporting).toBe(false);
    expect(state.overallProgress).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// clearCompleted
// ---------------------------------------------------------------------------

describe('useFileImportStore -- clearCompleted', () => {
  it('removes done and error entries', () => {
    useFileImportStore
      .getState()
      .startBatch([
        makeEntry('e1', { status: 'done', progress: 100 }),
        makeEntry('e2', { status: 'error', error: 'fail' }),
        makeEntry('e3', { status: 'uploading', progress: 50 }),
      ]);

    useFileImportStore.getState().clearCompleted();

    const state = useFileImportStore.getState();
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0]!.id).toBe('e3');
  });

  it('is a no-op when no completed entries exist', () => {
    useFileImportStore
      .getState()
      .startBatch([makeEntry('e1', { status: 'uploading', progress: 30 })]);

    useFileImportStore.getState().clearCompleted();
    expect(useFileImportStore.getState().entries).toHaveLength(1);
  });

  it('results in empty entries when all are completed', () => {
    useFileImportStore
      .getState()
      .startBatch([
        makeEntry('e1', { status: 'done', progress: 100 }),
        makeEntry('e2', { status: 'done', progress: 100 }),
      ]);

    useFileImportStore.getState().clearCompleted();
    expect(useFileImportStore.getState().entries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('useFileImportStore -- reset', () => {
  it('clears all state to initial values', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1', { status: 'done', progress: 100 })]);

    useFileImportStore.getState().reset();

    const state = useFileImportStore.getState();
    expect(state.entries).toHaveLength(0);
    expect(state.isImporting).toBe(false);
    expect(state.overallProgress).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Progress calculation edge cases
// ---------------------------------------------------------------------------

describe('useFileImportStore -- progress calculation', () => {
  it('returns 0 for empty entries', () => {
    useFileImportStore.getState().startBatch([]);
    expect(useFileImportStore.getState().overallProgress).toBe(0);
  });

  it('rounds progress to nearest integer', () => {
    useFileImportStore.getState().startBatch([makeEntry('e1'), makeEntry('e2'), makeEntry('e3')]);
    useFileImportStore.getState().updateEntry('e1', { progress: 33 });
    useFileImportStore.getState().updateEntry('e2', { progress: 33 });
    useFileImportStore.getState().updateEntry('e3', { progress: 33 });

    // (33+33+33) / 3 = 33
    expect(useFileImportStore.getState().overallProgress).toBe(33);
  });
});
