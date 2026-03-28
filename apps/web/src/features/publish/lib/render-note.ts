/**
 * render-note.ts
 *
 * Server-side markdown rendering pipeline for published notes.
 *
 * Converts raw markdown content into structured HTML with:
 *   - Heading anchors (id attributes derived from heading text)
 *   - Table of contents extraction
 *   - Code block syntax highlighting (via CSS classes)
 *   - Responsive images with lazy loading
 *   - Wiki-link resolution for inter-note links
 *   - Frontmatter stripping (frontmatter is handled separately)
 *
 * This module runs exclusively on the server and must NOT be imported
 * from Client Components.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry in the extracted table of contents. */
export interface TocEntry {
  /** The heading level (1-6). */
  level: number;
  /** The plain-text heading content (no HTML). */
  text: string;
  /** The URL-safe slug used as the heading's id attribute. */
  slug: string;
}

/** The result of rendering a markdown note. */
export interface RenderedNote {
  /** The full HTML string ready for dangerouslySetInnerHTML. */
  html: string;
  /** Extracted table of contents entries in document order. */
  toc: TocEntry[];
  /** Estimated reading time in minutes. */
  readingTimeMinutes: number;
  /** Plain-text excerpt (first ~160 characters of body content). */
  excerpt: string;
}

// ---------------------------------------------------------------------------
// Slug generation (heading anchors)
// ---------------------------------------------------------------------------

/**
 * Convert a heading text string into a URL-safe slug.
 *
 * Follows the same algorithm used by GitHub / GitLab for heading anchors:
 *   1. Trim whitespace
 *   2. Lowercase
 *   3. Replace spaces / non-alphanumeric chars with hyphens
 *   4. Collapse consecutive hyphens
 *   5. Strip leading / trailing hyphens
 */
function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Ensure heading slugs are unique within a document by appending a numeric
 * suffix when a duplicate is encountered.
 */
function makeUniqueSlug(slug: string, existing: Set<string>): string {
  let candidate = slug;
  let counter = 1;
  while (existing.has(candidate)) {
    candidate = `${slug}-${counter}`;
    counter++;
  }
  existing.add(candidate);
  return candidate;
}

// ---------------------------------------------------------------------------
// HTML escaping
// ---------------------------------------------------------------------------

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] ?? ch);
}

// ---------------------------------------------------------------------------
// Frontmatter stripping
// ---------------------------------------------------------------------------

/**
 * Strip YAML frontmatter from markdown content.
 * Frontmatter is delimited by `---` at the start of the file.
 */
function stripFrontmatter(markdown: string): string {
  const trimmed = markdown.trimStart();
  if (!trimmed.startsWith('---')) return markdown;

  const endIndex = trimmed.indexOf('---', 3);
  if (endIndex === -1) return markdown;

  return trimmed.slice(endIndex + 3).trimStart();
}

// ---------------------------------------------------------------------------
// Inline markdown processing
// ---------------------------------------------------------------------------

/**
 * Process inline markdown elements: bold, italic, inline code, links, images.
 */
function processInline(text: string, publicSlugBase: string): string {
  let result = text;

  // Inline code (must come before other processing to protect code content)
  result = result.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images with responsive attributes: ![alt](src "title")
  result = result.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
    (_match, alt: string, src: string, title: string | undefined) => {
      const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}"${titleAttr} loading="lazy" decoding="async" class="published-note-img" />`;
    },
  );

  // Wiki links: [[Note Name]] or [[Note Name|Display Text]]
  result = result.replace(
    /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
    (_match, target: string, display?: string) => {
      const label = display ?? target;
      const href = `${publicSlugBase}${encodeURIComponent(target.trim())}`;
      return `<a href="${escapeHtml(href)}" class="wiki-link">${escapeHtml(label.trim())}</a>`;
    },
  );

  // Standard markdown links: [text](url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" rel="noopener noreferrer">$1</a>',
  );

  // Bold: **text** or __text__
  result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  result = result.replace(/__(.+?)__/g, '<strong>$1</strong>');

  // Italic: *text* or _text_ (but not inside words for underscores)
  result = result.replace(/(?<!\w)\*(.+?)\*(?!\w)/g, '<em>$1</em>');
  result = result.replace(/(?<!\w)_(.+?)_(?!\w)/g, '<em>$1</em>');

  // Strikethrough: ~~text~~
  result = result.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // Highlight: ==text==
  result = result.replace(/==(.+?)==/g, '<mark>$1</mark>');

  return result;
}

// ---------------------------------------------------------------------------
// Block-level rendering
// ---------------------------------------------------------------------------

interface RenderState {
  toc: TocEntry[];
  slugs: Set<string>;
  publicSlugBase: string;
  wordCount: number;
}

/**
 * Detect the language identifier from a fenced code block opening line.
 */
function extractCodeLang(line: string): string | null {
  const match = line.match(/^```(\w+)/);
  return match?.[1] ?? null;
}

/**
 * Render a fenced code block to HTML with syntax highlighting classes.
 */
function renderCodeBlock(lines: string[], lang: string | null): string {
  const content = lines.map((l) => escapeHtml(l)).join('\n');
  const langClass = lang ? ` class="language-${escapeHtml(lang)}"` : '';
  const dataLang = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
  return `<div class="code-block-wrapper"${dataLang}>${lang ? `<div class="code-block-lang">${escapeHtml(lang)}</div>` : ''}<pre><code${langClass}>${content}</code></pre></div>`;
}

/**
 * Render a markdown table from its raw lines.
 */
function renderTable(lines: string[], state: RenderState): string {
  const parseRow = (line: string): string[] =>
    line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());

  if (lines.length < 2)
    return lines
      .map((l) => `<p>${processInline(escapeHtml(l), state.publicSlugBase)}</p>`)
      .join('\n');

  const headerCells = parseRow(lines[0]);
  const separatorCells = parseRow(lines[1]);

  // Determine alignment from separator row
  const alignments = separatorCells.map((sep) => {
    const left = sep.startsWith(':');
    const right = sep.endsWith(':');
    if (left && right) return 'center';
    if (right) return 'right';
    return 'left';
  });

  const alignAttr = (i: number) => {
    const align = alignments[i];
    return align && align !== 'left' ? ` style="text-align:${align}"` : '';
  };

  let html = '<div class="table-wrapper"><table>\n<thead>\n<tr>\n';
  for (let i = 0; i < headerCells.length; i++) {
    html += `<th${alignAttr(i)}>${processInline(escapeHtml(headerCells[i]), state.publicSlugBase)}</th>\n`;
  }
  html += '</tr>\n</thead>\n<tbody>\n';

  for (let r = 2; r < lines.length; r++) {
    const cells = parseRow(lines[r]);
    html += '<tr>\n';
    for (let i = 0; i < headerCells.length; i++) {
      const cellContent = cells[i] ?? '';
      html += `<td${alignAttr(i)}>${processInline(escapeHtml(cellContent), state.publicSlugBase)}</td>\n`;
    }
    html += '</tr>\n';
  }

  html += '</tbody>\n</table></div>';
  return html;
}

/**
 * Check if a line looks like a table row.
 */
function isTableRow(line: string): boolean {
  return line.includes('|') && line.trim().startsWith('|');
}

/**
 * Check if a line is a table separator row (e.g. |---|---|).
 */
function isTableSeparator(line: string): boolean {
  return /^\|[\s:]*-+[\s:]*(\|[\s:]*-+[\s:]*)*\|?$/.test(line.trim());
}

/**
 * Render the full markdown body into HTML blocks.
 */
function renderBlocks(markdown: string, state: RenderState): string {
  const lines = markdown.split('\n');
  const htmlParts: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Empty line
    if (trimmed === '') {
      i++;
      continue;
    }

    // Fenced code block
    if (trimmed.startsWith('```')) {
      const lang = extractCodeLang(trimmed);
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      htmlParts.push(renderCodeBlock(codeLines, lang));
      continue;
    }

    // Heading (ATX style)
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+?)(?:\s+#{1,6})?\s*$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const rawText = headingMatch[2];
      const plainText = rawText.replace(/[*_~`=\[\]]/g, '');
      const baseSlug = slugify(plainText);
      const slug = makeUniqueSlug(baseSlug || `heading-${state.toc.length}`, state.slugs);

      state.toc.push({ level, text: plainText, slug });
      state.wordCount += plainText.split(/\s+/).filter(Boolean).length;

      const inlineHtml = processInline(escapeHtml(rawText), state.publicSlugBase);
      htmlParts.push(
        `<h${level} id="${slug}"><a href="#${slug}" class="heading-anchor" aria-label="Link to ${escapeHtml(plainText)}">#</a>${inlineHtml}</h${level}>`,
      );
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      htmlParts.push('<hr />');
      i++;
      continue;
    }

    // Blockquote
    if (trimmed.startsWith('>')) {
      const bqLines: string[] = [];
      while (
        i < lines.length &&
        (lines[i].trim().startsWith('>') ||
          (lines[i].trim() !== '' && bqLines.length > 0 && !lines[i].trim().startsWith('#')))
      ) {
        const bqLine = lines[i].trim().replace(/^>\s?/, '');
        bqLines.push(bqLine);
        i++;
        if (lines[i]?.trim() === '' && lines[i + 1]?.trim().startsWith('>')) {
          bqLines.push('');
          i++;
        } else if (lines[i]?.trim() === '') {
          break;
        }
      }

      // Detect Obsidian-style callouts: > [!type] Title
      const calloutMatch = bqLines[0]?.match(/^\[!(\w+)\]\s*(.*)/);
      if (calloutMatch) {
        const calloutType = calloutMatch[1].toLowerCase();
        const calloutTitle =
          calloutMatch[2] || calloutType.charAt(0).toUpperCase() + calloutType.slice(1);
        const calloutBody = bqLines.slice(1).join('\n');
        const bodyHtml = calloutBody ? renderBlocks(calloutBody, state) : '';
        htmlParts.push(
          `<div class="callout callout-${escapeHtml(calloutType)}" role="note"><div class="callout-title">${escapeHtml(calloutTitle)}</div><div class="callout-content">${bodyHtml}</div></div>`,
        );
      } else {
        const bqContent = bqLines.join('\n');
        const bqHtml = renderBlocks(bqContent, state);
        htmlParts.push(`<blockquote>${bqHtml}</blockquote>`);
      }
      continue;
    }

    // Table
    if (isTableRow(trimmed) && i + 1 < lines.length && isTableSeparator(lines[i + 1].trim())) {
      const tableLines: string[] = [];
      while (i < lines.length && isTableRow(lines[i].trim())) {
        tableLines.push(lines[i].trim());
        i++;
      }
      htmlParts.push(renderTable(tableLines, state));
      continue;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^[-*+]\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*+]\s+/, '');
        state.wordCount += itemText.split(/\s+/).filter(Boolean).length;

        // Check for task list
        const taskMatch = itemText.match(/^\[([ xX])\]\s*(.*)/);
        if (taskMatch) {
          const checked = taskMatch[1] !== ' ';
          const content = taskMatch[2];
          listItems.push(
            `<li class="task-list-item"><input type="checkbox" disabled${checked ? ' checked' : ''} />${processInline(escapeHtml(content), state.publicSlugBase)}</li>`,
          );
        } else {
          listItems.push(`<li>${processInline(escapeHtml(itemText), state.publicSlugBase)}</li>`);
        }
        i++;
      }
      const hasTaskItems = listItems.some((li) => li.includes('task-list-item'));
      const listClass = hasTaskItems ? ' class="task-list"' : '';
      htmlParts.push(`<ul${listClass}>\n${listItems.join('\n')}\n</ul>`);
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const listItems: string[] = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        state.wordCount += itemText.split(/\s+/).filter(Boolean).length;
        listItems.push(`<li>${processInline(escapeHtml(itemText), state.publicSlugBase)}</li>`);
        i++;
      }
      htmlParts.push(`<ol>\n${listItems.join('\n')}\n</ol>`);
      continue;
    }

    // Paragraph (default block)
    {
      const paraLines: string[] = [];
      while (
        i < lines.length &&
        lines[i].trim() !== '' &&
        !lines[i].trim().startsWith('#') &&
        !lines[i].trim().startsWith('```') &&
        !lines[i].trim().startsWith('>') &&
        !/^[-*+]\s/.test(lines[i].trim()) &&
        !/^\d+\.\s/.test(lines[i].trim()) &&
        !/^(-{3,}|\*{3,}|_{3,})$/.test(lines[i].trim())
      ) {
        paraLines.push(lines[i].trim());
        i++;
      }
      if (paraLines.length > 0) {
        const paraText = paraLines.join(' ');
        state.wordCount += paraText.split(/\s+/).filter(Boolean).length;
        htmlParts.push(`<p>${processInline(escapeHtml(paraText), state.publicSlugBase)}</p>`);
      }
    }
  }

  return htmlParts.join('\n');
}

// ---------------------------------------------------------------------------
// Reading time estimation
// ---------------------------------------------------------------------------

/** Average reading speed in words per minute. */
const WORDS_PER_MINUTE = 230;

function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

// ---------------------------------------------------------------------------
// Excerpt extraction
// ---------------------------------------------------------------------------

/**
 * Extract a plain-text excerpt from the first ~160 characters of rendered
 * content. Strips all HTML tags and collapses whitespace.
 */
function extractExcerpt(html: string, maxLength = 160): string {
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;
  // Break at word boundary
  const truncated = plainText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface RenderNoteOptions {
  /**
   * Base URL path for resolving wiki links.
   * Example: `/public/my-vault/` will produce links like `/public/my-vault/Note%20Name`
   */
  publicSlugBase?: string;
}

/**
 * Render raw markdown content into structured HTML suitable for
 * server-side rendering of published notes.
 *
 * This is a synchronous, zero-dependency function designed for use
 * in Next.js Server Components and `generateMetadata`.
 */
export function renderNote(markdown: string, options: RenderNoteOptions = {}): RenderedNote {
  const { publicSlugBase = '/public/' } = options;

  // Strip frontmatter
  const body = stripFrontmatter(markdown);

  const state: RenderState = {
    toc: [],
    slugs: new Set<string>(),
    publicSlugBase: publicSlugBase.endsWith('/') ? publicSlugBase : `${publicSlugBase}/`,
    wordCount: 0,
  };

  const html = renderBlocks(body, state);
  const readingTimeMinutes = estimateReadingTime(state.wordCount);
  const excerpt = extractExcerpt(html);

  return {
    html,
    toc: state.toc,
    readingTimeMinutes,
    excerpt,
  };
}
