/**
 * pdf-renderer — Convert markdown/HTML note content to a print-ready HTML
 * document that the browser can render and print as PDF.
 *
 * Strategy:
 *   1. Accept markdown content (or pre-rendered HTML)
 *   2. Inject heading anchors so the TOC links work
 *   3. Add page-break hints at top-level headings
 *   4. Wrap everything in a full HTML document with print CSS
 *   5. Return a self-contained HTML string the host can open in a new window
 *      and trigger `window.print()` on
 *
 * Math rendering:
 *   The plugin cannot run KaTeX/MathJax at export time without importing
 *   heavy libraries, so math blocks are wrapped in a data-math span and
 *   marked for optional post-processing.  When inline images are available
 *   (passed via `mathImages`) they are substituted in.
 *
 * Image inlining:
 *   Images with a relative or absolute URL are left as-is (the browser will
 *   fetch them when printing).  When `base64Images` is provided the src
 *   attributes are replaced with data: URIs for offline-safe exports.
 */

import {
  buildPrintStylesheet,
  DEFAULT_MARGINS,
  type PageSize,
  type PageMargins,
  type StylePreset,
} from './export-styles';
import { fromMarkdown, fromHtml, renderTocHtml, flattenToc, type TocEntry } from './toc-generator';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Options controlling the PDF rendering pipeline. */
export interface PdfRenderOptions {
  /** The raw markdown content of the note. */
  markdown?: string;
  /** Pre-rendered HTML (if available — skips the markdown→HTML step). */
  html?: string;
  /** Note title shown at the top of the document. */
  title?: string;
  /** Page size for the @page rule. */
  pageSize?: PageSize;
  /** Page margins in millimetres. */
  margins?: PageMargins;
  /** Base font size in pixels. */
  fontSize?: number;
  /** CSS font-family override. Empty string uses preset default. */
  fontFamily?: string;
  /** Named style preset. */
  preset?: StylePreset;
  /** Additional user CSS appended last. */
  customCSS?: string;
  /** Whether to generate and prepend a table of contents. */
  includeToc?: boolean;
  /** Maximum heading depth included in the TOC. */
  tocMaxDepth?: number;
  /** TOC section title. */
  tocTitle?: string;
  /** Whether to add page-break hints before h2 headings. */
  pageBreakBeforeH2?: boolean;
  /** Map from image src → base64 data URI for offline embedding. */
  base64Images?: Record<string, string>;
  /** Map from math content hash → base64 PNG data URI. */
  mathImages?: Record<string, string>;
}

/** The result of the rendering pipeline. */
export interface PdfRenderResult {
  /** Full self-contained HTML document string. */
  html: string;
  /** The extracted TOC entries (empty when includeToc is false). */
  toc: TocEntry[];
  /** True if any math blocks were found in the content. */
  hasMath: boolean;
}

// ---------------------------------------------------------------------------
// HTML helpers
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text: string): string {
  return text.replace(/"/g, '&quot;').replace(/\n/g, '&#10;');
}

function unescapeAttr(text: string): string {
  return text.replace(/&quot;/g, '"').replace(/&#10;/g, '\n');
}

// ---------------------------------------------------------------------------
// Markdown → HTML converter (lightweight built-in)
// ---------------------------------------------------------------------------

/**
 * A minimal markdown-to-HTML converter that handles common note elements.
 *
 * This is intentionally simple — if the host already provides pre-rendered
 * HTML via `options.html` this step is bypassed entirely.
 */
export function convertMarkdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  const html: string[] = [];
  let i = 0;

  // State flags
  let inFence = false;
  let fenceChar = '';
  let fenceLang = '';
  let fenceLines: string[] = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let inBlockquote = false;

  function closeLists() {
    if (inUnorderedList) {
      html.push('</ul>');
      inUnorderedList = false;
    }
    if (inOrderedList) {
      html.push('</ol>');
      inOrderedList = false;
    }
  }

  function closeBlockquote() {
    if (inBlockquote) {
      html.push('</blockquote>');
      inBlockquote = false;
    }
  }

  function inlineFormat(text: string): string {
    return (
      text
        // Images before links
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img alt="$1" src="$2">')
        // Links
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Bold+italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/___(.+?)___/g, '<strong><em>$1</em></strong>')
        // Bold
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        // Italic
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')
        // Strikethrough
        .replace(/~~(.+?)~~/g, '<del>$1</del>')
        // Mark / highlight
        .replace(/==(.+?)==/g, '<mark>$1</mark>')
    );
  }

  while (i < lines.length) {
    const line = lines[i];

    // ---- Fenced code blocks ----
    const fenceMatch = /^(`{3,}|~{3,})(\w*)/.exec(line);
    if (!inFence && fenceMatch) {
      closeLists();
      closeBlockquote();
      inFence = true;
      fenceChar = fenceMatch[1][0];
      fenceLang = fenceMatch[2] || '';
      fenceLines = [];
      i++;
      continue;
    }

    if (inFence) {
      if (line.startsWith(fenceChar.repeat(3))) {
        const langAttr = fenceLang ? ` class="language-${escapeHtml(fenceLang)}"` : '';
        html.push(`<pre><code${langAttr}>${fenceLines.map(escapeHtml).join('\n')}</code></pre>`);
        inFence = false;
        fenceChar = '';
        fenceLang = '';
        fenceLines = [];
      } else {
        fenceLines.push(line);
      }
      i++;
      continue;
    }

    // ---- Math blocks ($$...$$) ----
    if (line.trim() === '$$') {
      closeLists();
      closeBlockquote();
      const mathLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== '$$') {
        mathLines.push(lines[i]);
        i++;
      }
      i++; // consume closing $$
      const mathContent = mathLines.join('\n');
      html.push(
        `<div class="math-block" data-math="${escapeAttr(mathContent)}">${escapeHtml(mathContent)}</div>`,
      );
      continue;
    }

    // ---- Horizontal rule ----
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      closeLists();
      closeBlockquote();
      html.push('<hr>');
      i++;
      continue;
    }

    // ---- ATX Headings ----
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      closeLists();
      closeBlockquote();
      const level = headingMatch[1].length;
      const text = headingMatch[2].trim();
      const rendered = inlineFormat(text);
      html.push(`<h${level}>${rendered}</h${level}>`);
      i++;
      continue;
    }

    // ---- Blockquote ----
    if (line.startsWith('> ') || line === '>') {
      closeLists();
      if (!inBlockquote) {
        html.push('<blockquote>');
        inBlockquote = true;
      }
      const content = line.startsWith('> ') ? line.slice(2) : '';
      if (content) {
        html.push(`<p>${inlineFormat(content)}</p>`);
      }
      i++;
      continue;
    } else {
      closeBlockquote();
    }

    // ---- Unordered list ----
    const ulMatch = /^\s*([-*+])\s+(.*)$/.exec(line);
    if (ulMatch) {
      closeBlockquote();
      if (!inUnorderedList) {
        if (inOrderedList) {
          html.push('</ol>');
          inOrderedList = false;
        }
        html.push('<ul>');
        inUnorderedList = true;
      }
      // Task list item
      const taskMatch = /^\[(x| )\]\s(.+)$/.exec(ulMatch[2]);
      if (taskMatch) {
        const checked = taskMatch[1] === 'x' ? ' checked' : '';
        html.push(
          `<li class="task-list-item"><input type="checkbox"${checked} disabled> ${inlineFormat(taskMatch[2])}</li>`,
        );
      } else {
        html.push(`<li>${inlineFormat(ulMatch[2])}</li>`);
      }
      i++;
      continue;
    }

    // ---- Ordered list ----
    const olMatch = /^\d+\.\s+(.+)$/.exec(line);
    if (olMatch) {
      closeBlockquote();
      if (!inOrderedList) {
        if (inUnorderedList) {
          html.push('</ul>');
          inUnorderedList = false;
        }
        html.push('<ol>');
        inOrderedList = true;
      }
      html.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      i++;
      continue;
    }

    // ---- Blank line — closes open structures ----
    if (line.trim() === '') {
      closeLists();
      closeBlockquote();
      i++;
      continue;
    }

    // ---- Default: paragraph text ----
    closeLists();
    closeBlockquote();

    // Accumulate paragraph lines until blank or block-level element
    const paraLines: string[] = [line];
    while (
      i + 1 < lines.length &&
      lines[i + 1].trim() !== '' &&
      !/^(#{1,6}\s|```|~~~|> |-{3,}|\*{3,}|_{3,}|\s*[-*+]\s|\d+\.\s|\$\$)/.test(lines[i + 1])
    ) {
      i++;
      paraLines.push(lines[i]);
    }

    html.push(`<p>${inlineFormat(paraLines.join(' '))}</p>`);
    i++;
  }

  // Close any still-open structures
  closeLists();
  closeBlockquote();
  if (inFence && fenceLines.length > 0) {
    html.push(`<pre><code>${fenceLines.map(escapeHtml).join('\n')}</code></pre>`);
  }

  return html.join('\n');
}

// ---------------------------------------------------------------------------
// Anchor injection
// ---------------------------------------------------------------------------

/**
 * Walk the HTML and inject `id` attributes into heading elements so TOC
 * anchor links resolve correctly.
 */
export function injectHeadingAnchors(html: string, tocEntries: TocEntry[]): string {
  const flat = flattenToc(tocEntries);
  const encountered = new Map<string, number>();
  let result = html;

  result = result.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/gi,
    (fullMatch, level, attrs, inner) => {
      // Skip if already has an id attribute
      if (/\bid=/.test(attrs)) return fullMatch;

      const text = inner.replace(/<[^>]+>/g, '').trim();
      const baseSlug = slugifyForAnchor(text);

      const count = encountered.get(baseSlug) ?? 0;
      const finalId = count === 0 ? baseSlug : `${baseSlug}-${count}`;
      encountered.set(baseSlug, count + 1);

      // Use the TOC entry id if one matches (they've been de-duplicated)
      const tocEntry = flat.find(
        (e) => e.level === parseInt(level, 10) && (e.id === finalId || e.id === baseSlug),
      );
      const id = tocEntry ? tocEntry.id : finalId;

      return `<h${level} id="${escapeAttr(id)}"${attrs}>${inner}</h${level}>`;
    },
  );

  return result;
}

function slugifyForAnchor(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ---------------------------------------------------------------------------
// Page break injection
// ---------------------------------------------------------------------------

/** Inject a page-break hint before every h2 element. */
export function injectPageBreaks(html: string): string {
  return html.replace(/<h2(\s|>)/g, '<h2 class="page-break-before"$1');
}

// ---------------------------------------------------------------------------
// Math image substitution
// ---------------------------------------------------------------------------

/** Replace data-math placeholders with img tags when images are available. */
export function substituteMathImages(html: string, mathImages: Record<string, string>): string {
  if (Object.keys(mathImages).length === 0) return html;

  return html.replace(
    /<div class="math-block" data-math="([^"]*)">[^<]*<\/div>/g,
    (_match, escapedContent) => {
      const content = unescapeAttr(escapedContent);
      const key = simpleHash(content);
      const src = mathImages[key] ?? mathImages[content];
      if (src) {
        return `<div class="math-block"><img class="math-image" src="${src}" alt="Math: ${escapeAttr(content)}"></div>`;
      }
      return _match;
    },
  );
}

// ---------------------------------------------------------------------------
// Image base64 substitution
// ---------------------------------------------------------------------------

/** Replace image src attributes with base64 data URIs when available. */
export function substituteBase64Images(html: string, base64Images: Record<string, string>): string {
  if (Object.keys(base64Images).length === 0) return html;

  return html.replace(/src="([^"]+)"/g, (_match, src) => {
    const b64 = base64Images[src as string];
    return b64 ? `src="${b64}"` : _match;
  });
}

// ---------------------------------------------------------------------------
// Math detection
// ---------------------------------------------------------------------------

/** Return true if the HTML contains any math blocks or inline math. */
export function detectMath(html: string): boolean {
  return /data-math=|class="math-/.test(html);
}

// ---------------------------------------------------------------------------
// Full document assembly
// ---------------------------------------------------------------------------

/**
 * Wrap an HTML body fragment in a full HTML5 document with print CSS.
 */
export function assembleHtmlDocument(options: {
  title: string;
  bodyHtml: string;
  css: string;
}): string {
  const { title, bodyHtml, css } = options;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <style>
${css}
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render a note to a print-ready HTML document.
 *
 * @param options  Full rendering options (content, layout, styles, etc.)
 * @returns        PdfRenderResult with the HTML string and metadata
 */
export function renderToPdf(options: PdfRenderOptions): PdfRenderResult {
  const {
    markdown,
    html: preRenderedHtml,
    title = 'Untitled Note',
    pageSize = 'A4',
    margins,
    fontSize = 14,
    fontFamily = '',
    preset = 'default',
    customCSS,
    includeToc = false,
    tocMaxDepth = 3,
    tocTitle = 'Table of Contents',
    pageBreakBeforeH2 = true,
    base64Images = {},
    mathImages = {},
  } = options;

  // 1. Get raw HTML from markdown or pre-rendered
  let bodyHtml: string;
  if (preRenderedHtml) {
    bodyHtml = preRenderedHtml;
  } else if (markdown) {
    bodyHtml = convertMarkdownToHtml(markdown);
  } else {
    bodyHtml = '';
  }

  // 2. Extract TOC entries
  const tocEntries = includeToc ? (markdown ? fromMarkdown(markdown) : fromHtml(bodyHtml)) : [];

  // 3. Inject heading anchors (needed for TOC links)
  if (includeToc && tocEntries.length > 0) {
    bodyHtml = injectHeadingAnchors(bodyHtml, tocEntries);
  }

  // 4. Page breaks
  if (pageBreakBeforeH2) {
    bodyHtml = injectPageBreaks(bodyHtml);
  }

  // 5. Substitute math images if provided
  bodyHtml = substituteMathImages(bodyHtml, mathImages);

  // 6. Substitute base64 images if provided
  bodyHtml = substituteBase64Images(bodyHtml, base64Images);

  // 7. Detect math presence
  const hasMath = detectMath(bodyHtml);

  // 8. Prepend TOC if requested
  let finalBody = bodyHtml;
  if (includeToc && tocEntries.length > 0) {
    const tocHtml = renderTocHtml(tocEntries, tocTitle, tocMaxDepth);
    finalBody = tocHtml + '\n' + bodyHtml;
  }

  // Add note title at the top
  if (title) {
    finalBody = `<h1 class="note-title">${escapeHtml(title)}</h1>\n` + finalBody;
  }

  // 9. Build stylesheet
  const resolvedMargins = margins ?? DEFAULT_MARGINS[pageSize];
  const css = buildPrintStylesheet({
    pageSize,
    margins: resolvedMargins,
    fontSize,
    fontFamily,
    preset,
    customCSS,
  });

  // 10. Assemble full document
  const html = assembleHtmlDocument({ title, bodyHtml: finalBody, css });

  return { html, toc: tocEntries, hasMath };
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

/** Simple non-cryptographic hash for math content keying. */
export function simpleHash(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}
