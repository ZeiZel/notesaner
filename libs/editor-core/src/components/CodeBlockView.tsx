/**
 * CodeBlockView — React NodeView component for enhanced code blocks.
 *
 * Renders code blocks with:
 * - Syntax highlighting via lowlight (highlight.js)
 * - Language selector dropdown
 * - Copy-to-clipboard button with feedback
 * - Toggleable line numbers
 * - Optional filename header
 *
 * @see libs/editor-core/src/extensions/code-block-enhanced.ts
 */

'use client';

import { useState, useEffect, useRef, useCallback, useMemo, type CSSProperties } from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { CodeBlockEnhancedAttrs } from '../extensions/code-block-enhanced';
import { COMMON_LANGUAGES, resolveLanguage } from '../extensions/code-block-enhanced';

// ---------------------------------------------------------------------------
// Clipboard helper (self-contained — libs cannot import from apps)
// ---------------------------------------------------------------------------

/**
 * Copies code block content to the clipboard with a fallback for older browsers.
 * Normalizes line endings and trims trailing whitespace.
 */
async function copyCodeBlockText(code: string): Promise<boolean> {
  const normalized = code.replace(/\r\n/g, '\n').trimEnd();
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(normalized);
      return true;
    }
    return fallbackCopyText(normalized);
  } catch {
    return fallbackCopyText(normalized);
  }
}

function fallbackCopyText(text: string): boolean {
  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

// ---------------------------------------------------------------------------
// Lowlight lazy loader
// ---------------------------------------------------------------------------

/** Wrapper around lowlight that returns HTML strings instead of hast trees. */
interface LowlightModule {
  highlight: (language: string, code: string) => string;
  highlightAuto: (code: string) => string;
  listLanguages: () => string[];
}

let lowlightCache: LowlightModule | null | false = null;

async function loadLowlight(): Promise<LowlightModule | null> {
  if (lowlightCache !== null) {
    return lowlightCache === false ? null : lowlightCache;
  }

  try {
    // Dynamic import — lowlight is a peer dependency.
    const mod = await import('lowlight');
    const { createLowlight, all } = mod;
    const instance = createLowlight(all);
    const wrapper: LowlightModule = {
      highlight: (lang: string, code: string) => hastToHtml(instance.highlight(lang, code)),
      highlightAuto: (code: string) => hastToHtml(instance.highlightAuto(code)),
      listLanguages: () => instance.listLanguages(),
    };
    lowlightCache = wrapper;
    return wrapper;
  } catch {
    lowlightCache = false;
    return null;
  }
}

// ---------------------------------------------------------------------------
// hast-to-html conversion helper
// ---------------------------------------------------------------------------

function hastToHtml(tree: unknown): string {
  if (!tree || typeof tree !== 'object') return '';
  const node = tree as Record<string, unknown>;

  if (node['type'] === 'text') {
    return escapeHtml(String(node['value'] ?? ''));
  }

  if (node['type'] === 'element') {
    const tag = String(node['tagName'] ?? 'span');
    const props = (node['properties'] ?? {}) as Record<string, unknown>;
    const children = (node['children'] ?? []) as unknown[];
    const classNames = Array.isArray(props['className'])
      ? (props['className'] as string[]).join(' ')
      : '';
    const classAttr = classNames ? ` class="${classNames}"` : '';
    const inner = children.map(hastToHtml).join('');
    return `<${tag}${classAttr}>${inner}</${tag}>`;
  }

  if (node['type'] === 'root' || Array.isArray(node['children'])) {
    const children = (node['children'] ?? []) as unknown[];
    return children.map(hastToHtml).join('');
  }

  return '';
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  wrapper: {
    position: 'relative' as const,
    borderRadius: '6px',
    border: '1px solid var(--ns-code-border, #e2e8f0)',
    overflow: 'hidden',
    margin: '8px 0',
    backgroundColor: 'var(--ns-code-bg, #1e1e2e)',
    fontFamily: 'var(--ns-font-mono, ui-monospace, "Cascadia Code", "Fira Code", monospace)',
  } satisfies CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px',
    backgroundColor: 'var(--ns-code-header-bg, #181825)',
    borderBottom: '1px solid var(--ns-code-border, #313244)',
    gap: '8px',
    minHeight: '32px',
  } satisfies CSSProperties,

  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    overflow: 'hidden',
  } satisfies CSSProperties,

  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  } satisfies CSSProperties,

  languageSelect: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 6px',
    borderRadius: '3px',
    border: '1px solid var(--ns-code-select-border, #45475a)',
    background: 'var(--ns-code-select-bg, #313244)',
    color: 'var(--ns-code-select-color, #cdd6f4)',
    cursor: 'pointer',
    outline: 'none',
    fontFamily: 'inherit',
  } satisfies CSSProperties,

  filename: {
    fontSize: '12px',
    color: 'var(--ns-code-filename-color, #a6adc8)',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: 500,
  } satisfies CSSProperties,

  iconButton: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '3px 6px',
    border: '1px solid var(--ns-code-btn-border, #45475a)',
    borderRadius: '3px',
    background: 'transparent',
    cursor: 'pointer',
    fontSize: '11px',
    color: 'var(--ns-code-btn-color, #a6adc8)',
    gap: '3px',
    transition: 'background 0.1s, color 0.1s',
    whiteSpace: 'nowrap' as const,
  } satisfies CSSProperties,

  codeContainer: {
    display: 'flex',
    overflow: 'auto',
    fontSize: '13px',
    lineHeight: '1.6',
  } satisfies CSSProperties,

  lineNumbers: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    padding: '12px 0',
    paddingRight: '12px',
    paddingLeft: '12px',
    borderRight: '1px solid var(--ns-code-border, #313244)',
    color: 'var(--ns-code-line-number-color, #585b70)',
    fontSize: '13px',
    lineHeight: '1.6',
    userSelect: 'none' as const,
    flexShrink: 0,
    minWidth: '2em',
    textAlign: 'right' as const,
    fontFamily: 'inherit',
  } satisfies CSSProperties,

  codeContent: {
    flex: 1,
    padding: '12px',
    overflow: 'auto',
    color: 'var(--ns-code-color, #cdd6f4)',
    tabSize: 2,
    whiteSpace: 'pre' as const,
  } satisfies CSSProperties,
} as const;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for enhanced code blocks.
 */
export function CodeBlockView({ node, updateAttributes, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as CodeBlockEnhancedAttrs;
  const isEditable = editor.isEditable;
  const code = node.textContent;

  // highlightedHtml is computed for potential future use (e.g. read-only
  // highlighted rendering). Currently, NodeViewContent handles in-editor display.
  const [_highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // -------------------------------------------------------------------------
  // Syntax highlighting
  // -------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      const lowlight = await loadLowlight();
      if (cancelled || !lowlight) {
        setHighlightedHtml(null);
        return;
      }

      try {
        const lang = attrs.language;
        const html =
          lang && lowlight.listLanguages().includes(lang)
            ? lowlight.highlight(lang, code)
            : lowlight.highlightAuto(code);

        if (!cancelled) {
          setHighlightedHtml(html);
        }
      } catch {
        if (!cancelled) {
          setHighlightedHtml(null);
        }
      }
    }

    void highlight();
    return () => {
      cancelled = true;
    };
  }, [code, attrs.language]);

  // -------------------------------------------------------------------------
  // Line numbers
  // -------------------------------------------------------------------------

  const lineCount = useMemo(() => {
    const lines = code.split('\n');
    // Account for trailing newline
    return lines.length;
  }, [code]);

  // -------------------------------------------------------------------------
  // Copy to clipboard
  // -------------------------------------------------------------------------

  const handleCopy = useCallback(async () => {
    try {
      const success = await copyCodeBlockText(code);
      if (success) {
        setCopyState('copied');
        if (copyTimeoutRef.current) {
          clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => {
          setCopyState('idle');
        }, 2000);
      }
    } catch {
      // Swallow: copyCodeBlockText handles fallback internally
    }
  }, [code]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------------------
  // Language change
  // -------------------------------------------------------------------------

  const handleLanguageChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      updateAttributes({ language: resolveLanguage(e.target.value) });
    },
    [updateAttributes],
  );

  // -------------------------------------------------------------------------
  // Toggle line numbers
  // -------------------------------------------------------------------------

  const handleToggleLineNumbers = useCallback(() => {
    updateAttributes({ showLineNumbers: !attrs.showLineNumbers });
  }, [attrs.showLineNumbers, updateAttributes]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <NodeViewWrapper
      as="div"
      className="ns-code-block-wrapper"
      data-node-type="codeBlock"
      style={styles.wrapper}
    >
      {/* Header bar */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {/* Language selector */}
          {isEditable ? (
            <select
              value={attrs.language}
              onChange={handleLanguageChange}
              style={styles.languageSelect}
              aria-label="Programming language"
            >
              {COMMON_LANGUAGES.map((lang) => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          ) : (
            <span
              style={{
                ...styles.filename,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontSize: '10px',
              }}
            >
              {attrs.language || 'plain text'}
            </span>
          )}

          {/* Filename */}
          {attrs.filename && <span style={styles.filename}>{attrs.filename}</span>}
        </div>

        <div style={styles.headerRight}>
          {/* Line numbers toggle */}
          {isEditable && (
            <button
              type="button"
              style={styles.iconButton}
              onClick={handleToggleLineNumbers}
              title={attrs.showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
              aria-label={attrs.showLineNumbers ? 'Hide line numbers' : 'Show line numbers'}
            >
              <LineNumbersIcon />
            </button>
          )}

          {/* Copy button */}
          <button
            type="button"
            style={{
              ...styles.iconButton,
              ...(copyState === 'copied'
                ? {
                    color: 'var(--ns-code-copy-success, #a6e3a1)',
                    borderColor: 'var(--ns-code-copy-success, #a6e3a1)',
                  }
                : {}),
            }}
            onClick={() => void handleCopy()}
            title="Copy code"
            aria-label="Copy code to clipboard"
          >
            {copyState === 'copied' ? <CheckIcon /> : <CopyIcon />}
            <span>{copyState === 'copied' ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Code area */}
      <div style={styles.codeContainer}>
        {/* Line numbers */}
        {attrs.showLineNumbers && (
          <div style={styles.lineNumbers} aria-hidden="true" contentEditable={false}>
            {Array.from({ length: lineCount }, (_, i) => (
              <span key={i + 1}>{i + 1}</span>
            ))}
          </div>
        )}

        {/* Code content — editable area where ProseMirror renders text */}
        <NodeViewContent
          className={`ns-code-block__code${attrs.language ? ` language-${attrs.language}` : ''}`}
          style={styles.codeContent}
        />
      </div>
    </NodeViewWrapper>
  );
}

CodeBlockView.displayName = 'CodeBlockView';

// ---------------------------------------------------------------------------
// Inline SVG icons
// ---------------------------------------------------------------------------

function CopyIcon() {
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function LineNumbersIcon() {
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
      <line x1="4" y1="6" x2="4" y2="6.01" />
      <line x1="8" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="4" y2="12.01" />
      <line x1="8" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="4" y2="18.01" />
      <line x1="8" y1="18" x2="20" y2="18" />
    </svg>
  );
}
