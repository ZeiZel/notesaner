'use client';

/**
 * ReadingModeView — clean, distraction-free reading surface.
 *
 * Renders markdown content as styled HTML with reader-optimized typography.
 * No editor chrome, cursors, or editable handles. Designed for focused reading.
 *
 * Features:
 *   - Adjustable font size, line height, content width, and font family
 *   - Typography optimized for reading (larger sizes, more generous line-height)
 *   - Settings popover for real-time typography adjustments
 *   - Exits reading mode on Escape key press
 *   - Renders title, word count, and reading time
 *
 * Design decisions:
 *   - Content is rendered as sanitized HTML from markdown. In a production app
 *     this would use the same markdown-to-HTML pipeline as the TipTap editor's
 *     output. For now, we render the raw markdown with basic HTML styling.
 *   - Reading settings are stored in the editor-mode-store, separate from the
 *     editor typography settings in settings-store.
 *   - No useEffect for derived state — word count and reading time are computed
 *     during render.
 */

import { useRef } from 'react';
import { Popover, Segmented, Slider, Button, Flex, Typography } from 'antd';
import { FontSizeOutlined, EditOutlined } from '@ant-design/icons';
import {
  useEditorModeStore,
  readingFontFamilyCss,
  type ReadingFontFamily,
} from '../model/editor-mode.store';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReadingModeViewProps {
  /** Markdown content to render. */
  content: string;
  /** Optional note title. */
  title?: string;
  /** Optional breadcrumb path segments. */
  breadcrumb?: string[];
  /** Callback to exit reading mode. */
  onExitReadingMode: () => void;
}

// ---------------------------------------------------------------------------
// Helpers — derived during render, no state or effects needed
// ---------------------------------------------------------------------------

function countWords(text: string): number {
  const stripped = text.replace(/[#*_`~\[\]()>!|-]/g, ' ').trim();
  if (stripped.length === 0) return 0;
  return stripped.split(/\s+/).length;
}

function estimateReadingTime(wordCount: number): string {
  const minutes = Math.max(1, Math.ceil(wordCount / 200));
  return `${minutes} min read`;
}

/**
 * Very basic markdown-to-HTML renderer for reading mode.
 *
 * In production, this would use the shared @notesaner/markdown library or
 * the TipTap editor's HTML output. This implementation handles the most common
 * markdown elements for a presentable reading experience.
 */
function markdownToHtml(md: string): string {
  let html = md;

  // Escape HTML entities first for security
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (fenced) — must come before inline processing
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, lang, code) =>
      `<pre class="reading-code-block" data-lang="${lang}"><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="reading-inline-code">$1</code>');

  // Headings
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
  html = html.replace(/_(.+?)_/g, '<em>$1</em>');

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="reading-link" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<figure class="reading-figure"><img src="$2" alt="$1" loading="lazy" /><figcaption>$1</figcaption></figure>',
  );

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote class="reading-blockquote">$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr class="reading-hr" />');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul class="reading-list">$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs — wrap remaining bare lines
  html = html.replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

// ---------------------------------------------------------------------------
// Reading Settings Popover
// ---------------------------------------------------------------------------

const FONT_OPTIONS: { value: ReadingFontFamily; label: string }[] = [
  { value: 'serif', label: 'Serif' },
  { value: 'sans', label: 'Sans-serif' },
  { value: 'mono', label: 'Monospace' },
  { value: 'system', label: 'System' },
];

function ReadingSettingsContent() {
  const readingSettings = useEditorModeStore((s) => s.readingSettings);
  const updateReadingSettings = useEditorModeStore((s) => s.updateReadingSettings);
  const resetReadingSettings = useEditorModeStore((s) => s.resetReadingSettings);

  return (
    <div style={{ width: 260 }}>
      {/* Font family */}
      <div style={{ marginBottom: 16 }}>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
          Font family
        </Text>
        <Segmented
          block
          size="small"
          value={readingSettings.fontFamily}
          onChange={(val) => updateReadingSettings({ fontFamily: val as ReadingFontFamily })}
          options={FONT_OPTIONS.map((opt) => ({ label: opt.label, value: opt.value }))}
        />
      </div>

      {/* Font size */}
      <div style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Font size
          </Text>
          <Text type="secondary" code style={{ fontSize: 11 }}>
            {readingSettings.fontSize}px
          </Text>
        </Flex>
        <Slider
          min={14}
          max={28}
          step={1}
          value={readingSettings.fontSize}
          onChange={(val) => updateReadingSettings({ fontSize: val })}
          tooltip={{ formatter: (val) => `${val}px` }}
        />
      </div>

      {/* Line height */}
      <div style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Line height
          </Text>
          <Text type="secondary" code style={{ fontSize: 11 }}>
            {readingSettings.lineHeight.toFixed(1)}
          </Text>
        </Flex>
        <Slider
          min={1.4}
          max={2.4}
          step={0.1}
          value={readingSettings.lineHeight}
          onChange={(val) => updateReadingSettings({ lineHeight: Math.round(val * 10) / 10 })}
          tooltip={{ formatter: (val) => `${val?.toFixed(1)}` }}
        />
      </div>

      {/* Content width */}
      <div style={{ marginBottom: 16 }}>
        <Flex justify="space-between" align="center" style={{ marginBottom: 2 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Content width
          </Text>
          <Text type="secondary" code style={{ fontSize: 11 }}>
            {readingSettings.contentWidth}ch
          </Text>
        </Flex>
        <Slider
          min={40}
          max={100}
          step={5}
          value={readingSettings.contentWidth}
          onChange={(val) => updateReadingSettings({ contentWidth: val })}
          tooltip={{ formatter: (val) => `${val}ch` }}
        />
      </div>

      {/* Reset */}
      <Button
        type="link"
        size="small"
        onClick={resetReadingSettings}
        style={{ padding: 0, fontSize: 12 }}
      >
        Reset to defaults
      </Button>
    </div>
  );
}

function ReadingSettingsPopover() {
  return (
    <Popover
      content={<ReadingSettingsContent />}
      title="Typography"
      trigger="click"
      placement="bottomRight"
    >
      <Button type="text" size="small" icon={<FontSizeOutlined />} aria-label="Reading settings">
        Typography
      </Button>
    </Popover>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReadingModeView({
  content,
  title,
  breadcrumb,
  onExitReadingMode,
}: ReadingModeViewProps) {
  const readingSettings = useEditorModeStore((s) => s.readingSettings);
  const containerRef = useRef<HTMLDivElement>(null);

  // Derived values — computed during render, no state/effects needed.
  const wordCount = countWords(content);
  const readingTime = estimateReadingTime(wordCount);
  const renderedHtml = markdownToHtml(content);

  return (
    <div
      ref={containerRef}
      className="flex flex-1 flex-col overflow-y-auto"
      role="article"
      aria-label={title ?? 'Reading mode'}
      data-testid="reading-mode-view"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          onExitReadingMode();
        }
      }}
    >
      {/* Reading toolbar — minimal, shows breadcrumb + settings + exit */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between border-b px-6 py-2"
        style={{
          backgroundColor: 'var(--ns-color-background)',
          borderColor: 'var(--ns-color-border-subtle)',
        }}
      >
        <div className="flex items-center gap-2">
          {/* Breadcrumb */}
          {breadcrumb && breadcrumb.length > 0 && (
            <nav
              aria-label="Note path"
              className="flex items-center gap-1 text-xs"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              {breadcrumb.map((segment, i) => (
                <span key={i}>
                  {i > 0 && <span className="mx-1">/</span>}
                  <span
                    className={i === breadcrumb.length - 1 ? '' : ''}
                    style={{
                      color:
                        i === breadcrumb.length - 1
                          ? 'var(--ns-color-foreground-secondary)'
                          : 'var(--ns-color-foreground-muted)',
                    }}
                  >
                    {segment}
                  </span>
                </span>
              ))}
            </nav>
          )}

          {/* Word count / reading time */}
          <div
            className="flex items-center gap-2 text-xs"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            <span>{wordCount.toLocaleString()} words</span>
            <span aria-hidden="true">|</span>
            <span>{readingTime}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ReadingSettingsPopover />

          {/* Exit reading mode button */}
          <Button
            type="text"
            size="small"
            onClick={onExitReadingMode}
            aria-label="Exit reading mode"
            icon={<EditOutlined />}
          >
            Edit
          </Button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex flex-1 justify-center px-6 py-12">
        <div
          className="reading-content w-full"
          style={{
            maxWidth: `${readingSettings.contentWidth}ch`,
            fontFamily: readingFontFamilyCss(readingSettings.fontFamily),
            fontSize: `${readingSettings.fontSize}px`,
            lineHeight: readingSettings.lineHeight,
            color: 'var(--ns-color-foreground)',
          }}
        >
          {/* Title */}
          {title && (
            <h1
              className="mb-8 font-bold"
              style={{
                fontSize: `${readingSettings.fontSize * 2}px`,
                lineHeight: 1.2,
                letterSpacing: '-0.02em',
                color: 'var(--ns-color-foreground)',
              }}
            >
              {title}
            </h1>
          )}

          {/* Rendered markdown */}
          <div className="reading-prose" dangerouslySetInnerHTML={{ __html: renderedHtml }} />
        </div>
      </div>

      {/* Inline styles for reading prose elements */}
      <style>{`
        .reading-prose h1 {
          font-size: 1.8em;
          font-weight: 700;
          margin-top: 2em;
          margin-bottom: 0.8em;
          line-height: 1.2;
          color: var(--ns-color-foreground);
        }
        .reading-prose h2 {
          font-size: 1.5em;
          font-weight: 600;
          margin-top: 1.8em;
          margin-bottom: 0.6em;
          line-height: 1.3;
          color: var(--ns-color-foreground);
        }
        .reading-prose h3 {
          font-size: 1.25em;
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.5em;
          line-height: 1.4;
          color: var(--ns-color-foreground);
        }
        .reading-prose h4,
        .reading-prose h5,
        .reading-prose h6 {
          font-size: 1.1em;
          font-weight: 600;
          margin-top: 1.3em;
          margin-bottom: 0.4em;
          color: var(--ns-color-foreground);
        }
        .reading-prose p {
          margin-bottom: 1em;
        }
        .reading-prose strong {
          font-weight: 700;
          color: var(--ns-color-foreground);
        }
        .reading-prose em {
          font-style: italic;
        }
        .reading-prose del {
          text-decoration: line-through;
          color: var(--ns-color-foreground-muted);
        }
        .reading-link {
          color: var(--ns-color-primary);
          text-decoration: underline;
          text-underline-offset: 2px;
          transition: color 150ms;
        }
        .reading-link:hover {
          color: var(--ns-color-primary-hover);
        }
        .reading-inline-code {
          font-family: var(--ns-font-mono);
          font-size: 0.88em;
          padding: 2px 6px;
          border-radius: 4px;
          background-color: var(--ns-color-secondary);
          color: var(--ns-color-teal);
        }
        .reading-code-block {
          font-family: var(--ns-font-mono);
          font-size: 0.85em;
          line-height: 1.6;
          padding: 16px 20px;
          border-radius: var(--ns-radius-md);
          background-color: var(--ns-color-background-surface);
          border: 1px solid var(--ns-color-border-subtle);
          overflow-x: auto;
          margin: 1.5em 0;
        }
        .reading-code-block code {
          font-family: inherit;
        }
        .reading-blockquote {
          border-left: 3px solid var(--ns-color-primary);
          padding-left: 16px;
          margin: 1.5em 0;
          color: var(--ns-color-foreground-secondary);
          font-style: italic;
        }
        .reading-list {
          padding-left: 1.5em;
          margin: 1em 0;
        }
        .reading-list li {
          margin-bottom: 0.3em;
        }
        .reading-hr {
          border: none;
          border-top: 1px solid var(--ns-color-border);
          margin: 2em 0;
        }
        .reading-figure {
          margin: 2em 0;
          text-align: center;
        }
        .reading-figure img {
          max-width: 100%;
          border-radius: var(--ns-radius-md);
        }
        .reading-figure figcaption {
          margin-top: 0.5em;
          font-size: 0.85em;
          color: var(--ns-color-foreground-muted);
        }
      `}</style>
    </div>
  );
}

ReadingModeView.displayName = 'ReadingModeView';
