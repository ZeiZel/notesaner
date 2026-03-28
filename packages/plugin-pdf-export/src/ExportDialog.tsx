/**
 * ExportDialog — Export settings dialog for single-note PDF/DOCX/HTML export.
 *
 * Shows:
 *   - Format picker (PDF / DOCX / HTML)
 *   - Page settings (size, margins, font)
 *   - Content options (TOC, images, page breaks)
 *   - Style preset selector + custom CSS textarea
 *   - Live preview panel (PDF only)
 *   - Export button
 *
 * State is managed entirely via `useExportStore`. The dialog does not own any
 * local settings state so it can be unmounted and remounted without losing
 * user preferences.
 */

import {
  useState,
  useCallback,
  useEffect,
  useRef,
  type JSX,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { useExportStore } from './export-store';
import { getStylePresets, type PageSize } from './export-styles';
import { renderToPdf } from './pdf-renderer';
import { renderToDocx } from './docx-renderer';
import { createZipBlob, packDocxEntries, downloadBlob, titleToFilename } from './zip-utils';
import { ExportPreview } from './ExportPreview';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportDialogProps {
  /** Whether the dialog is visible. */
  open: boolean;
  /** Called when the user closes the dialog (X button or backdrop click). */
  onClose: () => void;
  /** The markdown content of the note to export. */
  markdown: string;
  /** The note title used as the document heading and filename. */
  noteTitle: string;
  /** Whether a batch export is in progress (disables the single-export button). */
  batchInProgress?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAGE_SIZES: PageSize[] = ['A4', 'Letter', 'Legal'];

const FONT_FAMILIES = [
  { value: '', label: 'System Default' },
  { value: "'Georgia', 'Times New Roman', serif", label: 'Georgia (Serif)' },
  { value: "'Helvetica Neue', Arial, sans-serif", label: 'Helvetica (Sans)' },
  { value: "'Courier New', Courier, monospace", label: 'Courier New (Mono)' },
  { value: "'Calibri', 'Gill Sans', sans-serif", label: 'Calibri (Sans)' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ExportDialog({
  open,
  onClose,
  markdown,
  noteTitle,
  batchInProgress = false,
}: ExportDialogProps): JSX.Element | null {
  const store = useExportStore();
  const previewDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'settings' | 'preview'>('settings');
  const presets = getStylePresets();

  // Regenerate preview whenever relevant settings change (debounced 400ms)
  const regeneratePreview = useCallback(() => {
    if (store.format !== 'pdf') return;
    if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);

    previewDebounceRef.current = setTimeout(() => {
      setPreviewLoading(true);
      try {
        const result = renderToPdf({
          markdown,
          title: noteTitle,
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
        setPreviewHtml(result.html);
      } catch (err) {
        // Preview failures are non-fatal
        console.error('[ExportDialog] Preview error:', err);
      } finally {
        setPreviewLoading(false);
      }
    }, 400);
  }, [
    markdown,
    noteTitle,
    store.format,
    store.pageSize,
    store.margins,
    store.fontSize,
    store.fontFamily,
    store.preset,
    store.customCSS,
    store.includeToc,
    store.pageBreakBeforeH2,
    store.tocMaxDepth,
  ]);

  useEffect(() => {
    if (open) regeneratePreview();
  }, [open, regeneratePreview]);

  useEffect(() => {
    return () => {
      if (previewDebounceRef.current) clearTimeout(previewDebounceRef.current);
    };
  }, []);

  // ---- Export handler ----
  const handleExport = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (exporting || batchInProgress) return;

      setExporting(true);
      setExportError(null);

      try {
        const format = store.format;

        if (format === 'pdf' || format === 'html') {
          const result = renderToPdf({
            markdown,
            title: noteTitle,
            pageSize: store.pageSize,
            margins: store.margins,
            fontSize: store.fontSize,
            fontFamily: store.fontFamily,
            preset: store.preset,
            customCSS: store.customCSS,
            includeToc: store.includeToc,
            includeImages: store.includeImages,
            pageBreakBeforeH2: store.pageBreakBeforeH2,
            tocMaxDepth: store.tocMaxDepth,
          } as Parameters<typeof renderToPdf>[0]);

          if (format === 'html') {
            const blob = new Blob([result.html], { type: 'text/html;charset=utf-8' });
            downloadBlob(blob, titleToFilename(noteTitle, '.html'));
          } else {
            // PDF: open in new window and print
            const win = window.open('', '_blank');
            if (win) {
              win.document.write(result.html);
              win.document.close();
              // Give the browser time to render fonts/images before triggering print
              setTimeout(() => {
                win.print();
              }, 500);
            } else {
              setExportError('Could not open print window. Check your browser pop-up settings.');
            }
          }
        } else if (format === 'docx') {
          const entries = renderToDocx({
            markdown,
            title: noteTitle,
            includeToc: store.includeToc,
            halfPointFontSize: store.fontSize * 2,
          });

          const zipFiles = packDocxEntries(entries);
          const blob = createZipBlob(zipFiles);
          // .docx is a zip file with specific OOXML entries
          const docxBlob = new Blob([await blob.arrayBuffer()], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          });
          downloadBlob(docxBlob, titleToFilename(noteTitle, '.docx'));
        }

        onClose();
      } catch (err) {
        setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
      } finally {
        setExporting(false);
      }
    },
    [exporting, batchInProgress, markdown, noteTitle, store, onClose],
  );

  if (!open) return null;

  // ---- Inline styles (scoped with ed- prefix) ----
  const styles = `
    .ed-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.45);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .ed-dialog {
      background: #fff;
      border-radius: 8px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.18);
      width: 760px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 13px;
      color: #1a1a1a;
    }
    .ed-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .ed-title {
      font-size: 15px;
      font-weight: 600;
    }
    .ed-close {
      background: none;
      border: none;
      cursor: pointer;
      color: #6b7280;
      font-size: 18px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .ed-close:hover { background: #f3f4f6; color: #1a1a1a; }
    .ed-tabs {
      display: flex;
      gap: 2px;
      padding: 8px 18px 0;
      border-bottom: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .ed-tab {
      padding: 6px 14px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: 13px;
      color: #6b7280;
      border-bottom: 2px solid transparent;
      margin-bottom: -1px;
    }
    .ed-tab.active {
      color: #6366f1;
      border-bottom-color: #6366f1;
      font-weight: 500;
    }
    .ed-body {
      flex: 1;
      overflow-y: auto;
      padding: 18px;
    }
    .ed-section {
      margin-bottom: 20px;
    }
    .ed-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #9ca3af;
      margin-bottom: 8px;
    }
    .ed-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .ed-label {
      flex: 0 0 110px;
      color: #4b5563;
      font-size: 13px;
    }
    .ed-control {
      flex: 1;
    }
    .ed-select, .ed-input {
      width: 100%;
      padding: 5px 8px;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-size: 13px;
      background: #fff;
      color: #1a1a1a;
      appearance: auto;
    }
    .ed-select:focus, .ed-input:focus {
      outline: 2px solid #6366f1;
      outline-offset: -1px;
    }
    .ed-margins {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .ed-margin-item {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ed-margin-label {
      flex: 0 0 50px;
      font-size: 12px;
      color: #6b7280;
    }
    .ed-margin-input {
      flex: 1;
      padding: 4px 6px;
      border: 1px solid #d1d5db;
      border-radius: 4px;
      font-size: 12px;
      width: 100%;
    }
    .ed-checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 6px;
    }
    .ed-checkbox-row label {
      cursor: pointer;
      color: #374151;
    }
    .ed-preset-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }
    .ed-preset-btn {
      padding: 8px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s, background 0.15s;
    }
    .ed-preset-btn:hover {
      border-color: #a5b4fc;
      background: #eff1ff;
    }
    .ed-preset-btn.active {
      border-color: #6366f1;
      background: #eff1ff;
    }
    .ed-preset-name {
      font-weight: 600;
      font-size: 12px;
      margin-bottom: 2px;
    }
    .ed-preset-desc {
      font-size: 11px;
      color: #6b7280;
      line-height: 1.3;
    }
    .ed-textarea {
      width: 100%;
      padding: 8px;
      border: 1px solid #d1d5db;
      border-radius: 5px;
      font-family: 'Courier New', monospace;
      font-size: 12px;
      resize: vertical;
      min-height: 80px;
      box-sizing: border-box;
    }
    .ed-footer {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding: 14px 18px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .ed-btn {
      padding: 7px 16px;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      border: 1px solid transparent;
      font-weight: 500;
    }
    .ed-btn-secondary {
      background: #f3f4f6;
      color: #374151;
      border-color: #d1d5db;
    }
    .ed-btn-secondary:hover { background: #e5e7eb; }
    .ed-btn-primary {
      background: #6366f1;
      color: #fff;
    }
    .ed-btn-primary:hover:not(:disabled) { background: #4f46e5; }
    .ed-btn-primary:disabled { opacity: 0.55; cursor: default; }
    .ed-error {
      color: #ef4444;
      font-size: 12px;
      flex: 1;
    }
    .ed-format-grid {
      display: flex;
      gap: 8px;
    }
    .ed-format-btn {
      flex: 1;
      padding: 10px 8px;
      border: 2px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      cursor: pointer;
      text-align: center;
      font-size: 13px;
      font-weight: 500;
      transition: border-color 0.15s;
    }
    .ed-format-btn:hover { border-color: #a5b4fc; }
    .ed-format-btn.active { border-color: #6366f1; background: #eff1ff; color: #6366f1; }
    .ed-divider { height: 1px; background: #f3f4f6; margin: 12px 0; }
  `;

  return (
    <div
      className="ed-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{styles}</style>
      <div className="ed-dialog" role="dialog" aria-modal="true" aria-label="Export settings">
        {/* Header */}
        <div className="ed-header">
          <div className="ed-title">Export — {noteTitle}</div>
          <button className="ed-close" onClick={onClose} aria-label="Close dialog">
            &times;
          </button>
        </div>

        {/* Tabs */}
        <div className="ed-tabs">
          <button
            className={`ed-tab ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            Settings
          </button>
          {store.format === 'pdf' && (
            <button
              className={`ed-tab ${activeTab === 'preview' ? 'active' : ''}`}
              onClick={() => setActiveTab('preview')}
            >
              Preview
            </button>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleExport}>
          <div className="ed-body">
            {activeTab === 'settings' && (
              <>
                {/* Format */}
                <div className="ed-section">
                  <div className="ed-section-title">Format</div>
                  <div className="ed-format-grid">
                    {(['pdf', 'docx', 'html'] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        className={`ed-format-btn ${store.format === fmt ? 'active' : ''}`}
                        onClick={() => store.setFormat(fmt)}
                      >
                        {fmt.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="ed-divider" />

                {/* Page settings (PDF/HTML only) */}
                {store.format !== 'docx' && (
                  <>
                    <div className="ed-section">
                      <div className="ed-section-title">Page Settings</div>
                      <div className="ed-row">
                        <div className="ed-label">Page size</div>
                        <div className="ed-control">
                          <select
                            className="ed-select"
                            value={store.pageSize}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                              store.setPageSize(e.target.value as PageSize)
                            }
                          >
                            {PAGE_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="ed-row">
                        <div className="ed-label">Font size (px)</div>
                        <div className="ed-control">
                          <input
                            type="number"
                            className="ed-input"
                            min={8}
                            max={36}
                            value={store.fontSize}
                            onChange={(e: ChangeEvent<HTMLInputElement>) =>
                              store.setFontSize(Number(e.target.value))
                            }
                          />
                        </div>
                      </div>

                      <div className="ed-row">
                        <div className="ed-label">Font family</div>
                        <div className="ed-control">
                          <select
                            className="ed-select"
                            value={store.fontFamily}
                            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                              store.setFontFamily(e.target.value)
                            }
                          >
                            {FONT_FAMILIES.map((f) => (
                              <option key={f.value} value={f.value}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Margins */}
                      <div className="ed-row" style={{ alignItems: 'flex-start' }}>
                        <div className="ed-label">Margins (mm)</div>
                        <div className="ed-control">
                          <div className="ed-margins">
                            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
                              <div className="ed-margin-item" key={side}>
                                <span className="ed-margin-label">
                                  {side.charAt(0).toUpperCase() + side.slice(1)}
                                </span>
                                <input
                                  type="number"
                                  className="ed-margin-input"
                                  min={0}
                                  max={100}
                                  value={store.margins[side]}
                                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                    store.setMargins({ [side]: Number(e.target.value) })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ed-divider" />

                    {/* Style presets */}
                    <div className="ed-section">
                      <div className="ed-section-title">Style Preset</div>
                      <div className="ed-preset-grid">
                        {presets.map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            className={`ed-preset-btn ${store.preset === p.id ? 'active' : ''}`}
                            onClick={() => store.setPreset(p.id)}
                          >
                            <div className="ed-preset-name">{p.label}</div>
                            <div className="ed-preset-desc">{p.description}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Custom CSS */}
                    <div className="ed-section">
                      <div className="ed-section-title">Custom CSS</div>
                      <textarea
                        className="ed-textarea"
                        placeholder="/* Add custom CSS here... */"
                        value={store.customCSS}
                        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                          store.setCustomCSS(e.target.value)
                        }
                      />
                    </div>

                    <div className="ed-divider" />
                  </>
                )}

                {/* Content options */}
                <div className="ed-section">
                  <div className="ed-section-title">Content Options</div>
                  <div className="ed-checkbox-row">
                    <input
                      type="checkbox"
                      id="opt-toc"
                      checked={store.includeToc}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        store.setIncludeToc(e.target.checked)
                      }
                    />
                    <label htmlFor="opt-toc">Include table of contents</label>
                  </div>
                  {store.includeToc && (
                    <div className="ed-row" style={{ paddingLeft: '22px' }}>
                      <div className="ed-label">TOC depth</div>
                      <div className="ed-control">
                        <select
                          className="ed-select"
                          value={store.tocMaxDepth}
                          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                            store.setTocMaxDepth(Number(e.target.value))
                          }
                        >
                          {[1, 2, 3, 4, 5, 6].map((d) => (
                            <option key={d} value={d}>
                              h1–h{d}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                  <div className="ed-checkbox-row">
                    <input
                      type="checkbox"
                      id="opt-images"
                      checked={store.includeImages}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        store.setIncludeImages(e.target.checked)
                      }
                    />
                    <label htmlFor="opt-images">Include images</label>
                  </div>
                  {store.format !== 'docx' && (
                    <div className="ed-checkbox-row">
                      <input
                        type="checkbox"
                        id="opt-pagebreak"
                        checked={store.pageBreakBeforeH2}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          store.setPageBreakBeforeH2(e.target.checked)
                        }
                      />
                      <label htmlFor="opt-pagebreak">Page break before each H2</label>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'preview' && store.format === 'pdf' && (
              <ExportPreview
                html={previewHtml}
                pageSizeLabel={store.pageSize}
                loading={previewLoading}
              />
            )}
          </div>

          {/* Footer */}
          <div className="ed-footer">
            {exportError && <div className="ed-error">{exportError}</div>}
            <button
              type="button"
              className="ed-btn ed-btn-secondary"
              onClick={onClose}
              disabled={exporting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="ed-btn ed-btn-primary"
              disabled={exporting || batchInProgress}
            >
              {exporting ? 'Exporting…' : `Export as ${store.format.toUpperCase()}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ExportDialog;
