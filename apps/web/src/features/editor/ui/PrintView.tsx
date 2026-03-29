'use client';

/**
 * PrintView — Print-optimized view of note content.
 *
 * This component renders the note in a print-friendly layout with:
 *   - A header showing the note title and print date.
 *   - The rendered note content (same markdown-to-HTML as ReadingModeView).
 *   - A footer showing the note title and page number placeholder.
 *   - Print-specific CSS imported from `./print.css`.
 *
 * The component is always rendered in the DOM but is hidden in screen mode
 * via `display: none`. When the user triggers a print, the `data-print-view-active`
 * attribute is set (by usePrint), which combined with `@media print` CSS
 * makes this the only visible element.
 *
 * Using a dedicated DOM node (rather than a portal) keeps SSR hydration clean
 * and avoids needing `document` access during the initial render.
 *
 * Print button integration:
 *   Pass an `onPrint` callback from the parent; the component also exposes
 *   its own print button (optional) via the `showPrintButton` prop.
 *
 * No useEffect for derived state — word count and formatted date are
 * computed synchronously during render.
 */

import './print.css';
import { Button } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { cn } from '@notesaner/ui';
import { usePrint, usePrintShortcut } from '../lib/use-print';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrintViewProps {
  /**
   * Markdown or plain text content to render in the print view.
   * Supports the same markdown subset as ReadingModeView.
   */
  content: string;
  /** Note title shown in the header and footer. */
  title?: string;
  /**
   * Optional document date. Defaults to the current date at render time
   * when not provided.
   */
  date?: Date | string;
  /**
   * Set to `true` to render a floating print button in screen mode.
   * Defaults to `false` — callers typically add the button to their toolbar.
   */
  showPrintButton?: boolean;
  /**
   * Called just before `window.print()` is invoked.
   * Use this to prepare content (e.g., flush pending Yjs updates).
   */
  onBeforePrint?: () => void;
  /**
   * Called after the print dialog is dismissed.
   */
  onAfterPrint?: () => void;
  /** Additional CSS class names for the outer wrapper. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONTAINER_ID = 'print-view-container';

/**
 * Format a date for the print header.
 * Returns a locale-formatted string like "March 29, 2026".
 */
function formatPrintDate(date: Date | string | undefined): string {
  const d = date ? new Date(date) : new Date();
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

/**
 * Very basic markdown-to-HTML renderer for the print view.
 *
 * Mirrors the implementation in ReadingModeView to keep both views consistent.
 * In a future refactor, this should be extracted to @notesaner/markdown so
 * both views share a single pipeline.
 *
 * NOTE: Input is HTML-escaped first to prevent XSS via note content.
 */
function markdownToHtml(md: string): string {
  let html = md;

  // Escape HTML entities first for security
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Code blocks (fenced) — must come before inline processing
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) => `<pre><code>${code.trim()}</code></pre>`,
  );

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

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
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );

  // Images
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<figure><img src="$2" alt="$1" /><figcaption>$1</figcaption></figure>',
  );

  // Blockquotes
  html = html.replace(/^&gt;\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // Horizontal rules
  html = html.replace(/^---+$/gm, '<hr />');

  // Unordered lists
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs — wrap remaining bare lines
  html = html.replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, '<p>$1</p>');

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');

  return html;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PrintView({
  content,
  title,
  date,
  showPrintButton = false,
  onBeforePrint,
  onAfterPrint,
  className,
}: PrintViewProps) {
  const formattedDate = formatPrintDate(date);
  const renderedHtml = markdownToHtml(content);

  const { print } = usePrint({
    title,
    printContainerId: CONTAINER_ID,
    onBeforePrint,
    onAfterPrint,
  });

  // Override Ctrl+P / Cmd+P with our custom print handler.
  usePrintShortcut({ onPrint: print, enabled: true });

  return (
    <>
      {/* -----------------------------------------------------------------------
          Print view — hidden on screen, visible in @media print.
          The `data-print-view` attribute is targeted by print.css.
          The `data-print-view-active` attribute is added by usePrint just before
          window.print() is called, and removed on afterprint.
          ----------------------------------------------------------------------- */}
      <div
        id={CONTAINER_ID}
        data-print-view
        data-testid="print-view"
        aria-hidden="true"
        className={cn('print-view-root', className)}
        style={{
          // Hidden in screen mode by default.
          // The @media print block in print.css shows [data-print-view] elements.
          display: 'none',
        }}
      >
        {/* Header */}
        <div className="print-header" data-testid="print-header">
          <span className="print-header-title">{title ?? 'Untitled'}</span>
          <span className="print-header-date">{formattedDate}</span>
        </div>

        {/* Note content */}
        <div
          className="print-content"
          data-testid="print-content"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        {/* Footer — page numbers are approximated via CSS counters; browsers
            typically provide real page numbers in the @page margin boxes but
            that requires a separate stylesheet. The footer is rendered as a
            static bottom-of-document element for simplicity. */}
        <div className="print-footer" data-testid="print-footer">
          <span className="print-footer-title">{title ?? 'Untitled'}</span>
          <span className="print-footer-page">Printed: {formattedDate}</span>
        </div>
      </div>

      {/* -----------------------------------------------------------------------
          Optional floating print button (screen mode only).
          Hidden in @media print via the `data-print-hide` attribute.
          ----------------------------------------------------------------------- */}
      {showPrintButton && (
        <div
          data-print-hide
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 100,
          }}
        >
          <Button
            type="primary"
            icon={<PrinterOutlined />}
            onClick={print}
            aria-label="Print note"
            title="Print note (Ctrl+P)"
          >
            Print
          </Button>
        </div>
      )}
    </>
  );
}

PrintView.displayName = 'PrintView';
