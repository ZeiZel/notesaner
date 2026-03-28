/**
 * MermaidView — React NodeView component for Mermaid diagram blocks.
 *
 * Renders inside the TipTap editor as a split-pane block:
 * - Left pane: editable code textarea (monospace, syntax-aware)
 * - Right pane: live Mermaid diagram preview OR error overlay
 *
 * Features:
 * - Live preview with 300 ms debounce while typing
 * - Theme-aware: follows `data-theme` on `<html>` (dark / light)
 * - Error overlay for invalid Mermaid syntax (shows first error line)
 * - Export toolbar: download as PNG or SVG
 * - Collapsed/expanded toggle for the code pane
 * - Dynamic import of `mermaid` to avoid upfront bundle cost
 *
 * The component is intentionally self-contained and does not depend on
 * any UI library beyond what is already in the editor-core package, so it
 * can be used in any TipTap host application.
 *
 * @see libs/editor-core/src/extensions/mermaid-block.ts
 */

import { useEffect, useRef, useState, useCallback, useId, type CSSProperties } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import type {
  MermaidBlockAttrs,
  MermaidBlockOptions,
  MermaidTheme,
} from '../extensions/mermaid-block';
import { detectDiagramType, resolveMermaidTheme } from '../extensions/mermaid-block';

// ---------------------------------------------------------------------------
// Mermaid dynamic import type shim
// ---------------------------------------------------------------------------

/**
 * Minimal subset of the `mermaid` API we depend on.
 * Using a shim lets the extension compile and run even when the mermaid
 * package is not yet installed — the NodeView degrades gracefully.
 */
interface MermaidAPI {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, definition: string) => Promise<{ svg: string }>;
  parse: (definition: string, parseOptions?: { suppressErrors?: boolean }) => Promise<boolean>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RENDER_DEBOUNCE_MS = 300;
const PLACEHOLDER = 'flowchart TD\n    A[Start] --> B[End]';

// ---------------------------------------------------------------------------
// Utility: export helpers
// ---------------------------------------------------------------------------

/**
 * Trigger a browser download of the given blob under the supplied filename.
 */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after a tick to ensure the download started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export the rendered SVG element as an SVG file download.
 * Returns false when no SVG element is found.
 */
function exportAsSvg(container: HTMLElement, diagramType: string | null): boolean {
  const svgEl = container.querySelector('svg');
  if (!svgEl) return false;

  const svgContent = new XMLSerializer().serializeToString(svgEl);
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, `diagram-${diagramType ?? 'mermaid'}.svg`);
  return true;
}

/**
 * Export the rendered SVG element as a PNG file download.
 * Uses an off-screen Canvas. Returns a Promise<boolean> indicating success.
 */
async function exportAsPng(container: HTMLElement, diagramType: string | null): Promise<boolean> {
  const svgEl = container.querySelector('svg');
  if (!svgEl) return false;

  const svgContent = new XMLSerializer().serializeToString(svgEl);
  const svgWidth = svgEl.viewBox?.baseVal?.width || svgEl.clientWidth || 800;
  const svgHeight = svgEl.viewBox?.baseVal?.height || svgEl.clientHeight || 600;

  return new Promise<boolean>((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      // Use 2x for Retina quality
      canvas.width = svgWidth * 2;
      canvas.height = svgHeight * 2;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(false);
        return;
      }
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) {
          resolve(false);
          return;
        }
        triggerDownload(blob, `diagram-${diagramType ?? 'mermaid'}.png`);
        resolve(true);
      }, 'image/png');
    };
    img.onerror = () => resolve(false);
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
  });
}

// ---------------------------------------------------------------------------
// Styles (inline — no external stylesheet dependency)
// ---------------------------------------------------------------------------

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column' as const,
    border: '1px solid var(--ns-border-color, #e2e8f0)',
    borderRadius: '8px',
    overflow: 'hidden',
    margin: '8px 0',
    backgroundColor: 'var(--ns-surface-bg, #ffffff)',
    fontFamily: 'inherit',
    // Remove TipTap's default node selection ring — we handle our own selection style
    outline: 'none',
  } satisfies CSSProperties,

  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '6px 12px',
    backgroundColor: 'var(--ns-mermaid-toolbar-bg, #f8fafc)',
    borderBottom: '1px solid var(--ns-border-color, #e2e8f0)',
    gap: '8px',
    minHeight: '38px',
  } satisfies CSSProperties,

  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  } satisfies CSSProperties,

  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } satisfies CSSProperties,

  badge: {
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--ns-mermaid-badge-bg, #dbeafe)',
    color: 'var(--ns-mermaid-badge-color, #1e40af)',
    letterSpacing: '0.02em',
    textTransform: 'uppercase' as const,
    userSelect: 'none' as const,
  } satisfies CSSProperties,

  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px 8px',
    border: '1px solid var(--ns-border-color, #e2e8f0)',
    borderRadius: '4px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--ns-text-muted, #64748b)',
    gap: '4px',
    userSelect: 'none' as const,
    transition: 'background 0.1s',
    whiteSpace: 'nowrap' as const,
  } satisfies CSSProperties,

  splitPane: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    minHeight: '180px',
  } satisfies CSSProperties,

  singlePane: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    minHeight: '180px',
  } satisfies CSSProperties,

  codePane: {
    borderRight: '1px solid var(--ns-border-color, #e2e8f0)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  } satisfies CSSProperties,

  textarea: {
    flex: 1,
    width: '100%',
    border: 'none',
    outline: 'none',
    resize: 'none' as const,
    padding: '12px',
    fontFamily: 'var(--ns-font-mono, ui-monospace, "Cascadia Code", monospace)',
    fontSize: '13px',
    lineHeight: '1.6',
    backgroundColor: 'var(--ns-code-bg, #f8fafc)',
    color: 'var(--ns-code-color, #1e293b)',
    minHeight: '160px',
    boxSizing: 'border-box' as const,
    tabSize: 2,
  } satisfies CSSProperties,

  previewPane: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    overflow: 'auto',
    backgroundColor: 'var(--ns-surface-bg, #ffffff)',
    minHeight: '160px',
    position: 'relative' as const,
  } satisfies CSSProperties,

  loadingOverlay: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--ns-text-muted, #94a3b8)',
    fontSize: '13px',
    gap: '8px',
  } satisfies CSSProperties,

  errorOverlay: {
    position: 'absolute' as const,
    inset: 0,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '16px',
    backgroundColor: 'var(--ns-error-bg, #fef2f2)',
    color: 'var(--ns-error-text, #991b1b)',
  } satisfies CSSProperties,

  errorTitle: {
    fontWeight: 600,
    fontSize: '13px',
    marginBottom: '4px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  } satisfies CSSProperties,

  errorDetail: {
    fontFamily: 'var(--ns-font-mono, monospace)',
    fontSize: '11px',
    whiteSpace: 'pre-wrap' as const,
    wordBreak: 'break-all' as const,
    opacity: 0.85,
    maxHeight: '100px',
    overflow: 'auto' as const,
  } satisfies CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for Mermaid diagram blocks.
 */
export function MermaidView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as MermaidBlockAttrs;

  // Use node text content as the authoritative code source (the `code` attr
  // mirrors it, but text content is what ProseMirror actually stores).
  const initialCode = node.textContent || attrs.code || PLACEHOLDER;

  // -------------------------------------------------------------------------
  // State
  // -------------------------------------------------------------------------

  const [code, setCode] = useState<string>(initialCode);
  const [svgHtml, setSvgHtml] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [codeCollapsed, setCodeCollapsed] = useState<boolean>(false);
  const [mermaidApi, setMermaidApi] = useState<MermaidAPI | null>(null);
  const [mermaidLoadError, setMermaidLoadError] = useState<string | null>(null);

  const previewRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const renderCountRef = useRef(0); // Prevents stale async renders from overwriting newer results.

  // Unique ID for mermaid.render() — must be stable per block instance.
  const diagramId = useId().replace(/:/g, '_');

  // Mermaid theme derived from document + option
  const resolvedTheme = resolveMermaidTheme(
    (attrs.theme as MermaidTheme) ??
      (
        editor?.options?.extensions?.find((e) => e.name === 'mermaidBlock')?.options as
          | MermaidBlockOptions
          | undefined
      )?.defaultTheme ??
      'default',
  );

  // -------------------------------------------------------------------------
  // Load mermaid dynamically (once)
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadMermaid() {
      try {
        // Dynamic import — bundlers will split this out automatically.
        const mod = (await import('mermaid')) as { default: MermaidAPI };
        if (cancelled) return;

        const api = mod.default;
        api.initialize({
          startOnLoad: false,
          theme: resolvedTheme,
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        setMermaidApi(api);
      } catch (e) {
        if (!cancelled) {
          setMermaidLoadError(e instanceof Error ? e.message : 'Failed to load Mermaid library');
        }
      }
    }

    void loadMermaid();
    return () => {
      cancelled = true;
    };
    // We intentionally omit resolvedTheme to avoid re-loading mermaid on theme change.
    // Theme changes are handled via re-initialisation in renderDiagram.
  }, []);

  // -------------------------------------------------------------------------
  // Render diagram
  // -------------------------------------------------------------------------

  const renderDiagram = useCallback(
    async (source: string, api: MermaidAPI) => {
      if (!source.trim()) {
        setSvgHtml('');
        setError(null);
        return;
      }

      const thisRender = ++renderCountRef.current;
      setIsLoading(true);
      setError(null);

      try {
        // Re-initialise with the current theme to pick up document theme changes.
        api.initialize({
          startOnLoad: false,
          theme: resolvedTheme,
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });

        const { svg } = await api.render(`${diagramId}-${thisRender}`, source);

        // Discard stale renders.
        if (thisRender !== renderCountRef.current) return;

        setSvgHtml(svg);
        setError(null);
      } catch (e) {
        if (thisRender !== renderCountRef.current) return;

        const msg =
          e instanceof Error ? e.message : typeof e === 'string' ? e : 'Invalid Mermaid syntax';

        // Strip ANSI escape codes that Mermaid sometimes includes in errors.
        setError(msg.replace(/\x1b\[[0-9;]*m/g, '').trim());
        setSvgHtml('');
      } finally {
        if (thisRender === renderCountRef.current) {
          setIsLoading(false);
        }
      }
    },
    [diagramId, resolvedTheme],
  );

  // -------------------------------------------------------------------------
  // Debounced render on code change
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (!mermaidApi) return;

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      void renderDiagram(code, mermaidApi);
    }, RENDER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [code, mermaidApi, renderDiagram]);

  // Sync internal code state when the node content changes externally
  // (e.g. undo/redo, collaborative editing).
  useEffect(() => {
    const incoming = node.textContent || attrs.code || '';
    if (incoming !== code) {
      setCode(incoming);
    }
    // Only run when the node's content changes, not on every render of `code`.
  }, [node.textContent, attrs.code]);

  // -------------------------------------------------------------------------
  // Textarea change handler — update node attrs to persist changes
  // -------------------------------------------------------------------------

  const handleCodeChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newCode = event.target.value;
      setCode(newCode);

      // Persist to the ProseMirror document.
      updateAttributes({
        code: newCode,
        diagramType: detectDiagramType(newCode),
      });
    },
    [updateAttributes],
  );

  // -------------------------------------------------------------------------
  // Export handlers
  // -------------------------------------------------------------------------

  const handleExportSvg = useCallback(() => {
    if (!previewRef.current) return;
    exportAsSvg(previewRef.current, attrs.diagramType);
  }, [attrs.diagramType]);

  const handleExportPng = useCallback(async () => {
    if (!previewRef.current) return;
    await exportAsPng(previewRef.current, attrs.diagramType);
  }, [attrs.diagramType]);

  // -------------------------------------------------------------------------
  // Derived display values
  // -------------------------------------------------------------------------

  const diagramTypeLabel = attrs.diagramType ?? 'mermaid';
  const isEditable = editor.isEditable;
  const hasContent = svgHtml.length > 0;

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="div"
      className="ns-mermaid-block-wrapper"
      data-node-type="mermaidBlock"
      contentEditable={false}
      style={styles.wrapper}
    >
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <span style={styles.badge}>{diagramTypeLabel}</span>
          {isEditable && (
            <button
              type="button"
              style={styles.iconButton}
              onClick={() => setCodeCollapsed((prev) => !prev)}
              title={codeCollapsed ? 'Show code editor' : 'Hide code editor'}
              aria-label={codeCollapsed ? 'Show code editor' : 'Hide code editor'}
            >
              {codeCollapsed ? (
                <>
                  <ExpandIcon />
                  Code
                </>
              ) : (
                <>
                  <CollapseIcon />
                  Code
                </>
              )}
            </button>
          )}
        </div>
        <div style={styles.toolbarRight}>
          {hasContent && (
            <>
              <button
                type="button"
                style={styles.iconButton}
                onClick={handleExportSvg}
                title="Export as SVG"
                aria-label="Export diagram as SVG"
              >
                <DownloadIcon />
                SVG
              </button>
              <button
                type="button"
                style={styles.iconButton}
                onClick={() => void handleExportPng()}
                title="Export as PNG"
                aria-label="Export diagram as PNG"
              >
                <DownloadIcon />
                PNG
              </button>
            </>
          )}
        </div>
      </div>

      {/* Split pane: code editor + preview */}
      <div style={!codeCollapsed && isEditable ? styles.splitPane : styles.singlePane}>
        {/* Code editor pane */}
        {isEditable && !codeCollapsed && (
          <div style={styles.codePane}>
            <textarea
              style={styles.textarea}
              value={code}
              onChange={handleCodeChange}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Mermaid diagram source code"
              placeholder={PLACEHOLDER}
            />
          </div>
        )}

        {/* Preview pane */}
        <div ref={previewRef} style={styles.previewPane}>
          {mermaidLoadError ? (
            <div style={styles.errorOverlay}>
              <p style={styles.errorTitle}>
                <ErrorIcon />
                Mermaid library unavailable
              </p>
              <pre style={styles.errorDetail}>{mermaidLoadError}</pre>
            </div>
          ) : isLoading ? (
            <div style={styles.loadingOverlay}>
              <SpinnerIcon />
              Rendering…
            </div>
          ) : error ? (
            <div style={styles.errorOverlay}>
              <p style={styles.errorTitle}>
                <ErrorIcon />
                Diagram error
              </p>
              <pre style={styles.errorDetail}>{error}</pre>
            </div>
          ) : svgHtml ? (
            <div
              className="ns-mermaid-svg-container"
              // SVG is generated by Mermaid library — we trust its output.
              dangerouslySetInnerHTML={{ __html: svgHtml }}
              style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
            />
          ) : (
            <div style={styles.loadingOverlay}>
              <span style={{ color: 'var(--ns-text-muted, #94a3b8)', fontSize: '13px' }}>
                {mermaidApi ? 'Start typing to preview…' : 'Loading Mermaid…'}
              </span>
            </div>
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

MermaidView.displayName = 'MermaidView';

// ---------------------------------------------------------------------------
// Minimal inline SVG icons (no external icon library dependency)
// ---------------------------------------------------------------------------

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ animation: 'ns-spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

function CollapseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}
