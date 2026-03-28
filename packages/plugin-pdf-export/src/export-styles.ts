/**
 * export-styles — Default print stylesheets and style presets for PDF export.
 *
 * Provides CSS for different page sizes and three named style presets:
 *   - "default"   — Clean, readable, suitable for most notes
 *   - "academic"  — More formal layout with serif fonts and tighter spacing
 *   - "minimal"   — Stripped-back, monospace code emphasis, light headers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Supported page sizes for export. */
export type PageSize = 'A4' | 'Letter' | 'Legal';

/** Margin specification (all values in millimetres). */
export interface PageMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Named style preset identifier. */
export type StylePreset = 'default' | 'academic' | 'minimal';

// ---------------------------------------------------------------------------
// Page dimensions (mm)
// ---------------------------------------------------------------------------

const PAGE_DIMENSIONS: Record<PageSize, { width: number; height: number }> = {
  A4: { width: 210, height: 297 },
  Letter: { width: 216, height: 279 },
  Legal: { width: 216, height: 356 },
};

// ---------------------------------------------------------------------------
// Default margins per page size
// ---------------------------------------------------------------------------

export const DEFAULT_MARGINS: Record<PageSize, PageMargins> = {
  A4: { top: 25, right: 25, bottom: 25, left: 25 },
  Letter: { top: 25, right: 25, bottom: 25, left: 25 },
  Legal: { top: 25, right: 25, bottom: 25, left: 25 },
};

// ---------------------------------------------------------------------------
// Base reset + typography
// ---------------------------------------------------------------------------

const BASE_RESET = `
*, *::before, *::after {
  box-sizing: border-box;
}
html, body {
  margin: 0;
  padding: 0;
}
body {
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  color-adjust: exact;
}
`;

const BASE_TYPOGRAPHY = `
body {
  line-height: 1.6;
  color: #1a1a1a;
  background: #fff;
  word-wrap: break-word;
  overflow-wrap: break-word;
}
h1, h2, h3, h4, h5, h6 {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  line-height: 1.25;
  font-weight: 600;
  page-break-after: avoid;
}
h1 { font-size: 2em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.2em; }
h3 { font-size: 1.25em; }
h4 { font-size: 1.1em; }
h5 { font-size: 1em; }
h6 { font-size: 0.9em; color: #555; }
p {
  margin-top: 0;
  margin-bottom: 1em;
}
a {
  color: #0366d6;
  text-decoration: underline;
}
a[href]::after {
  content: " (" attr(href) ")";
  font-size: 0.8em;
  color: #666;
}
a[href^="#"]::after,
a[href^="javascript:"]::after {
  content: "";
}
`;

const BASE_LISTS = `
ul, ol {
  padding-left: 2em;
  margin-bottom: 1em;
}
li {
  margin-bottom: 0.25em;
}
li > ul,
li > ol {
  margin-top: 0.25em;
  margin-bottom: 0.25em;
}
`;

const BASE_CODE = `
code {
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.875em;
  background: #f5f5f5;
  padding: 0.1em 0.3em;
  border-radius: 3px;
  border: 1px solid #e0e0e0;
}
pre {
  background: #f5f5f5;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 1em;
  overflow-x: auto;
  margin-bottom: 1em;
  page-break-inside: avoid;
}
pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.85em;
  line-height: 1.5;
}
`;

const BASE_TABLES = `
table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1em;
  page-break-inside: avoid;
  font-size: 0.9em;
}
thead {
  background: #f0f0f0;
}
th, td {
  padding: 0.5em 0.75em;
  border: 1px solid #d0d0d0;
  text-align: left;
  vertical-align: top;
}
th {
  font-weight: 600;
}
tr:nth-child(even) td {
  background: #fafafa;
}
`;

const BASE_IMAGES = `
img {
  max-width: 100%;
  height: auto;
  display: block;
  margin: 1em auto;
  page-break-inside: avoid;
}
figure {
  margin: 1em 0;
  page-break-inside: avoid;
}
figcaption {
  font-size: 0.85em;
  color: #666;
  text-align: center;
  margin-top: 0.25em;
}
`;

const BASE_BLOCKQUOTE = `
blockquote {
  margin: 1em 0;
  padding: 0.5em 1em;
  border-left: 4px solid #d0d0d0;
  color: #555;
  background: #f9f9f9;
  page-break-inside: avoid;
}
blockquote p:last-child {
  margin-bottom: 0;
}
`;

const BASE_HR = `
hr {
  border: none;
  border-top: 1px solid #d0d0d0;
  margin: 2em 0;
}
`;

const BASE_MISC = `
mark {
  background: #fff3cd;
  padding: 0.1em 0.2em;
  border-radius: 2px;
}
kbd {
  display: inline-block;
  padding: 0.1em 0.4em;
  font-family: 'Courier New', Courier, monospace;
  font-size: 0.85em;
  background: #fafafa;
  border: 1px solid #d0d0d0;
  border-radius: 3px;
  box-shadow: 0 1px 0 rgba(0,0,0,0.2);
}
details > summary {
  cursor: pointer;
  font-weight: 500;
}
`;

const TASK_LIST = `
.task-list-item {
  list-style: none;
  margin-left: -1.5em;
}
.task-list-item input[type="checkbox"] {
  margin-right: 0.5em;
}
`;

const TOC_STYLES = `
.pdf-toc {
  margin-bottom: 2em;
  page-break-after: always;
}
.pdf-toc-title {
  font-size: 1.4em;
  font-weight: 700;
  margin-bottom: 1em;
  border-bottom: 2px solid #333;
  padding-bottom: 0.3em;
}
.pdf-toc-list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.pdf-toc-item {
  display: flex;
  align-items: baseline;
  margin-bottom: 0.3em;
  gap: 0.25em;
}
.pdf-toc-item-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 0 1 auto;
}
.pdf-toc-item-dots {
  flex: 1 1 auto;
  border-bottom: 1px dotted #aaa;
  min-width: 1em;
  margin: 0 0.25em;
  height: 0.9em;
}
.pdf-toc-anchor {
  color: #1a1a1a;
  text-decoration: none;
}
.pdf-toc-anchor:hover {
  text-decoration: underline;
}
.pdf-toc-level-1 { padding-left: 0; font-weight: 600; }
.pdf-toc-level-2 { padding-left: 1.5em; }
.pdf-toc-level-3 { padding-left: 3em; font-size: 0.9em; color: #444; }
.pdf-toc-level-4 { padding-left: 4.5em; font-size: 0.85em; color: #555; }
.pdf-toc-level-5 { padding-left: 6em; font-size: 0.8em; color: #666; }
.pdf-toc-level-6 { padding-left: 7.5em; font-size: 0.8em; color: #777; }
`;

const CALLOUT_STYLES = `
.callout {
  border-left: 4px solid #6366f1;
  background: #f5f5ff;
  padding: 0.75em 1em;
  border-radius: 0 4px 4px 0;
  margin: 1em 0;
  page-break-inside: avoid;
}
.callout-note    { border-color: #6366f1; background: #f5f5ff; }
.callout-tip     { border-color: #22c55e; background: #f0fdf4; }
.callout-warning { border-color: #f59e0b; background: #fffbeb; }
.callout-danger  { border-color: #ef4444; background: #fef2f2; }
.callout-info    { border-color: #3b82f6; background: #eff6ff; }
.callout-title   { font-weight: 700; margin-bottom: 0.3em; }
`;

const MATH_STYLES = `
.math-block {
  text-align: center;
  margin: 1em 0;
  overflow-x: auto;
  page-break-inside: avoid;
}
.math-inline {
  display: inline;
}
.math-image {
  max-width: 100%;
  height: auto;
}
`;

const PRINT_MEDIA = `
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .no-print {
    display: none !important;
  }
  .page-break-before {
    page-break-before: always;
  }
  .page-break-after {
    page-break-after: always;
  }
  .avoid-break {
    page-break-inside: avoid;
  }
  a[href]::after {
    content: " (" attr(href) ")";
  }
  a[href^="#"]::after {
    content: "";
  }
}
`;

// ---------------------------------------------------------------------------
// Style presets
// ---------------------------------------------------------------------------

const PRESET_DEFAULT = `
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 14px;
}
h1 { color: #1a1a1a; }
h2 { color: #2a2a2a; }
h3 { color: #3a3a3a; }
`;

const PRESET_ACADEMIC = `
body {
  font-family: 'Georgia', 'Times New Roman', Times, serif;
  font-size: 12pt;
  line-height: 1.8;
  color: #111;
}
h1 { font-size: 18pt; text-align: center; border-bottom: none; }
h2 { font-size: 14pt; border-bottom: none; }
h3 { font-size: 12pt; font-style: italic; }
p { text-align: justify; text-indent: 1.5em; }
p + p { margin-top: 0; }
blockquote {
  font-style: italic;
  border-left: none;
  padding-left: 2em;
  background: none;
}
`;

const PRESET_MINIMAL = `
body {
  font-family: 'Courier New', Courier, monospace;
  font-size: 13px;
  color: #222;
}
h1, h2, h3, h4, h5, h6 {
  font-family: 'Courier New', Courier, monospace;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
h1 { font-size: 1.4em; }
h2 { font-size: 1.2em; border-bottom: 1px solid #aaa; }
h3 { font-size: 1.05em; }
a { color: #333; }
code { background: none; border: none; font-size: 1em; }
pre { background: none; border: none; padding: 0; }
pre code { font-size: 0.9em; }
`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Generate the @page CSS rule for the given page size and margins. */
export function generatePageRule(pageSize: PageSize, margins: PageMargins): string {
  const dims = PAGE_DIMENSIONS[pageSize];
  return `
@page {
  size: ${dims.width}mm ${dims.height}mm;
  margin: ${margins.top}mm ${margins.right}mm ${margins.bottom}mm ${margins.left}mm;
}
`;
}

/** Assemble the full print stylesheet for the given options. */
export function buildPrintStylesheet(options: {
  pageSize: PageSize;
  margins: PageMargins;
  fontSize: number;
  fontFamily: string;
  preset: StylePreset;
  customCSS?: string;
}): string {
  const { pageSize, margins, fontSize, fontFamily, preset, customCSS } = options;

  const presetCSS =
    preset === 'academic'
      ? PRESET_ACADEMIC
      : preset === 'minimal'
        ? PRESET_MINIMAL
        : PRESET_DEFAULT;

  const bodyOverride = `
body {
  font-size: ${fontSize}px;
  ${fontFamily ? `font-family: ${fontFamily};` : ''}
}
`;

  return [
    BASE_RESET,
    generatePageRule(pageSize, margins),
    BASE_TYPOGRAPHY,
    BASE_LISTS,
    BASE_CODE,
    BASE_TABLES,
    BASE_IMAGES,
    BASE_BLOCKQUOTE,
    BASE_HR,
    BASE_MISC,
    TASK_LIST,
    TOC_STYLES,
    CALLOUT_STYLES,
    MATH_STYLES,
    PRINT_MEDIA,
    presetCSS,
    bodyOverride,
    customCSS ?? '',
  ].join('\n');
}

/** Return the list of all available style presets. */
export function getStylePresets(): Array<{ id: StylePreset; label: string; description: string }> {
  return [
    {
      id: 'default',
      label: 'Default',
      description: 'Clean, readable layout with sans-serif fonts.',
    },
    {
      id: 'academic',
      label: 'Academic',
      description: 'Formal serif layout with justified text, suitable for papers.',
    },
    {
      id: 'minimal',
      label: 'Minimal',
      description: 'Monospace, high-contrast, code-focused layout.',
    },
  ];
}
