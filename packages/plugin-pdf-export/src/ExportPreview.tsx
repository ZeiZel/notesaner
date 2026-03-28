/**
 * ExportPreview — Live scaled-down preview of the exported note.
 *
 * Renders the current export settings as a print-ready HTML document inside
 * an iframe. The iframe is scaled down to fit within the preview container
 * while preserving aspect ratio.
 *
 * The preview updates whenever `html` changes (debounced by the parent).
 * Heavy content (large images, math) may cause a momentary blank flash while
 * the iframe reloads — this is expected and not a bug.
 */

import { useEffect, useRef, useState, useCallback, type JSX } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExportPreviewProps {
  /** Full HTML document string to preview (output of renderToPdf). */
  html: string;
  /** Page size label shown in the chrome above the preview. */
  pageSizeLabel?: string;
  /** Whether the content is being regenerated (shows a spinner overlay). */
  loading?: boolean;
  /** Optional CSS class name for the outer container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * A scaled-down live preview of a PDF export HTML document.
 *
 * The iframe content is set via `srcdoc` so no network request is needed.
 * A CSS transform scales the iframe to fit the preview pane.
 */
export function ExportPreview({
  html,
  pageSizeLabel = 'A4',
  loading = false,
  className = '',
}: ExportPreviewProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0.5);

  // A4 dimensions in px at 96 dpi: 210mm × 297mm
  const PAGE_WIDTH_PX = 794;
  const PAGE_HEIGHT_PX = 1123;

  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth;
    if (containerWidth <= 0) return;
    // Leave 16px padding on each side
    const newScale = Math.min((containerWidth - 32) / PAGE_WIDTH_PX, 1);
    setScale(newScale);
  }, []);

  // Update scale on mount and on container resize
  useEffect(() => {
    updateScale();

    const ro = new ResizeObserver(updateScale);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [updateScale]);

  // Inject HTML into the iframe via srcdoc
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !html) return;
    iframe.srcdoc = html;
  }, [html]);

  const scaledHeight = PAGE_HEIGHT_PX * scale;

  return (
    <div
      ref={containerRef}
      className={`ep-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        background: '#e5e7eb',
        borderRadius: '6px',
        padding: '8px',
        boxSizing: 'border-box',
      }}
    >
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)',
            zIndex: 10,
            borderRadius: '6px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#6b7280' }}>Updating preview…</span>
        </div>
      )}

      {/* Page chrome */}
      <div
        style={{
          fontSize: '11px',
          color: '#9ca3af',
          textAlign: 'center',
          marginBottom: '4px',
          userSelect: 'none',
        }}
      >
        {pageSizeLabel} — {Math.round(scale * 100)}%
      </div>

      {/* Page shadow wrapper */}
      <div
        style={{
          width: PAGE_WIDTH_PX * scale,
          height: scaledHeight,
          margin: '0 auto',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          background: '#fff',
          overflow: 'hidden',
          borderRadius: '2px',
        }}
      >
        <iframe
          ref={iframeRef}
          title="Export preview"
          sandbox="allow-same-origin"
          style={{
            border: 'none',
            width: PAGE_WIDTH_PX,
            height: PAGE_HEIGHT_PX,
            transformOrigin: '0 0',
            transform: `scale(${scale})`,
            display: 'block',
          }}
        />
      </div>
    </div>
  );
}

export default ExportPreview;
