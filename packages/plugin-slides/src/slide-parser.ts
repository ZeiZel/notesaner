/**
 * Slide parser for the Notesaner Slides plugin.
 *
 * Responsibilities:
 * - Split a markdown note body into individual slides using `---` (HR) separators
 * - Extract speaker notes from `<!-- notes: ... -->` HTML comments
 * - Parse YAML frontmatter metadata (title, theme, transition) from the note
 * - Return typed Slide and ParsedPresentation structures
 *
 * Frontmatter schema expected on the note:
 *
 * ```yaml
 * slides:
 *   theme: dark         # built-in theme id
 *   transition: fade    # slide transition style
 * title: My Presentation
 * ```
 *
 * Speaker notes syntax (inside any slide):
 * ```
 * <!-- notes: These are speaker notes for this slide. -->
 * ```
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single parsed slide. */
export interface Slide {
  /** Zero-based index of the slide within the presentation. */
  index: number;
  /** The markdown content of the slide (speaker notes comment removed). */
  content: string;
  /**
   * Speaker notes extracted from `<!-- notes: ... -->` in the slide content.
   * Empty string when no notes comment is present.
   */
  speakerNotes: string;
  /**
   * A plain-text title extracted from the first heading (`# Title`) in the
   * slide content, or an empty string if no heading is present.
   */
  title: string;
}

/** Frontmatter metadata that controls presentation behaviour. */
export interface PresentationFrontmatter {
  /** The note's top-level title (frontmatter `title` or first slide heading). */
  title: string;
  /** Optional built-in theme id, e.g. "dark", "academic". */
  theme?: string;
  /** Optional transition style, e.g. "fade", "slide", "none". */
  transition?: string;
}

/** The full result of parsing a markdown note into a presentation. */
export interface ParsedPresentation {
  /** Ordered list of slides derived from splitting on `---`. */
  slides: Slide[];
  /** Metadata extracted from the note's frontmatter. */
  frontmatter: PresentationFrontmatter;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Regex that matches a bare horizontal rule `---` used as a slide separator.
 *
 * Rules:
 * - Must appear on its own line (no surrounding text on the same line)
 * - Only sequences of exactly three or more hyphens separated from content
 * - Does NOT match `---` inside YAML frontmatter blocks (those are handled
 *   separately by stripping the frontmatter before splitting)
 *
 * The regex splits on: a newline, optional whitespace, `---` (3+ hyphens),
 * optional whitespace, then a newline (or end-of-string).
 */
const SLIDE_SEPARATOR_RE = /^[ \t]*---+[ \t]*$/m;

/**
 * Regex for extracting speaker notes from an HTML comment.
 * Captures the first `<!-- notes: ... -->` in a slide.
 * Content is trimmed.
 */
const SPEAKER_NOTES_RE = /<!--\s*notes:\s*([\s\S]*?)\s*-->/i;

/**
 * Regex for extracting the first level-1 heading from markdown content.
 * Captures the heading text without the `#` prefix.
 */
const HEADING_RE = /^#[ \t]+(.+)$/m;

/**
 * Regex for detecting and extracting YAML frontmatter.
 * Matches content between the opening `---` and closing `---` or `...`.
 */
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n(?:---|\.\.\.)(?:\n|$)/;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Strips the YAML frontmatter block from raw markdown content.
 * Returns the body (everything after the frontmatter delimiter).
 */
function stripFrontmatter(raw: string): string {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return raw;
  return raw.slice(match[0].length);
}

/**
 * Extracts speaker notes from a slide's raw content.
 * Returns the notes text (trimmed) and the content with the comment removed.
 */
function extractSpeakerNotes(content: string): { notes: string; cleanContent: string } {
  const match = SPEAKER_NOTES_RE.exec(content);
  if (!match) return { notes: '', cleanContent: content };

  const notes = match[1].trim();
  const cleanContent = content.replace(match[0], '').trim();
  return { notes, cleanContent };
}

/**
 * Extracts the first h1 heading text from markdown content.
 * Returns an empty string when no heading is present.
 */
function extractTitle(content: string): string {
  const match = HEADING_RE.exec(content);
  return match ? match[1].trim() : '';
}

/**
 * Minimal YAML key-value parser for flat presentation frontmatter.
 *
 * Only supports top-level scalar string values and a single-level nested
 * `slides` object. Sufficient for the plugin's controlled frontmatter schema.
 * Does NOT handle general YAML — for that, use a full YAML library.
 */
function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const nested: Record<string, string> = {};
  let currentParent: string | null = null;

  for (const rawLine of yaml.split('\n')) {
    const line = rawLine.replace(/\r$/, '');

    // Detect an indented child key (2+ spaces)
    const nestedMatch = /^( {2,}|\t)(\w[\w-]*):\s*(.*)$/.exec(line);
    if (nestedMatch) {
      const key = nestedMatch[2];
      const value = nestedMatch[3].replace(/^["']|["']$/g, '').trim();
      if (currentParent) {
        nested[`${currentParent}.${key}`] = value;
      }
      continue;
    }

    // Top-level key
    const topMatch = /^(\w[\w-]*):\s*(.*)$/.exec(line);
    if (topMatch) {
      const key = topMatch[1];
      const value = topMatch[2].replace(/^["']|["']$/g, '').trim();
      if (value === '') {
        // May be a parent for nested keys
        currentParent = key;
        result[key] = {};
      } else {
        currentParent = null;
        result[key] = value;
      }
    }
  }

  // Fold nested keys back into their parent objects
  for (const [dotKey, value] of Object.entries(nested)) {
    const [parent, child] = dotKey.split('.');
    if (typeof result[parent] === 'object' && result[parent] !== null) {
      (result[parent] as Record<string, string>)[child] = value;
    }
  }

  return result;
}

/**
 * Extracts presentation metadata from raw frontmatter YAML.
 */
function parseFrontmatterMeta(raw: string): PresentationFrontmatter {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return { title: '' };

  const parsed = parseSimpleYaml(match[1]);

  const slidesBlock =
    typeof parsed['slides'] === 'object' && parsed['slides'] !== null
      ? (parsed['slides'] as Record<string, unknown>)
      : {};

  return {
    title: typeof parsed['title'] === 'string' ? parsed['title'] : '',
    theme: typeof slidesBlock['theme'] === 'string' ? slidesBlock['theme'] : undefined,
    transition:
      typeof slidesBlock['transition'] === 'string' ? slidesBlock['transition'] : undefined,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses a full markdown note (including optional YAML frontmatter) into a
 * typed ParsedPresentation.
 *
 * Algorithm:
 * 1. Extract frontmatter metadata (title, theme, transition).
 * 2. Strip the frontmatter block from the raw content.
 * 3. Split the body on `---` horizontal rule separators.
 * 4. For each resulting chunk, extract speaker notes and the first heading.
 * 5. Return the ordered slide list and frontmatter metadata.
 *
 * Empty chunks (slides with no content after trimming) are included as blank
 * slides so that slide indices are predictable — callers can filter them if
 * desired.
 *
 * @param markdown  Full markdown text of a note (may include frontmatter).
 */
export function parseSlides(markdown: string): ParsedPresentation {
  const frontmatter = parseFrontmatterMeta(markdown);
  const body = stripFrontmatter(markdown);

  // Split into raw chunks on the slide separator.
  const rawChunks = body.split(SLIDE_SEPARATOR_RE);

  const slides: Slide[] = rawChunks.map((rawChunk, index) => {
    const trimmed = rawChunk.trim();
    const { notes, cleanContent } = extractSpeakerNotes(trimmed);
    const title = extractTitle(cleanContent);

    return {
      index,
      content: cleanContent,
      speakerNotes: notes,
      title,
    };
  });

  // If no title was found in the frontmatter, use the first slide's heading.
  if (!frontmatter.title && slides.length > 0) {
    frontmatter.title = slides[0].title;
  }

  return { slides, frontmatter };
}

/**
 * Convenience wrapper: returns just the slide array from `parseSlides`.
 *
 * @param markdown  Full markdown text.
 */
export function extractSlides(markdown: string): Slide[] {
  return parseSlides(markdown).slides;
}

/**
 * Returns the total number of slides in the given markdown.
 * Does not parse slide bodies — fast path for display purposes.
 *
 * @param markdown  Full markdown text.
 */
export function countSlides(markdown: string): number {
  const body = stripFrontmatter(markdown);
  return body.split(SLIDE_SEPARATOR_RE).length;
}
