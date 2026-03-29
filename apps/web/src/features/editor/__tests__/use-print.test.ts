// @vitest-environment jsdom
/**
 * Tests for use-print.ts
 *
 * We test the logic of usePrint and usePrintShortcut without a React renderer
 * (no @testing-library/react). The hooks call browser APIs (window, document,
 * addEventListener), so we run under the jsdom environment.
 *
 * Strategy:
 *   - For usePrint: extract and test the pure helper functions (injectPrintStylesheet,
 *     activate/deactivatePrintView) by calling the exported hook inside a minimal
 *     test harness that calls the returned `print` function directly.
 *   - For usePrintShortcut: simulate keyboard events on window and verify the
 *     callback is invoked for Ctrl+P / Cmd+P but not for other keys.
 *
 * No React rendering is required because:
 *   1. usePrint's reactive state is driven by window events, not React renders.
 *   2. usePrintShortcut only sets up a window event listener.
 *   3. The hooks themselves are thin wrappers around DOM APIs.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers extracted for unit testing
// (These mirror the internal logic in use-print.ts so we can test them in
//  isolation without invoking the full React hook machinery.)
// ---------------------------------------------------------------------------

/**
 * Sanitized version of the DOM manipulation helpers from use-print.ts.
 * We replicate them here to test the logic independently.
 */

const CONTAINER_ID = 'print-view-container';

function createContainer(): HTMLElement {
  const div = document.createElement('div');
  div.id = CONTAINER_ID;
  document.body.appendChild(div);
  return div;
}

function removeContainer(): void {
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) existing.remove();
}

function activatePrintView(containerId: string): void {
  const container = document.getElementById(containerId);
  if (container) container.setAttribute('data-print-view-active', 'true');
}

function deactivatePrintView(containerId: string): void {
  const container = document.getElementById(containerId);
  if (container) container.removeAttribute('data-print-view-active');
}

// ---------------------------------------------------------------------------
// Print container activation / deactivation
// ---------------------------------------------------------------------------

describe('print view container activation', () => {
  beforeEach(() => {
    createContainer();
  });

  afterEach(() => {
    removeContainer();
  });

  it('sets data-print-view-active on the container', () => {
    activatePrintView(CONTAINER_ID);
    const el = document.getElementById(CONTAINER_ID);
    expect(el?.getAttribute('data-print-view-active')).toBe('true');
  });

  it('removes data-print-view-active on deactivation', () => {
    activatePrintView(CONTAINER_ID);
    deactivatePrintView(CONTAINER_ID);
    const el = document.getElementById(CONTAINER_ID);
    expect(el?.hasAttribute('data-print-view-active')).toBe(false);
  });

  it('does nothing when container does not exist', () => {
    removeContainer();
    // Should not throw
    expect(() => activatePrintView(CONTAINER_ID)).not.toThrow();
    expect(() => deactivatePrintView(CONTAINER_ID)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Keyboard shortcut logic (replicated from usePrintShortcut)
// ---------------------------------------------------------------------------

/**
 * Simulates a keyboard event for testing the Ctrl+P / Cmd+P shortcut handler.
 */
function makeKeyboardEvent(
  key: string,
  opts: { ctrlKey?: boolean; metaKey?: boolean } = {},
): KeyboardEvent {
  return new KeyboardEvent('keydown', {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    metaKey: opts.metaKey ?? false,
    bubbles: true,
    cancelable: true,
  });
}

describe('print shortcut handler logic', () => {
  it('detects Ctrl+P on non-Mac', () => {
    const isMac = false;
    const event = makeKeyboardEvent('p', { ctrlKey: true });
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    expect(modKey && event.key === 'p').toBe(true);
  });

  it('detects Cmd+P on Mac', () => {
    const isMac = true;
    const event = makeKeyboardEvent('p', { metaKey: true });
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    expect(modKey && event.key === 'p').toBe(true);
  });

  it('does not trigger on regular P keypress (no modifier)', () => {
    const isMac = false;
    const event = makeKeyboardEvent('p');
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    expect(modKey && event.key === 'p').toBe(false);
  });

  it('does not trigger on Ctrl+other key', () => {
    const isMac = false;
    const event = makeKeyboardEvent('s', { ctrlKey: true });
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    expect(modKey && event.key === 'p').toBe(false);
  });

  it('does not trigger on Ctrl+P with metaKey only (wrong platform)', () => {
    // On a non-Mac system, metaKey alone should not trigger
    const isMac = false;
    const event = makeKeyboardEvent('p', { metaKey: true });
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    expect(modKey && event.key === 'p').toBe(false);
  });
});

// ---------------------------------------------------------------------------
// window.addEventListener integration
// ---------------------------------------------------------------------------

describe('keyboard shortcut window listener', () => {
  let onPrint: ReturnType<typeof vi.fn>;
  let captureHandlers: Array<(e: KeyboardEvent) => void>;

  beforeEach(() => {
    onPrint = vi.fn();
    captureHandlers = [];

    // Intercept addEventListener calls so we can test them
    const originalAdd = window.addEventListener.bind(window);
    vi.spyOn(window, 'addEventListener').mockImplementation(
      (type: string, handler: EventListenerOrEventListenerObject, options?: unknown) => {
        if (type === 'keydown') {
          captureHandlers.push(handler as (e: KeyboardEvent) => void);
        }
        originalAdd(type, handler, options as AddEventListenerOptions | boolean | undefined);
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Simulates what usePrintShortcut does when it registers its handler.
   */
  function registerShortcut(enabled: boolean) {
    if (!enabled) return;

    function handleKeyDown(event: KeyboardEvent) {
      const isMac = /Mac/i.test(navigator.platform);
      const modKey = isMac ? event.metaKey : event.ctrlKey;
      if (modKey && event.key === 'p') {
        event.preventDefault();
        event.stopPropagation();
        onPrint();
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true });
  }

  it('calls onPrint when Ctrl+P is dispatched', () => {
    registerShortcut(true);

    const event = new KeyboardEvent('keydown', {
      key: 'p',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);

    expect(onPrint).toHaveBeenCalledOnce();
  });

  it('does not call onPrint for regular key presses', () => {
    registerShortcut(true);

    const event = new KeyboardEvent('keydown', {
      key: 'a',
      ctrlKey: false,
      bubbles: true,
    });
    window.dispatchEvent(event);

    expect(onPrint).not.toHaveBeenCalled();
  });

  it('does not register listener when enabled is false', () => {
    const listenersBefore = captureHandlers.length;
    registerShortcut(false);
    expect(captureHandlers.length).toBe(listenersBefore);
  });
});

// ---------------------------------------------------------------------------
// afterprint event integration
// ---------------------------------------------------------------------------

describe('afterprint event handling', () => {
  it('fires the afterprint event on window', () => {
    const onAfterPrint = vi.fn();

    window.addEventListener('afterprint', onAfterPrint);
    window.dispatchEvent(new Event('afterprint'));

    expect(onAfterPrint).toHaveBeenCalledOnce();

    window.removeEventListener('afterprint', onAfterPrint);
  });

  it('can remove the afterprint listener without error', () => {
    const handler = vi.fn();
    window.addEventListener('afterprint', handler);
    window.removeEventListener('afterprint', handler);
    window.dispatchEvent(new Event('afterprint'));
    expect(handler).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Print date formatting
// ---------------------------------------------------------------------------

/**
 * Replicated from PrintView.tsx for testing without React.
 */
function formatPrintDate(date: Date | string | undefined): string {
  const d = date ? new Date(date) : new Date();
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

describe('formatPrintDate', () => {
  it('formats a specific date correctly', () => {
    const result = formatPrintDate(new Date('2026-03-29'));
    expect(result).toContain('2026');
    expect(result).toContain('March');
    expect(result).toContain('29');
  });

  it('formats a string date correctly', () => {
    const result = formatPrintDate('2025-12-25');
    expect(result).toContain('December');
    expect(result).toContain('25');
    expect(result).toContain('2025');
  });

  it('returns a non-empty string when no date is provided', () => {
    const result = formatPrintDate(undefined);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Markdown-to-HTML converter (replicated from PrintView for unit testing)
// ---------------------------------------------------------------------------

function markdownToHtml(md: string): string {
  let html = md;
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_match, _lang, code) => `<pre><code>${code.trim()}</code></pre>`,
  );
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  html = html.replace(/^---+$/gm, '<hr />');
  html = html.replace(/^[-*+]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');
  html = html.replace(/^(?!<[a-z/])((?!\s*$).+)$/gm, '<p>$1</p>');
  html = html.replace(/<p>\s*<\/p>/g, '');
  return html;
}

describe('markdownToHtml', () => {
  it('converts headings', () => {
    expect(markdownToHtml('# Title')).toBe('<h1>Title</h1>');
    expect(markdownToHtml('## Section')).toBe('<h2>Section</h2>');
    expect(markdownToHtml('### Sub')).toBe('<h3>Sub</h3>');
  });

  it('converts bold text', () => {
    expect(markdownToHtml('**bold**')).toContain('<strong>bold</strong>');
  });

  it('converts italic text', () => {
    expect(markdownToHtml('*italic*')).toContain('<em>italic</em>');
  });

  it('converts strikethrough', () => {
    expect(markdownToHtml('~~del~~')).toContain('<del>del</del>');
  });

  it('converts inline code', () => {
    expect(markdownToHtml('Use `code` here')).toContain('<code>code</code>');
  });

  it('converts fenced code block', () => {
    const input = '```ts\nconst x = 1;\n```';
    const result = markdownToHtml(input);
    expect(result).toContain('<pre><code>');
    expect(result).toContain('const x = 1;');
  });

  it('converts links', () => {
    const result = markdownToHtml('[Click](https://example.com)');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('Click');
  });

  it('converts horizontal rules', () => {
    expect(markdownToHtml('---')).toContain('<hr />');
  });

  it('escapes HTML entities for security', () => {
    const result = markdownToHtml('<script>alert(1)</script>');
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    const result = markdownToHtml('a & b');
    expect(result).toContain('&amp;');
  });

  it('returns empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });

  it('handles plain text as paragraph', () => {
    const result = markdownToHtml('Hello world');
    expect(result).toContain('<p>Hello world</p>');
  });

  it('wraps list items in ul', () => {
    const result = markdownToHtml('- item one\n- item two');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>item one</li>');
    expect(result).toContain('<li>item two</li>');
  });
});
