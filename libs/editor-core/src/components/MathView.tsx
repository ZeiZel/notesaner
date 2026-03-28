/**
 * MathView — React NodeView components for KaTeX math rendering.
 *
 * Exports two components:
 *  - MathInlineView: renders inline math ($...$) as a KaTeX inline element
 *  - MathBlockView: renders display math ($$...$$) as a KaTeX display block
 *
 * Both components share the same editing pattern:
 *  1. In read mode (editor not editable, or node not focused) → KaTeX render
 *  2. On click in editable mode → switch to a raw LaTeX input/textarea
 *  3. On blur or Enter (inline) / Escape → persist the edited latex and
 *     switch back to render mode
 *  4. If KaTeX throws a parse error → display an inline error badge
 *
 * KaTeX is imported dynamically (`import('katex')`) so it is never bundled
 * unless actually needed. A synchronous `require('katex')` fallback is
 * provided for environments (like SSR) that do not support dynamic import.
 *
 * @see libs/editor-core/src/extensions/math-inline.ts
 * @see libs/editor-core/src/extensions/math-block.ts
 */

'use client';

import { useState, useEffect, useRef, useCallback, type ComponentType } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import type { MathInlineAttrs } from '../extensions/math-inline';
import type { MathBlockAttrs } from '../extensions/math-block';

// ---------------------------------------------------------------------------
// KaTeX lazy loader
// ---------------------------------------------------------------------------

/** Minimal subset of the KaTeX API we use. */
interface KaTeXModule {
  renderToString: (
    latex: string,
    options?: {
      displayMode?: boolean;
      throwOnError?: boolean;
      errorColor?: string;
      trust?: boolean;
    },
  ) => string;
}

/** Cached KaTeX module (null = not yet loaded, false = load failed). */
let katexCache: KaTeXModule | null | false = null;

/**
 * Lazily loads KaTeX on first call. Subsequent calls resolve immediately
 * from the module cache.
 */
async function loadKatex(): Promise<KaTeXModule | null> {
  if (katexCache !== null) {
    return katexCache === false ? null : katexCache;
  }

  try {
    // Dynamic import — KaTeX is a peer dependency.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import('katex' as any)) as { default?: KaTeXModule } & KaTeXModule;
    // Handle both default-export (ESM) and direct-export (CommonJS) shapes.
    const katex: KaTeXModule = mod.default ?? mod;
    katexCache = katex;
    return katex;
  } catch {
    katexCache = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

interface RenderResult {
  html: string | null;
  error: string | null;
}

/**
 * Render a LaTeX string to HTML via KaTeX.
 * Returns `{ html, error }` — exactly one of these will be non-null.
 */
async function renderLatex(latex: string, displayMode: boolean): Promise<RenderResult> {
  const katex = await loadKatex();

  if (!katex) {
    return {
      html: null,
      error: 'KaTeX is not installed. Run: pnpm add katex',
    };
  }

  try {
    const html = katex.renderToString(latex, {
      displayMode,
      throwOnError: true,
      errorColor: '#ef4444',
      trust: false,
    });
    return { html, error: null };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid LaTeX expression';
    return { html: null, error: message };
  }
}

// ---------------------------------------------------------------------------
// Shared editing logic hook
// ---------------------------------------------------------------------------

interface UseMathEditingOptions {
  initialLatex: string;
  displayMode: boolean;
  isEditable: boolean;
  onUpdateLatex: (latex: string) => void;
}

interface UseMathEditingResult {
  renderedHtml: string | null;
  renderError: string | null;
  isEditing: boolean;
  editValue: string;
  inputRef: React.RefObject<HTMLTextAreaElement | HTMLInputElement | null>;
  handleStartEditing: () => void;
  handleEditChange: (value: string) => void;
  handleCommit: () => void;
  handleCancelEditing: () => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
}

function useMathEditing({
  initialLatex,
  displayMode,
  isEditable,
  onUpdateLatex,
}: UseMathEditingOptions): UseMathEditingResult {
  const [renderedHtml, setRenderedHtml] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(initialLatex);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  // Re-render when the latex attribute changes externally.
  useEffect(() => {
    setEditValue(initialLatex);
  }, [initialLatex]);

  // Render the current editValue (or initialLatex when not editing).
  useEffect(() => {
    const latexToRender = isEditing ? editValue : initialLatex;

    if (!latexToRender.trim()) {
      setRenderedHtml(null);
      setRenderError(null);
      return;
    }

    let cancelled = false;
    void renderLatex(latexToRender, displayMode).then(({ html, error }) => {
      if (!cancelled) {
        setRenderedHtml(html);
        setRenderError(error);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [initialLatex, isEditing, editValue, displayMode]);

  // Focus the input when editing begins.
  useEffect(() => {
    if (isEditing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        if (
          inputRef.current instanceof HTMLInputElement ||
          inputRef.current instanceof HTMLTextAreaElement
        ) {
          const len = inputRef.current.value.length;
          inputRef.current.setSelectionRange(len, len);
        }
      });
    }
  }, [isEditing]);

  const handleStartEditing = useCallback(() => {
    if (!isEditable) return;
    setIsEditing(true);
  }, [isEditable]);

  const handleEditChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const handleCommit = useCallback(() => {
    const trimmed = editValue.trim();
    onUpdateLatex(trimmed);
    setIsEditing(false);
  }, [editValue, onUpdateLatex]);

  const handleCancelEditing = useCallback(() => {
    setEditValue(initialLatex);
    setIsEditing(false);
  }, [initialLatex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancelEditing();
      }
    },
    [handleCancelEditing],
  );

  return {
    renderedHtml,
    renderError,
    isEditing,
    editValue,
    inputRef,
    handleStartEditing,
    handleEditChange,
    handleCommit,
    handleCancelEditing,
    handleKeyDown,
  };
}

// ---------------------------------------------------------------------------
// MathInlineView — inline math NodeView component
// ---------------------------------------------------------------------------

export type MathInlineViewComponent = ComponentType<ReactNodeViewProps>;

/**
 * TipTap React NodeView for inline math nodes ($...$).
 *
 * - In read mode: renders KaTeX HTML inline.
 * - On click (editable): switches to a single-line text input.
 * - Enter/Blur: commits the edit and returns to render mode.
 * - Escape: discards changes and returns to render mode.
 * - Error state: shows a red error badge with the KaTeX error message.
 * - Empty state: shows a placeholder "$...$" prompt.
 */
export function MathInlineView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as MathInlineAttrs;

  const {
    renderedHtml,
    renderError,
    isEditing,
    editValue,
    inputRef,
    handleStartEditing,
    handleEditChange,
    handleCommit,
    handleCancelEditing: _handleCancelEditing,
    handleKeyDown,
  } = useMathEditing({
    initialLatex: attrs.latex,
    displayMode: false,
    isEditable: editor.isEditable,
    onUpdateLatex: (latex) => updateAttributes({ latex }),
  });

  const handleInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleCommit();
        return;
      }
      handleKeyDown(e);
    },
    [handleCommit, handleKeyDown],
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="span"
      className="ns-math-inline-wrapper"
      data-math-inline=""
      data-math-latex={attrs.latex}
    >
      {isEditing ? (
        // Raw LaTeX input (single line)
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          onChange={(e) => handleEditChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onBlur={handleCommit}
          aria-label="Edit inline math (LaTeX)"
          spellCheck={false}
          className="ns-math-inline-input"
          style={{
            font: 'inherit',
            fontSize: 'inherit',
            fontFamily: 'var(--ns-font-mono, monospace)',
            background: 'var(--ns-math-input-bg, rgba(99, 102, 241, 0.08))',
            border: '1px solid var(--ns-math-input-border, #6366f1)',
            borderRadius: '3px',
            padding: '0 4px',
            outline: 'none',
            minWidth: '4ch',
            width: `${Math.max(editValue.length + 2, 6)}ch`,
          }}
        />
      ) : renderError ? (
        // KaTeX parse error badge
        <span
          className="ns-math-inline ns-math-inline--error"
          title={renderError}
          role="alert"
          aria-live="polite"
          onClick={handleStartEditing}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '2px',
            padding: '0 4px',
            background: 'var(--ns-math-error-bg, #fee2e2)',
            color: 'var(--ns-math-error-color, #ef4444)',
            borderRadius: '3px',
            fontSize: '0.85em',
            cursor: editor.isEditable ? 'pointer' : 'default',
            border: '1px solid var(--ns-math-error-border, #fca5a5)',
            fontFamily: 'var(--ns-font-mono, monospace)',
          }}
        >
          {/* Warning icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 16 16"
            width="12"
            height="12"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 3a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
          </svg>
          <span>LaTeX error</span>
        </span>
      ) : renderedHtml ? (
        // Rendered KaTeX HTML
        <span
          className="ns-math-inline ns-math-inline--rendered"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
          onClick={handleStartEditing}
          title={editor.isEditable ? 'Click to edit LaTeX' : undefined}
          style={{
            cursor: editor.isEditable ? 'pointer' : 'default',
            display: 'inline',
          }}
        />
      ) : (
        // Empty / placeholder state
        <span
          className="ns-math-inline ns-math-inline--empty"
          onClick={handleStartEditing}
          aria-label="Empty math expression — click to edit"
          style={{
            color: 'var(--ns-math-placeholder-color, #9ca3af)',
            fontStyle: 'italic',
            cursor: editor.isEditable ? 'pointer' : 'default',
            fontFamily: 'var(--ns-font-mono, monospace)',
          }}
        >
          $&#8230;$
        </span>
      )}
    </NodeViewWrapper>
  );
}

MathInlineView.displayName = 'MathInlineView';

// ---------------------------------------------------------------------------
// MathBlockView — display math NodeView component
// ---------------------------------------------------------------------------

export type MathBlockViewComponent = ComponentType<ReactNodeViewProps>;

/**
 * TipTap React NodeView for display-mode math blocks ($$...$$).
 *
 * - In read mode: renders KaTeX HTML centered as a display block.
 * - On click (editable): switches to a multi-line textarea.
 * - Blur: commits the edit and returns to render mode.
 * - Escape: discards changes and returns to render mode.
 * - Ctrl+Enter inside textarea: commits the edit.
 * - Error state: shows a full-width error panel below the editor area.
 * - Empty state: shows a centered placeholder.
 */
export function MathBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as MathBlockAttrs;

  const {
    renderedHtml,
    renderError,
    isEditing,
    editValue,
    inputRef,
    handleStartEditing,
    handleEditChange,
    handleCommit,
    handleCancelEditing: _handleCancelEditing,
    handleKeyDown,
  } = useMathEditing({
    initialLatex: attrs.latex,
    displayMode: true,
    isEditable: editor.isEditable,
    onUpdateLatex: (latex) => updateAttributes({ latex }),
  });

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleCommit();
        return;
      }
      handleKeyDown(e);
    },
    [handleCommit, handleKeyDown],
  );

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="div"
      className="ns-math-block-wrapper"
      data-math-block=""
      data-math-latex={attrs.latex}
      style={{
        position: 'relative',
        width: '100%',
        margin: '1em 0',
      }}
    >
      {isEditing ? (
        // Raw LaTeX textarea
        <div
          className="ns-math-block-editor"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
          }}
        >
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={editValue}
            onChange={(e) => handleEditChange(e.target.value)}
            onKeyDown={handleTextareaKeyDown}
            onBlur={handleCommit}
            rows={Math.max(editValue.split('\n').length, 3)}
            aria-label="Edit display math (LaTeX)"
            spellCheck={false}
            className="ns-math-block-textarea"
            style={{
              fontFamily: 'var(--ns-font-mono, monospace)',
              fontSize: '0.9em',
              width: '100%',
              resize: 'vertical',
              background: 'var(--ns-math-input-bg, rgba(99, 102, 241, 0.05))',
              border: '1px solid var(--ns-math-input-border, #6366f1)',
              borderRadius: '4px',
              padding: '8px',
              outline: 'none',
              lineHeight: 1.5,
            }}
          />
          <div
            className="ns-math-block-editor-hint"
            style={{
              fontSize: '0.75em',
              color: 'var(--ns-math-hint-color, #6b7280)',
              userSelect: 'none',
            }}
          >
            Ctrl+Enter to confirm &middot; Escape to cancel
          </div>

          {/* Live preview of what the textarea contains */}
          {renderError ? (
            <ErrorPanel message={renderError} />
          ) : renderedHtml ? (
            <div
              className="ns-math-block-preview"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
              aria-label="Math preview"
              style={{
                overflow: 'auto',
                padding: '8px',
                background: 'var(--ns-math-preview-bg, rgba(99, 102, 241, 0.04))',
                borderRadius: '4px',
              }}
            />
          ) : null}
        </div>
      ) : renderError ? (
        // Full error display when not editing
        <div
          className="ns-math-block ns-math-block--error"
          onClick={handleStartEditing}
          style={{
            cursor: editor.isEditable ? 'pointer' : 'default',
          }}
        >
          {/* Show the (broken) LaTeX source */}
          <pre
            className="ns-math-block-source"
            style={{
              fontFamily: 'var(--ns-font-mono, monospace)',
              fontSize: '0.85em',
              padding: '8px',
              background: 'var(--ns-math-error-source-bg, #fef2f2)',
              borderRadius: '4px 4px 0 0',
              margin: 0,
              overflowX: 'auto',
              color: 'var(--ns-math-source-color, #374151)',
            }}
          >
            {attrs.latex || '(empty)'}
          </pre>
          <ErrorPanel message={renderError} borderRadius="0 0 4px 4px" />
        </div>
      ) : renderedHtml ? (
        // Rendered KaTeX display
        <div
          className="ns-math-block ns-math-block--rendered"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
          onClick={handleStartEditing}
          title={editor.isEditable ? 'Click to edit LaTeX' : undefined}
          style={{
            cursor: editor.isEditable ? 'pointer' : 'default',
            overflow: 'auto',
            textAlign: 'center',
          }}
        />
      ) : (
        // Empty / placeholder state
        <div
          className="ns-math-block ns-math-block--empty"
          onClick={handleStartEditing}
          role="button"
          tabIndex={editor.isEditable ? 0 : -1}
          aria-label="Empty math block — click to add LaTeX"
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') handleStartEditing();
          }}
          style={{
            textAlign: 'center',
            padding: '24px',
            color: 'var(--ns-math-placeholder-color, #9ca3af)',
            fontStyle: 'italic',
            fontFamily: 'var(--ns-font-mono, monospace)',
            cursor: editor.isEditable ? 'pointer' : 'default',
            border: '1px dashed var(--ns-math-placeholder-border, #d1d5db)',
            borderRadius: '4px',
          }}
        >
          $$&#8230;$$
        </div>
      )}
    </NodeViewWrapper>
  );
}

MathBlockView.displayName = 'MathBlockView';

// ---------------------------------------------------------------------------
// Shared sub-component
// ---------------------------------------------------------------------------

interface ErrorPanelProps {
  message: string;
  borderRadius?: string;
}

function ErrorPanel({ message, borderRadius = '4px' }: ErrorPanelProps) {
  return (
    <div
      className="ns-math-error-panel"
      role="alert"
      aria-live="polite"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '6px',
        padding: '8px 12px',
        background: 'var(--ns-math-error-bg, #fee2e2)',
        color: 'var(--ns-math-error-color, #ef4444)',
        border: '1px solid var(--ns-math-error-border, #fca5a5)',
        borderRadius,
        fontSize: '0.85em',
        fontFamily: 'var(--ns-font-mono, monospace)',
        wordBreak: 'break-word',
      }}
    >
      {/* Warning icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="currentColor"
        aria-hidden="true"
        style={{ flexShrink: 0, marginTop: '1px' }}
      >
        <path d="M8 1a7 7 0 1 1 0 14A7 7 0 0 1 8 1Zm0 3a.75.75 0 0 0-.75.75v3.5a.75.75 0 0 0 1.5 0v-3.5A.75.75 0 0 0 8 4Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" />
      </svg>
      <span>
        <strong>LaTeX error:</strong> {message}
      </span>
    </div>
  );
}
