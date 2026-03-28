/**
 * toc-generator — Table of contents extraction from markdown or HTML content.
 *
 * Supports two modes:
 *   - `fromMarkdown(content)` — parse headings from a raw markdown string
 *   - `fromHtml(html)`        — parse headings from an HTML string
 *
 * Both return a `TocEntry[]` which can be rendered into HTML or used for
 * in-document navigation anchors.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry in the table of contents. */
export interface TocEntry {
  /** Heading level (1–6). */
  level: number;
  /** The plain text of the heading (markdown formatting stripped). */
  text: string;
  /** Slugified anchor ID, e.g. "my-section-title". */
  id: string;
  /** Child entries for nested headings (depth-first). */
  children: TocEntry[];
}

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

/**
 * Convert heading text to a URL-safe anchor slug.
 *
 * Rules:
 *   - Lower-case
 *   - Replace spaces with hyphens
 *   - Remove characters that are not alphanumeric, hyphens, or underscores
 *   - Collapse consecutive hyphens
 *   - Trim leading/trailing hyphens
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Ensure each entry in the list has a unique slug.  When duplicates exist
 * a numeric suffix is appended: "section", "section-1", "section-2", …
 */
function deduplicateSlugs(entries: TocEntry[]): void {
  const seen = new Map<string, number>();

  function dedup(list: TocEntry[]): void {
    for (const entry of list) {
      const base = entry.id;
      const count = seen.get(base) ?? 0;
      if (count > 0) {
        entry.id = `${base}-${count}`;
      }
      seen.set(base, count + 1);
      dedup(entry.children);
    }
  }

  dedup(entries);
}

// ---------------------------------------------------------------------------
// Markdown strip helpers
// ---------------------------------------------------------------------------

/** Remove markdown formatting characters, leaving plain text. */
function stripMarkdownFormatting(text: string): string {
  return (
    text
      // Code spans — keep content
      .replace(/`([^`]+)`/g, '$1')
      // Bold+italic
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/___(.+?)___/g, '$1')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/__(.+?)__/g, '$1')
      // Italic
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/_(.+?)_/g, '$1')
      // Strikethrough
      .replace(/~~(.+?)~~/g, '$1')
      // Links — keep label text
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      // Images — remove entirely
      .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
      // Trim
      .trim()
  );
}

// ---------------------------------------------------------------------------
// Flat list → nested tree
// ---------------------------------------------------------------------------

/** Convert a flat ordered list of entries into a nested tree. */
function buildTree(flat: Omit<TocEntry, 'children'>[]): TocEntry[] {
  const root: TocEntry[] = [];
  // Stack contains the running "parent" at each level
  const stack: TocEntry[] = [];

  for (const item of flat) {
    const entry: TocEntry = { ...item, children: [] };

    if (stack.length === 0) {
      root.push(entry);
      stack.push(entry);
      continue;
    }

    // Pop stack until we find a parent with a lower level number
    while (stack.length > 0 && stack[stack.length - 1].level >= entry.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      root.push(entry);
    } else {
      stack[stack.length - 1].children.push(entry);
    }

    stack.push(entry);
  }

  return root;
}

// ---------------------------------------------------------------------------
// Parse from Markdown
// ---------------------------------------------------------------------------

/**
 * Heading line pattern — matches ATX-style headings.
 * Group 1: hashes (level indicator)
 * Group 2: heading text
 */
const MARKDOWN_HEADING_RE = /^(#{1,6})\s+(.+)$/;

/**
 * Extract a flat ordered list of headings from a markdown string.
 * Headings inside fenced code blocks are skipped.
 */
function extractMarkdownHeadings(content: string): Omit<TocEntry, 'children'>[] {
  const lines = content.split('\n');
  const entries: Omit<TocEntry, 'children'>[] = [];

  let inFenceBlock = false;
  let fenceChar = '';

  for (const line of lines) {
    // Track fenced code blocks (``` or ~~~)
    const fenceMatch = /^(`{3,}|~{3,})/.exec(line);
    if (fenceMatch) {
      const char = fenceMatch[1][0];
      if (!inFenceBlock) {
        inFenceBlock = true;
        fenceChar = char;
      } else if (fenceMatch[1][0] === fenceChar) {
        inFenceBlock = false;
        fenceChar = '';
      }
      continue;
    }

    if (inFenceBlock) continue;

    const match = MARKDOWN_HEADING_RE.exec(line);
    if (match) {
      const level = match[1].length;
      const rawText = match[2].trim();
      const text = stripMarkdownFormatting(rawText);
      const id = slugify(text);
      entries.push({ level, text, id });
    }
  }

  return entries;
}

/**
 * Parse a markdown string and return a nested table of contents.
 *
 * @param content  Raw markdown content
 * @returns        Nested TocEntry array (may be empty if no headings found)
 */
export function fromMarkdown(content: string): TocEntry[] {
  const flat = extractMarkdownHeadings(content);
  const tree = buildTree(flat);
  deduplicateSlugs(tree);
  return tree;
}

// ---------------------------------------------------------------------------
// Parse from HTML
// ---------------------------------------------------------------------------

/** HTML heading pattern — matches h1–h6 tags (case-insensitive). */
const HTML_HEADING_RE = /<h([1-6])(?:\s[^>]*)?>([^<]*(?:<(?!\/h[1-6]>)[^<]*)*)<\/h[1-6]>/gi;

/** Strip all HTML tags from a string. */
function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

/**
 * Extract headings from an HTML string.
 * Note: this is a regex-based parser — it handles common Notesaner output
 * reliably but is not a full DOM parser.
 */
function extractHtmlHeadings(html: string): Omit<TocEntry, 'children'>[] {
  const entries: Omit<TocEntry, 'children'>[] = [];

  let match: RegExpExecArray | null;
  HTML_HEADING_RE.lastIndex = 0;

  while ((match = HTML_HEADING_RE.exec(html)) !== null) {
    const level = parseInt(match[1], 10);
    const rawHtml = match[2];
    const text = stripHtmlTags(rawHtml).trim();

    if (!text) continue;

    // Try to extract existing id attribute from the opening tag
    const idMatch = /id="([^"]+)"/.exec(match[0]);
    const id = idMatch ? idMatch[1] : slugify(text);

    entries.push({ level, text, id });
  }

  return entries;
}

/**
 * Parse an HTML string and return a nested table of contents.
 *
 * @param html  HTML content string
 * @returns     Nested TocEntry array (may be empty if no headings found)
 */
export function fromHtml(html: string): TocEntry[] {
  const flat = extractHtmlHeadings(html);
  const tree = buildTree(flat);
  deduplicateSlugs(tree);
  return tree;
}

// ---------------------------------------------------------------------------
// TOC rendering helpers
// ---------------------------------------------------------------------------

/**
 * Render a TocEntry tree to an HTML unordered list.
 *
 * @param entries   The TOC tree to render
 * @param maxDepth  Maximum nesting depth to include (default: 3)
 * @returns         HTML string for the TOC list items
 */
function renderTocList(entries: TocEntry[], depth: number, maxDepth: number): string {
  if (depth > maxDepth || entries.length === 0) return '';

  const items = entries
    .map((entry) => {
      const childrenHtml =
        entry.children.length > 0
          ? `<ul class="pdf-toc-list">${renderTocList(entry.children, depth + 1, maxDepth)}</ul>`
          : '';

      return `
        <li class="pdf-toc-item pdf-toc-level-${entry.level}">
          <a class="pdf-toc-anchor" href="#${entry.id}">
            <span class="pdf-toc-item-text">${escapeHtml(entry.text)}</span>
          </a>
          <span class="pdf-toc-item-dots"></span>
          ${childrenHtml}
        </li>`.trim();
    })
    .join('\n');

  return items;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Render the full TOC HTML block including title.
 *
 * @param entries   The TOC entry tree
 * @param title     The title displayed above the TOC (default: "Table of Contents")
 * @param maxDepth  How many heading levels to include (default: 3)
 * @returns         HTML string ready to prepend to the document body
 */
export function renderTocHtml(
  entries: TocEntry[],
  title = 'Table of Contents',
  maxDepth = 3,
): string {
  if (entries.length === 0) return '';

  return `
<nav class="pdf-toc">
  <div class="pdf-toc-title">${escapeHtml(title)}</div>
  <ul class="pdf-toc-list">
    ${renderTocList(entries, 1, maxDepth)}
  </ul>
</nav>`.trim();
}

/**
 * Flatten a TocEntry tree to a plain ordered list (depth-first).
 * Useful for generating anchor injection maps.
 */
export function flattenToc(entries: TocEntry[]): TocEntry[] {
  const result: TocEntry[] = [];
  function walk(items: TocEntry[]) {
    for (const item of items) {
      result.push(item);
      walk(item.children);
    }
  }
  walk(entries);
  return result;
}
