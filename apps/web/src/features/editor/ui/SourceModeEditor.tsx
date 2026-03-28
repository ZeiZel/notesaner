'use client';

/**
 * SourceModeEditor — CodeMirror 6 editor with Markdown syntax highlighting.
 *
 * Used as the source-code editing surface when the editor is in 'source' or
 * 'preview' mode. Provides plain-text editing with Markdown grammar awareness
 * so that headings, bold, links, code blocks, etc. are visually distinct.
 *
 * Design decisions:
 *   - Uses a single useEffect for CodeMirror lifecycle (mount/destroy) — this
 *     is a valid useEffect use case (third-party library integration).
 *   - Content sync uses EditorView.dispatch for external updates to avoid
 *     destroying and recreating the editor on every keystroke.
 *   - Theme colors are pulled from CSS custom properties to match the
 *     Notesaner design token system (Catppuccin Mocha / Latte).
 */

import { useRef, useEffect } from 'react';
import { EditorState } from '@codemirror/state';
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from '@codemirror/view';
import { markdown } from '@codemirror/lang-markdown';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import {
  syntaxHighlighting,
  defaultHighlightStyle,
  HighlightStyle,
  bracketMatching,
  foldGutter,
  indentOnInput,
} from '@codemirror/language';
import { tags } from '@lezer/highlight';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SourceModeEditorProps {
  /** Current markdown content. */
  value: string;
  /** Callback fired whenever the content changes. */
  onChange: (value: string) => void;
  /** Whether the editor is read-only (used in live preview split). */
  readOnly?: boolean;
  /** Additional CSS class names for the wrapper div. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Custom Highlight Theme
// ---------------------------------------------------------------------------

/**
 * Syntax highlighting theme using Catppuccin-inspired colors via CSS custom
 * properties. Falls back to the default highlight style for tokens not
 * explicitly styled.
 */
const notesanerHighlightStyle = HighlightStyle.define([
  { tag: tags.heading1, color: 'var(--ns-color-mauve)', fontWeight: '700', fontSize: '1.6em' },
  { tag: tags.heading2, color: 'var(--ns-color-mauve)', fontWeight: '600', fontSize: '1.4em' },
  { tag: tags.heading3, color: 'var(--ns-color-mauve)', fontWeight: '600', fontSize: '1.2em' },
  {
    tag: [tags.heading4, tags.heading5, tags.heading6],
    color: 'var(--ns-color-mauve)',
    fontWeight: '600',
  },
  { tag: tags.strong, color: 'var(--ns-color-peach)', fontWeight: '700' },
  { tag: tags.emphasis, color: 'var(--ns-color-pink)', fontStyle: 'italic' },
  {
    tag: tags.strikethrough,
    textDecoration: 'line-through',
    color: 'var(--ns-color-foreground-muted)',
  },
  { tag: tags.link, color: 'var(--ns-color-blue)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--ns-color-sapphire)' },
  { tag: [tags.processingInstruction, tags.inserted], color: 'var(--ns-color-green)' },
  { tag: tags.string, color: 'var(--ns-color-green)' },
  { tag: [tags.monospace, tags.special(tags.string)], color: 'var(--ns-color-teal)' },
  { tag: tags.meta, color: 'var(--ns-color-yellow)' },
  { tag: tags.comment, color: 'var(--ns-color-foreground-muted)', fontStyle: 'italic' },
  { tag: tags.quote, color: 'var(--ns-color-lavender)', fontStyle: 'italic' },
  { tag: tags.atom, color: 'var(--ns-color-red)' },
  { tag: tags.punctuation, color: 'var(--ns-color-foreground-muted)' },
  { tag: tags.contentSeparator, color: 'var(--ns-color-foreground-muted)' },
]);

// ---------------------------------------------------------------------------
// CodeMirror Base Theme
// ---------------------------------------------------------------------------

/**
 * Base editor theme that integrates with the Notesaner design token system.
 * Uses CSS custom properties so it automatically adapts to light/dark themes.
 */
const notesanerEditorTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--ns-color-background)',
    color: 'var(--ns-color-foreground)',
    fontSize: 'var(--ns-text-base)',
    fontFamily: 'var(--ns-font-mono)',
    height: '100%',
  },
  '.cm-content': {
    caretColor: 'var(--ns-color-primary)',
    padding: '16px 0',
    fontFamily: 'var(--ns-font-mono)',
    lineHeight: 'var(--ns-leading-relaxed)',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--ns-color-primary)',
    borderLeftWidth: '2px',
  },
  '.cm-focused .cm-cursor': {
    borderLeftColor: 'var(--ns-color-primary)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--ns-color-primary-muted) !important',
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--ns-color-background-hover)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--ns-color-background-surface)',
    color: 'var(--ns-color-foreground-muted)',
    borderRight: '1px solid var(--ns-color-border-subtle)',
    fontSize: 'var(--ns-text-xs)',
    minWidth: '3.5em',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'var(--ns-color-background-active)',
    color: 'var(--ns-color-foreground-secondary)',
  },
  '.cm-foldGutter': {
    width: '16px',
  },
  '.cm-foldPlaceholder': {
    backgroundColor: 'var(--ns-color-secondary)',
    color: 'var(--ns-color-foreground-muted)',
    border: 'none',
    padding: '0 4px',
    borderRadius: '2px',
    margin: '0 2px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--ns-font-mono)',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--ns-color-popover)',
    color: 'var(--ns-color-popover-foreground)',
    border: '1px solid var(--ns-color-border)',
    borderRadius: 'var(--ns-radius-md)',
    boxShadow: 'var(--ns-shadow-md)',
  },
  '.cm-panels': {
    backgroundColor: 'var(--ns-color-background-surface)',
    color: 'var(--ns-color-foreground)',
  },
  '.cm-panels-top': {
    borderBottom: '1px solid var(--ns-color-border)',
  },
  '.cm-panels-bottom': {
    borderTop: '1px solid var(--ns-color-border)',
  },
  '.cm-matchingBracket': {
    backgroundColor: 'var(--ns-color-accent-muted)',
    outline: '1px solid var(--ns-color-accent)',
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SourceModeEditor({
  value,
  onChange,
  readOnly = false,
  className,
}: SourceModeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Track whether the current update is external (from prop) vs internal (from typing).
  const isExternalUpdate = useRef(false);

  // CodeMirror lifecycle: mount on first render, destroy on unmount.
  // This is a valid useEffect — third-party library integration.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const state = EditorState.create({
      doc: value,
      extensions: [
        // Core editing
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),

        // Gutters
        lineNumbers(),
        highlightActiveLine(),
        foldGutter(),

        // Markdown language support
        markdown(),
        syntaxHighlighting(notesanerHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

        // Keymaps
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),

        // Read-only state
        EditorState.readOnly.of(readOnly),

        // Theme
        notesanerEditorTheme,

        // Update listener — fires on doc changes.
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !isExternalUpdate.current) {
            const newValue = update.state.doc.toString();
            onChangeRef.current(newValue);
          }
        }),
      ],
    });

    const view = new EditorView({ state, parent: container });
    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Intentionally only run on mount. Content sync is handled below.
  }, [readOnly]);

  // Sync external value changes into CodeMirror without recreating the editor.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentValue = view.state.doc.toString();
    if (currentValue !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentValue.length,
          insert: value,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={className}
      data-testid="source-mode-editor"
      style={{
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}

SourceModeEditor.displayName = 'SourceModeEditor';
