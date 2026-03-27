/**
 * Lightweight markdown text extractor for full-text search indexing.
 *
 * This module intentionally avoids heavy unified/remark dependencies so the
 * processor can run with minimal overhead in the BullMQ worker context.
 * It performs line-by-line parsing without building a full AST.
 *
 * Responsibilities:
 *   1. Strip YAML frontmatter (--- ... ---)
 *   2. Separate ATX heading text (# ## ### ...) from body text
 *   3. Strip Markdown syntax from body (links, images, bold, code, etc.)
 *   4. Convert frontmatter values to a flat searchable string
 */

export interface ExtractedContent {
  /** Concatenated text of all headings (for weight B in tsvector). */
  headingsText: string;
  /** Plain text body without headings or frontmatter (for weight C). */
  bodyText: string;
  /** Parsed YAML frontmatter key-value pairs. */
  frontmatter: Record<string, string>;
}

// Matches an ATX heading: # through ######, optional closing hashes
const HEADING_RE = /^#{1,6}\s+(.+?)(?:\s+#+)?$/;

// Matches YAML frontmatter block at the very start of the file
const FRONTMATTER_DELIMITER = '---';

// Patterns to strip from markdown body (applied in order)
const STRIP_PATTERNS: RegExp[] = [
  /!\[.*?\]\(.*?\)/g,      // images
  /\[.*?\]\(.*?\)/g,       // links — keep link text
  /```[\s\S]*?```/g,       // fenced code blocks
  /`[^`]+`/g,              // inline code
  /^\s*[-*+]\s+/gm,        // list bullets
  /^\s*\d+\.\s+/gm,        // numbered list markers
  /[*_]{1,2}([^*_]+)[*_]{1,2}/g,  // bold/italic (keep inner text)
  /~~([^~]+)~~/g,          // strikethrough (keep inner text)
  /\|.*?\|/g,              // table cells
  /^[-*_]{3,}\s*$/gm,      // horizontal rules
  /^>\s*/gm,               // blockquote markers
  /^#+\s+/gm,              // heading markers (we already extracted these)
  /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,  // wiki links — keep link target text
];

export class MarkdownExtractor {
  /**
   * Parse raw markdown content and return separated text segments for indexing.
   */
  static extract(rawContent: string): ExtractedContent {
    const { body, frontmatter } = MarkdownExtractor.parseFrontmatter(rawContent);

    const headingLines: string[] = [];
    const bodyLines: string[] = [];

    for (const line of body.split('\n')) {
      const headingMatch = HEADING_RE.exec(line);
      if (headingMatch) {
        headingLines.push(headingMatch[1].trim());
      } else {
        bodyLines.push(line);
      }
    }

    const rawBodyText = bodyLines.join('\n');
    const cleanBodyText = MarkdownExtractor.stripMarkdown(rawBodyText);

    return {
      headingsText: headingLines.join(' ').slice(0, 50_000),
      bodyText: cleanBodyText.slice(0, 500_000),
      frontmatter,
    };
  }

  /**
   * Convert a frontmatter map into a flat space-separated string for tsvector D weight.
   * Skips keys that start with underscore or have non-scalar values.
   */
  static frontmatterToSearchText(fm: Record<string, string>): string {
    return Object.entries(fm)
      .filter(([key]) => !key.startsWith('_'))
      .map(([, value]) => String(value))
      .join(' ')
      .slice(0, 10_000);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Strip the YAML frontmatter block from raw markdown.
   * Returns the body text and a flat map of string values (arrays joined).
   */
  private static parseFrontmatter(raw: string): {
    body: string;
    frontmatter: Record<string, string>;
  } {
    const lines = raw.split('\n');

    if (lines[0]?.trim() !== FRONTMATTER_DELIMITER) {
      return { body: raw, frontmatter: {} };
    }

    let endIndex = -1;
    for (let i = 1; i < lines.length; i++) {
      if (lines[i]?.trim() === FRONTMATTER_DELIMITER) {
        endIndex = i;
        break;
      }
    }

    if (endIndex === -1) {
      // Unclosed frontmatter — treat whole file as body
      return { body: raw, frontmatter: {} };
    }

    const fmLines = lines.slice(1, endIndex);
    const body = lines.slice(endIndex + 1).join('\n');
    const frontmatter = MarkdownExtractor.parseFlatYaml(fmLines);

    return { body, frontmatter };
  }

  /**
   * Very lightweight YAML parser for simple key: value pairs.
   * Supports:
   *   - Scalar strings: key: value
   *   - Quoted strings: key: "value"
   *   - Inline arrays: key: [a, b, c]
   *   - Multi-line lists:
   *       key:
   *         - item1
   *         - item2
   *
   * Does NOT support nested objects. Unknown structures are skipped.
   */
  private static parseFlatYaml(lines: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    let currentKey: string | null = null;
    const listBuffer: string[] = [];

    const flushList = () => {
      if (currentKey && listBuffer.length > 0) {
        result[currentKey] = listBuffer.join(' ');
        listBuffer.length = 0;
      }
    };

    for (const line of lines) {
      // Skip blank lines and comments
      if (!line.trim() || line.trim().startsWith('#')) continue;

      // List item under a current key
      if (currentKey && /^\s+-\s+(.+)$/.test(line)) {
        const match = /^\s+-\s+(.+)$/.exec(line);
        if (match) listBuffer.push(match[1].trim());
        continue;
      }

      // New key: value line
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;

      flushList();

      const key = line.slice(0, colonIdx).trim();
      const rawValue = line.slice(colonIdx + 1).trim();

      if (!key) continue;

      if (rawValue === '') {
        // value will be on subsequent list lines
        currentKey = key;
        continue;
      }

      currentKey = null;

      // Handle inline array: [a, b, c]
      if (rawValue.startsWith('[') && rawValue.endsWith(']')) {
        const inner = rawValue.slice(1, -1);
        result[key] = inner
          .split(',')
          .map((s) => s.trim().replace(/^["']|["']$/g, ''))
          .join(' ');
        continue;
      }

      // Strip surrounding quotes
      result[key] = rawValue.replace(/^["']|["']$/g, '');
    }

    flushList();
    return result;
  }

  /**
   * Remove Markdown syntax from body text, leaving only human-readable content.
   */
  private static stripMarkdown(text: string): string {
    let result = text;

    for (const pattern of STRIP_PATTERNS) {
      result = result.replace(pattern, (_match, capture: string | undefined) => {
        // For patterns that capture inner text (bold, italic, etc.) return it
        return capture !== undefined ? capture : ' ';
      });
    }

    // Collapse excessive whitespace
    return result
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}
