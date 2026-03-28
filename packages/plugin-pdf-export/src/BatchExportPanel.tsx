/**
 * BatchExportPanel — Multi-note selection panel for batch export.
 *
 * Displays a list of all notes in the workspace, allows multi-select,
 * and exports the selected notes as a single zip archive.
 *
 * Notes are passed in as props (the host workspace provides the list).
 * The selection state is stored in `useExportStore` so it persists if the
 * panel is hidden/shown.
 *
 * Progress is shown during zip creation. The completed zip is downloaded
 * using the browser's native save dialog via `downloadBlob`.
 */

import { useState, useCallback, useMemo, type JSX } from 'react';
import { useExportStore, selectBatchCount, selectHasBatchItems } from './export-store';
import { renderToPdf } from './pdf-renderer';
import { renderToDocx } from './docx-renderer';
import {
  createBatchZipBlobAsync,
  packDocxEntries,
  downloadBlob,
  titleToFilename,
  type BatchExportItem,
  type ZipProgress,
} from './zip-utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal note info needed by the panel. */
export interface ExportableNote {
  id: string;
  title: string;
  /** Note markdown content. Required for export, optional for display-only. */
  content?: string;
}

export interface BatchExportPanelProps {
  /** All notes available for export. */
  notes: ExportableNote[];
  /**
   * Called when the host should fetch full markdown for a specific note.
   * Returns the content string or throws on error.
   */
  fetchContent: (noteId: string) => Promise<string>;
  /** Optional CSS class name for the outer container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BatchExportPanel({
  notes,
  fetchContent,
  className = '',
}: BatchExportPanelProps): JSX.Element {
  const store = useExportStore();
  const batchCount = useExportStore(selectBatchCount);
  const hasBatchItems = useExportStore(selectHasBatchItems);

  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState<ZipProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter notes by search query
  const filteredNotes = useMemo(() => {
    if (!searchQuery.trim()) return notes;
    const q = searchQuery.toLowerCase();
    return notes.filter((n) => n.title.toLowerCase().includes(q));
  }, [notes, searchQuery]);

  const handleSelectAll = useCallback(() => {
    store.setBatchSelection(filteredNotes.map((n) => n.id));
  }, [store, filteredNotes]);

  const handleDeselectAll = useCallback(() => {
    store.clearBatchSelection();
  }, [store]);

  const handleToggle = useCallback(
    (noteId: string) => {
      store.toggleBatchItem(noteId);
    },
    [store],
  );

  const handleExport = useCallback(async () => {
    if (exporting || !hasBatchItems) return;

    setExporting(true);
    setError(null);
    setSuccess(false);
    setProgress({ processed: 0, total: store.batchSelection.length, fraction: 0 });

    try {
      const format = store.format;
      const items: BatchExportItem[] = [];

      for (let i = 0; i < store.batchSelection.length; i++) {
        const noteId = store.batchSelection[i];
        const note = notes.find((n) => n.id === noteId);
        if (!note) continue;

        const content = note.content ?? (await fetchContent(noteId));

        let fileContent: string;
        let filename: string;

        if (format === 'pdf' || format === 'html') {
          const result = renderToPdf({
            markdown: content,
            title: note.title,
            pageSize: store.pageSize,
            margins: store.margins,
            fontSize: store.fontSize,
            fontFamily: store.fontFamily,
            preset: store.preset,
            customCSS: store.customCSS,
            includeToc: store.includeToc,
            pageBreakBeforeH2: store.pageBreakBeforeH2,
            tocMaxDepth: store.tocMaxDepth,
          });
          fileContent = result.html;
          // PDF exports go as HTML files inside the zip; user prints each individually
          filename = titleToFilename(note.title, format === 'pdf' ? '.pdf.html' : '.html');
        } else {
          const entries = renderToDocx({
            markdown: content,
            title: note.title,
            includeToc: store.includeToc,
            halfPointFontSize: store.fontSize * 2,
          });
          // For DOCX we need to create an individual zip for each note,
          // then nest it inside the outer batch zip as a .docx file.
          // We encode the DOCX XML entries as a nested zip blob.
          const innerFiles = packDocxEntries(entries);
          const { createZipBlob } = await import('./zip-utils.js');
          const innerBlob = createZipBlob(innerFiles);
          const arrayBuf = await innerBlob.arrayBuffer();
          fileContent = '';
          // Use raw bytes for .docx entries
          items.push({
            noteId,
            filename: titleToFilename(note.title, '.docx'),
            content: new Uint8Array(arrayBuf),
          });
          continue;
        }

        items.push({ noteId, filename, content: fileContent });
      }

      const blob = await createBatchZipBlobAsync(items, (p) => setProgress(p));

      downloadBlob(blob, `notesaner-export-${Date.now()}.zip`);
      setSuccess(true);
      store.clearBatchSelection();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
      setProgress(null);
    }
  }, [exporting, hasBatchItems, notes, fetchContent, store]);

  // ---- Inline styles ----
  const styles = `
    .bep-panel {
      display: flex;
      flex-direction: column;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1a1a1a;
    }
    .bep-header {
      padding: 12px 14px 8px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .bep-title {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    .bep-search {
      width: 100%;
      padding: 5px 8px;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-size: 13px;
      box-sizing: border-box;
    }
    .bep-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 14px;
      border-bottom: 1px solid #f3f4f6;
      flex-shrink: 0;
    }
    .bep-link-btn {
      background: none;
      border: none;
      color: #6366f1;
      cursor: pointer;
      font-size: 12px;
      padding: 0;
      text-decoration: underline;
    }
    .bep-count {
      margin-left: auto;
      font-size: 12px;
      color: #6b7280;
    }
    .bep-list {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .bep-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 6px 14px;
      cursor: pointer;
      border-bottom: 1px solid #f9fafb;
      user-select: none;
      transition: background 0.1s;
    }
    .bep-item:hover { background: #f9fafb; }
    .bep-item.selected { background: #eff1ff; }
    .bep-item-title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bep-empty {
      padding: 24px;
      text-align: center;
      color: #9ca3af;
    }
    .bep-footer {
      padding: 12px 14px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .bep-progress {
      margin-bottom: 8px;
    }
    .bep-progress-bar {
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 4px;
    }
    .bep-progress-fill {
      height: 100%;
      background: #6366f1;
      border-radius: 2px;
      transition: width 0.1s;
    }
    .bep-progress-text {
      font-size: 11px;
      color: #6b7280;
    }
    .bep-error { color: #ef4444; font-size: 12px; margin-bottom: 6px; }
    .bep-success { color: #22c55e; font-size: 12px; margin-bottom: 6px; }
    .bep-export-btn {
      width: 100%;
      padding: 8px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .bep-export-btn:hover:not(:disabled) { background: #4f46e5; }
    .bep-export-btn:disabled { opacity: 0.55; cursor: default; }
  `;

  const progressPercent = progress ? Math.round(progress.fraction * 100) : 0;

  return (
    <div className={`bep-panel ${className}`}>
      <style>{styles}</style>

      {/* Header */}
      <div className="bep-header">
        <div className="bep-title">Batch Export</div>
        <input
          type="search"
          className="bep-search"
          placeholder="Search notes…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Controls */}
      <div className="bep-controls">
        <button type="button" className="bep-link-btn" onClick={handleSelectAll}>
          Select all
        </button>
        <button type="button" className="bep-link-btn" onClick={handleDeselectAll}>
          Deselect all
        </button>
        <span className="bep-count">{batchCount} selected</span>
      </div>

      {/* Note list */}
      <div className="bep-list">
        {filteredNotes.length === 0 ? (
          <div className="bep-empty">
            {searchQuery ? 'No notes match your search.' : 'No notes available.'}
          </div>
        ) : (
          filteredNotes.map((note) => {
            const selected = store.isBatchSelected(note.id);
            return (
              <div
                key={note.id}
                className={`bep-item ${selected ? 'selected' : ''}`}
                onClick={() => handleToggle(note.id)}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') handleToggle(note.id);
                }}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => handleToggle(note.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="bep-item-title" title={note.title}>
                  {note.title}
                </span>
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="bep-footer">
        {exporting && progress && (
          <div className="bep-progress">
            <div className="bep-progress-bar">
              <div className="bep-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="bep-progress-text">
              {progress.processed} / {progress.total} notes ({progressPercent}%)
            </div>
          </div>
        )}
        {error && <div className="bep-error">{error}</div>}
        {success && !exporting && (
          <div className="bep-success">Export complete! Check your downloads.</div>
        )}
        <button
          type="button"
          className="bep-export-btn"
          onClick={handleExport}
          disabled={exporting || !hasBatchItems}
        >
          {exporting
            ? `Exporting ${store.format.toUpperCase()}…`
            : hasBatchItems
              ? `Export ${batchCount} note${batchCount !== 1 ? 's' : ''} as ${store.format.toUpperCase()}`
              : 'Select notes to export'}
        </button>
      </div>
    </div>
  );
}

export default BatchExportPanel;
