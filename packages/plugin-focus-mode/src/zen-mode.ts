/**
 * zen-mode — CSS injection for Zen Mode in the Focus Mode plugin.
 *
 * Zen mode hides every piece of UI except the text content and cursor.
 * A pure white (light mode) or near-black (dark mode) background is applied,
 * the text column is constrained to a readable max-width, and all workspace
 * chrome is suppressed via CSS.
 *
 * Implementation notes:
 *   - CSS is injected into a <style> tag with id="notesaner-zen-mode-styles".
 *   - `applyZenMode()` injects the tag and adds a data-attribute to <html>.
 *   - `removeZenMode()` removes both.
 *   - Using a data-attribute on <html> ensures any framework's server-side
 *     rendering / hydration doesn't conflict.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STYLE_TAG_ID = 'notesaner-zen-mode-styles';
const HTML_ATTRIBUTE = 'data-zen-mode';

/** Maximum text column width in pixels (comfortable reading line length). */
export const ZEN_MAX_WIDTH = 680;

// ---------------------------------------------------------------------------
// CSS template
// ---------------------------------------------------------------------------

function buildZenCss(maxWidth: number): string {
  return `
/* ==========================================================
   Notesaner — Zen Mode
   Applied when [data-zen-mode] is present on <html>.
   ========================================================== */

[${HTML_ATTRIBUTE}] {
  --zen-max-width: ${maxWidth}px;
}

/* Hide all workspace chrome */
[${HTML_ATTRIBUTE}] [data-sidebar],
[${HTML_ATTRIBUTE}] [data-tabbar],
[${HTML_ATTRIBUTE}] [data-statusbar],
[${HTML_ATTRIBUTE}] [data-toolbar],
[${HTML_ATTRIBUTE}] [data-panel],
[${HTML_ATTRIBUTE}] [data-topbar],
[${HTML_ATTRIBUTE}] nav,
[${HTML_ATTRIBUTE}] aside,
[${HTML_ATTRIBUTE}] header,
[${HTML_ATTRIBUTE}] footer {
  display: none !important;
}

/* Expand the main content area to fill the viewport */
[${HTML_ATTRIBUTE}] [data-editor-container],
[${HTML_ATTRIBUTE}] main {
  position: fixed !important;
  inset: 0 !important;
  z-index: 9999 !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: flex-start !important;
  background: var(--color-bg, #ffffff) !important;
  overflow-y: auto !important;
  padding: 80px 24px 120px !important;
}

/* Dark mode */
@media (prefers-color-scheme: dark) {
  [${HTML_ATTRIBUTE}] [data-editor-container],
  [${HTML_ATTRIBUTE}] main {
    background: #111111 !important;
  }
}

/* Constrain the prose width */
[${HTML_ATTRIBUTE}] [data-editor-content],
[${HTML_ATTRIBUTE}] .ProseMirror,
[${HTML_ATTRIBUTE}] [data-prose-content] {
  max-width: var(--zen-max-width) !important;
  width: 100% !important;
  font-size: 18px !important;
  line-height: 1.75 !important;
  letter-spacing: 0.01em !important;
}

/* Soft fade at top and bottom edges to reduce eye strain */
[${HTML_ATTRIBUTE}] [data-editor-container]::before,
[${HTML_ATTRIBUTE}] [data-editor-container]::after {
  content: '';
  position: fixed;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 10000;
  pointer-events: none;
}

[${HTML_ATTRIBUTE}] [data-editor-container]::before {
  top: 0;
  background: linear-gradient(to bottom, var(--color-bg, #ffffff), transparent);
}

[${HTML_ATTRIBUTE}] [data-editor-container]::after {
  bottom: 0;
  background: linear-gradient(to top, var(--color-bg, #ffffff), transparent);
}

@media (prefers-color-scheme: dark) {
  [${HTML_ATTRIBUTE}] [data-editor-container]::before {
    background: linear-gradient(to bottom, #111111, transparent);
  }

  [${HTML_ATTRIBUTE}] [data-editor-container]::after {
    background: linear-gradient(to top, #111111, transparent);
  }
}

/* Hide cursor blink when cursor is outside the text area (less distraction) */
[${HTML_ATTRIBUTE}] body {
  cursor: none !important;
}

[${HTML_ATTRIBUTE}] [data-editor-content],
[${HTML_ATTRIBUTE}] .ProseMirror {
  cursor: text !important;
}
`.trim();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Inject zen mode CSS and set the data-attribute on <html>.
 * Safe to call multiple times — idempotent.
 *
 * @param maxWidth  Optional override for the prose column width (default: ZEN_MAX_WIDTH).
 */
export function applyZenMode(maxWidth: number = ZEN_MAX_WIDTH): void {
  if (typeof document === 'undefined') return;

  // Inject styles if not already present
  if (!document.getElementById(STYLE_TAG_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    style.textContent = buildZenCss(maxWidth);
    document.head.appendChild(style);
  }

  // Apply the attribute that activates the CSS
  document.documentElement.setAttribute(HTML_ATTRIBUTE, '');
}

/**
 * Remove zen mode CSS and data-attribute.
 * Safe to call when zen mode is not active — idempotent.
 */
export function removeZenMode(): void {
  if (typeof document === 'undefined') return;

  document.documentElement.removeAttribute(HTML_ATTRIBUTE);

  const style = document.getElementById(STYLE_TAG_ID);
  if (style) {
    style.remove();
  }
}

/** Returns true when zen mode is currently active in the DOM. */
export function isZenModeActive(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.hasAttribute(HTML_ATTRIBUTE);
}
