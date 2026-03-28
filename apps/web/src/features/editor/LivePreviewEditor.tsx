'use client';

/**
 * LivePreviewEditor — split-pane view with source editor on the left and
 * rendered markdown preview on the right.
 *
 * Updates the preview in real-time as the user types in the source editor.
 * Uses the same SourceModeEditor component for the left pane and a simplified
 * rendering of the markdown content for the right pane.
 *
 * This is a composition component — it does not introduce new state. The
 * markdown content flows through via props and the shared editor-mode-store.
 */

import { SourceModeEditor } from './SourceModeEditor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LivePreviewEditorProps {
  /** Current markdown content. */
  value: string;
  /** Callback fired whenever the source content changes. */
  onChange: (value: string) => void;
  /** Additional CSS class names for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Minimal markdown renderer for the preview pane
// ---------------------------------------------------------------------------

/**
 * Basic markdown-to-HTML for the live preview pane.
 * In production this would share the same pipeline as ReadingModeView.
 */
function markdownToPreviewHtml(md: string): string {
  let html = md;

  // Escape HTML
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (fenced)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_m, lang, code) =>
      `<pre class="preview-code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="preview-inline-code">$1</code>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold / italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="preview-link">$1</a>');

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="preview-blockquote">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="preview-hr" />');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="preview-list">$1</ul>');

  // Paragraphs
  html = html.replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LivePreviewEditor({ value, onChange, className }: LivePreviewEditorProps) {
  const renderedHtml = markdownToPreviewHtml(value);

  return (
    <div className={`flex h-full ${className ?? ''}`} data-testid="live-preview-editor">
      {/* Source pane (left) */}
      <div
        className="flex-1 overflow-hidden border-r"
        style={{ borderColor: 'var(--ns-color-border)' }}
      >
        <SourceModeEditor value={value} onChange={onChange} />
      </div>

      {/* Preview pane (right) */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ backgroundColor: 'var(--ns-color-background)' }}
      >
        <div className="mx-auto max-w-prose px-8 py-6">
          <div className="preview-prose" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>

        <style>{`
          .preview-prose {
            font-family: var(--ns-font-sans);
            font-size: var(--ns-text-base);
            line-height: var(--ns-leading-relaxed);
            color: var(--ns-color-foreground);
          }
          .preview-prose h1 {
            font-size: 1.8em;
            font-weight: 700;
            margin-top: 1.5em;
            margin-bottom: 0.6em;
            line-height: 1.2;
          }
          .preview-prose h2 {
            font-size: 1.5em;
            font-weight: 600;
            margin-top: 1.3em;
            margin-bottom: 0.5em;
            line-height: 1.3;
          }
          .preview-prose h3 {
            font-size: 1.25em;
            font-weight: 600;
            margin-top: 1.2em;
            margin-bottom: 0.4em;
          }
          .preview-prose h4,
          .preview-prose h5,
          .preview-prose h6 {
            font-size: 1.1em;
            font-weight: 600;
            margin-top: 1em;
            margin-bottom: 0.3em;
          }
          .preview-prose p {
            margin-bottom: 0.8em;
          }
          .preview-prose strong {
            font-weight: 700;
          }
          .preview-link {
            color: var(--ns-color-primary);
            text-decoration: underline;
            text-underline-offset: 2px;
          }
          .preview-inline-code {
            font-family: var(--ns-font-mono);
            font-size: 0.88em;
            padding: 1px 5px;
            border-radius: 3px;
            background-color: var(--ns-color-secondary);
            color: var(--ns-color-teal);
          }
          .preview-code-block {
            font-family: var(--ns-font-mono);
            font-size: 0.85em;
            line-height: 1.6;
            padding: 12px 16px;
            border-radius: var(--ns-radius-md);
            background-color: var(--ns-color-background-surface);
            border: 1px solid var(--ns-color-border-subtle);
            overflow-x: auto;
            margin: 1em 0;
          }
          .preview-blockquote {
            border-left: 3px solid var(--ns-color-primary);
            padding-left: 12px;
            margin: 1em 0;
            color: var(--ns-color-foreground-secondary);
            font-style: italic;
          }
          .preview-list {
            padding-left: 1.5em;
            margin: 0.8em 0;
          }
          .preview-list li {
            margin-bottom: 0.2em;
          }
          .preview-hr {
            border: none;
            border-top: 1px solid var(--ns-color-border);
            margin: 1.5em 0;
          }
        `}</style>
      </div>
    </div>
  );
}

LivePreviewEditor.displayName = 'LivePreviewEditor';
