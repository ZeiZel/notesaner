/**
 * HTML-to-Markdown converter for the web clipper plugin.
 *
 * Converts raw HTML strings into clean Markdown, handling:
 * - Block elements: headings (h1–h6), paragraphs, blockquotes, pre/code,
 *   ordered/unordered lists, tables, horizontal rules
 * - Inline elements: bold, italic, code, links, images, strikethrough
 * - Nested structures: lists inside lists, blockquotes inside blockquotes
 * - URL cleaning: absolute resolution and removal of tracking parameters
 *
 * The converter is intentionally standalone (no external HTML-parsing
 * libraries) and uses regex-based transformation for portability in both
 * browser extension and Node.js test environments.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HtmlToMarkdownOptions {
  /**
   * Base URL used to resolve relative URLs found in href/src attributes.
   * When absent, relative URLs are kept as-is.
   */
  baseUrl?: string;

  /**
   * When true, strips tracking query parameters from URLs
   * (utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid).
   * Defaults to true.
   */
  stripTracking?: boolean;

  /**
   * Whether to preserve image embeds (`![alt](src)`).
   * Defaults to true.
   */
  preserveImages?: boolean;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Converts an HTML string to Markdown.
 *
 * @param html    - Raw HTML to convert.
 * @param options - Conversion options.
 * @returns Clean Markdown string.
 */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
  const { baseUrl, stripTracking = true, preserveImages = true } = options;

  let md = html;

  // 1. Normalise line endings
  md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // 2. Strip HTML comments
  md = md.replace(/<!--[\s\S]*?-->/g, '');

  // 3. Strip <script>, <style>, <noscript> blocks entirely
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<noscript[\s\S]*?<\/noscript>/gi, '');

  // 4. Convert block elements (order matters — outer before inner)
  // Pre/code blocks are extracted to placeholders first to protect their
  // decoded content from the tag stripper at step 6.
  const codeBlocks: string[] = [];
  md = convertPreCode(md, codeBlocks);

  md = convertHeadings(md);
  md = convertBlockquotes(md);
  md = convertTables(md);
  md = convertLists(md);
  md = convertHorizontalRules(md);
  md = convertLineBreaks(md);
  md = convertParagraphs(md);

  // 5. Convert inline elements
  md = convertInlineCode(md);
  md = convertBoldItalic(md);
  md = convertStrikethrough(md);
  md = convertLinks(md, baseUrl, stripTracking);
  if (preserveImages) {
    md = convertImages(md, baseUrl, stripTracking);
  } else {
    // Remove image tags entirely
    md = md.replace(/<img[^>]*>/gi, '');
  }

  // 6. Strip remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // 7. Decode HTML entities
  md = decodeHtmlEntities(md);

  // Restore protected code blocks (already decoded/cleaned)
  md = md.replace(/\x00CODE_BLOCK_(\d+)\x00/g, (_, idx) => codeBlocks[Number(idx)] ?? '');

  // 8. Normalise whitespace
  md = normaliseWhitespace(md);

  return md.trim();
}

// ---------------------------------------------------------------------------
// Block converters
// ---------------------------------------------------------------------------

function convertHeadings(html: string): string {
  return html
    .replace(
      /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
      (_, content) => `\n\n# ${stripTags(content).trim()}\n\n`,
    )
    .replace(
      /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
      (_, content) => `\n\n## ${stripTags(content).trim()}\n\n`,
    )
    .replace(
      /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
      (_, content) => `\n\n### ${stripTags(content).trim()}\n\n`,
    )
    .replace(
      /<h4[^>]*>([\s\S]*?)<\/h4>/gi,
      (_, content) => `\n\n#### ${stripTags(content).trim()}\n\n`,
    )
    .replace(
      /<h5[^>]*>([\s\S]*?)<\/h5>/gi,
      (_, content) => `\n\n##### ${stripTags(content).trim()}\n\n`,
    )
    .replace(
      /<h6[^>]*>([\s\S]*?)<\/h6>/gi,
      (_, content) => `\n\n###### ${stripTags(content).trim()}\n\n`,
    );
}

function convertBlockquotes(html: string): string {
  // Handle nested blockquotes recursively (up to 3 levels)
  let result = html;
  for (let level = 3; level >= 1; level--) {
    const prefix = '> '.repeat(level);
    result = result.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, content) => {
      const lines = stripTags(content).trim().split('\n');
      const quoted = lines.map((line) => `${prefix}${line}`).join('\n');
      return `\n\n${quoted}\n\n`;
    });
  }
  return result;
}

function convertPreCode(html: string, codeBlocks: string[]): string {
  // <pre><code class="language-X"> — extract language from class
  return (
    html
      .replace(/<pre[^>]*>\s*<code([^>]*)>([\s\S]*?)<\/code>\s*<\/pre>/gi, (_, attrs, code) => {
        const langMatch = /class="[^"]*language-([a-z0-9_+-]+)[^"]*"/i.exec(attrs);
        const lang = langMatch ? langMatch[1] : '';
        const decoded = decodeHtmlEntities(code);
        const block = `\n\n\`\`\`${lang}\n${decoded}\n\`\`\`\n\n`;
        const idx = codeBlocks.length;
        codeBlocks.push(block);
        return `\x00CODE_BLOCK_${idx}\x00`;
      })
      // Bare <pre> without <code>
      .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, code) => {
        const decoded = decodeHtmlEntities(stripTags(code));
        const block = `\n\n\`\`\`\n${decoded}\n\`\`\`\n\n`;
        const idx = codeBlocks.length;
        codeBlocks.push(block);
        return `\x00CODE_BLOCK_${idx}\x00`;
      })
  );
}

function convertTables(html: string): string {
  return html.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_, tableContent) => {
    const rows: string[][] = [];
    let isHeader = false;
    let headerRowIndex = -1;

    // Extract thead rows
    const theadMatch = /<thead[^>]*>([\s\S]*?)<\/thead>/i.exec(tableContent);
    if (theadMatch) {
      const theadRows = extractTableRows(theadMatch[1]);
      if (theadRows.length > 0) {
        rows.push(...theadRows);
        headerRowIndex = theadRows.length - 1;
        isHeader = true;
      }
    }

    // Extract tbody rows
    const tbodyMatch = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i.exec(tableContent);
    const bodyContent = tbodyMatch ? tbodyMatch[1] : tableContent;
    rows.push(...extractTableRows(bodyContent));

    if (rows.length === 0) return '';

    // If no explicit header, treat first row as header
    if (!isHeader && rows.length > 0) {
      headerRowIndex = 0;
    }

    const colCount = Math.max(...rows.map((r) => r.length));
    const lines: string[] = [];

    rows.forEach((row, idx) => {
      // Pad row to full width
      while (row.length < colCount) row.push('');
      lines.push(`| ${row.join(' | ')} |`);

      // Insert separator after header row
      if (idx === headerRowIndex) {
        lines.push(`| ${Array(colCount).fill('---').join(' | ')} |`);
      }
    });

    return `\n\n${lines.join('\n')}\n\n`;
  });
}

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const cells: string[] = [];
    const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(stripTags(cellMatch[1]).trim().replace(/\|/g, '\\|'));
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

function convertLists(html: string): string {
  // Process nested lists (inner-first by repeated passes)
  let result = html;
  // Repeat up to 4 times to handle deep nesting
  for (let pass = 0; pass < 4; pass++) {
    result = convertListPass(result);
  }
  return result;
}

function convertListPass(html: string): string {
  // Convert <li> items first
  let result = html;

  // Unordered lists
  result = result.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, content) => {
    const items = extractListItems(content);
    if (items.length === 0) return '';
    return '\n\n' + items.map((item) => `- ${item}`).join('\n') + '\n\n';
  });

  // Ordered lists
  result = result.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, content) => {
    const items = extractListItems(content);
    if (items.length === 0) return '';
    return '\n\n' + items.map((item, i) => `${i + 1}. ${item}`).join('\n') + '\n\n';
  });

  return result;
}

function extractListItems(html: string): string[] {
  const items: string[] = [];
  const itemRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
  let m;
  while ((m = itemRegex.exec(html)) !== null) {
    const raw = m[1].trim();
    // Indent any nested list lines (lines starting with - or digit.)
    const processed = raw
      .split('\n')
      .map((line, idx) => {
        if (idx === 0) return stripTags(line).trim();
        const stripped = line.trim();
        if (!stripped) return '';
        return `  ${stripped}`;
      })
      .filter((line, idx) => idx === 0 || line !== '')
      .join('\n');
    if (processed) items.push(processed);
  }
  return items;
}

function convertHorizontalRules(html: string): string {
  return html.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n');
}

function convertLineBreaks(html: string): string {
  return html.replace(/<br[^>]*\/?>/gi, '  \n');
}

function convertParagraphs(html: string): string {
  return html
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_, content) => `\n\n${content}\n\n`)
    .replace(/<div[^>]*>([\s\S]*?)<\/div>/gi, (_, content) => `\n\n${content}\n\n`);
}

// ---------------------------------------------------------------------------
// Inline converters
// ---------------------------------------------------------------------------

function convertInlineCode(html: string): string {
  return html.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_, code) => {
    const decoded = decodeHtmlEntities(code);
    return `\`${decoded}\``;
  });
}

function convertBoldItalic(html: string): string {
  return (
    html
      // Bold: <strong> and <b>
      .replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, (_, content) => `**${content}**`)
      .replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, (_, content) => `**${content}**`)
      // Italic: <em> and <i>
      .replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, (_, content) => `_${content}_`)
      .replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, (_, content) => `_${content}_`)
  );
}

function convertStrikethrough(html: string): string {
  return html
    .replace(/<del[^>]*>([\s\S]*?)<\/del>/gi, (_, content) => `~~${content}~~`)
    .replace(/<s[^>]*>([\s\S]*?)<\/s>/gi, (_, content) => `~~${content}~~`)
    .replace(/<strike[^>]*>([\s\S]*?)<\/strike>/gi, (_, content) => `~~${content}~~`);
}

function convertLinks(html: string, baseUrl?: string, stripTracking = true): string {
  return html.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, text) => {
    const resolvedUrl = resolveUrl(href, baseUrl);
    const cleanUrl = stripTracking ? removeTrackingParams(resolvedUrl) : resolvedUrl;
    const cleanText = stripTags(text).trim();
    if (!cleanText) return cleanUrl;
    return `[${cleanText}](${cleanUrl})`;
  });
}

function convertImages(html: string, baseUrl?: string, stripTracking = true): string {
  return html.replace(/<img[^>]*>/gi, (imgTag) => {
    const srcMatch = /\bsrc="([^"]*)"/i.exec(imgTag);
    const altMatch = /\balt="([^"]*)"/i.exec(imgTag);
    if (!srcMatch) return '';
    const src = resolveUrl(srcMatch[1], baseUrl);
    const cleanSrc = stripTracking ? removeTrackingParams(src) : src;
    const alt = altMatch ? altMatch[1] : '';
    return `![${alt}](${cleanSrc})`;
  });
}

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

/**
 * Resolves a URL against an optional base URL.
 * Returns the original URL unchanged when resolution fails or no base is given.
 */
export function resolveUrl(url: string, base?: string): string {
  if (!url || url.startsWith('data:')) return url;
  if (!base) return url;
  try {
    return new URL(url, base).href;
  } catch {
    return url;
  }
}

/** Tracking query parameters to strip from URLs. */
const TRACKING_PARAMS = new Set([
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'fbclid',
  'gclid',
  'msclkid',
  'mc_eid',
  'mc_cid',
  '_ga',
  'ref',
]);

/**
 * Removes known tracking query parameters from a URL.
 * Returns the original string if the URL cannot be parsed.
 */
export function removeTrackingParams(url: string): string {
  if (!url || url.startsWith('data:')) return url;
  try {
    const parsed = new URL(url);
    TRACKING_PARAMS.forEach((param) => parsed.searchParams.delete(param));
    // Remove empty search string
    const search = parsed.searchParams.toString();
    // Preserve original trailing slash behaviour: use pathname as-is from parsed URL
    // but strip trailing slash when the path is just "/"
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return search
      ? `${parsed.origin}${pathname}?${search}${parsed.hash}`
      : `${parsed.origin}${pathname}${parsed.hash}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips all HTML tags from a string.
 * Used when converting block elements that may contain inline markup.
 */
function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** HTML entity map for common entities. */
const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&mdash;': '—',
  '&ndash;': '–',
  '&hellip;': '…',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&laquo;': '«',
  '&raquo;': '»',
};

/**
 * Decodes HTML entities to their plain-text equivalents.
 * Handles named entities from the map above, plus numeric entities (&#NNN; and &#xHH;).
 */
export function decodeHtmlEntities(text: string): string {
  // Named entities
  let result = text.replace(/&[a-z]+;/gi, (entity) => {
    return HTML_ENTITIES[entity.toLowerCase()] ?? entity;
  });

  // Decimal numeric entities: &#NNN;
  result = result.replace(/&#(\d+);/g, (_, code) => {
    return String.fromCharCode(parseInt(code, 10));
  });

  // Hexadecimal numeric entities: &#xHH;
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    return String.fromCharCode(parseInt(code, 16));
  });

  return result;
}

/**
 * Collapses excessive whitespace: multiple blank lines are reduced to two,
 * trailing single spaces on lines are removed (but intentional "  \n" markdown
 * line breaks — two trailing spaces — are preserved).
 */
function normaliseWhitespace(text: string): string {
  return (
    text
      // Remove single trailing space per line, but keep "  \n" (double space = <br> in MD)
      .replace(/(?<! ) \n/g, '\n')
      // Collapse 3+ consecutive blank lines to 2
      .replace(/\n{3,}/g, '\n\n')
  );
}
