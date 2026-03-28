/**
 * Tests for slide-parser utilities.
 *
 * Coverage:
 * - parseSlides — full parsing pipeline (frontmatter + body)
 * - extractSlides — convenience wrapper
 * - countSlides — fast slide count
 * - Slide boundary detection (--- separator)
 * - Speaker notes extraction (<!-- notes: ... -->)
 * - Title extraction from first heading
 * - Frontmatter metadata (title, theme, transition)
 * - Edge cases (empty content, no frontmatter, blank slides)
 */

import { describe, it, expect } from 'vitest';
import { parseSlides, extractSlides, countSlides } from '../slide-parser';
import type { ParsedPresentation, Slide } from '../slide-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNote(body: string, frontmatter?: string): string {
  if (!frontmatter) return body;
  return `---\n${frontmatter}\n---\n${body}`;
}

// ---------------------------------------------------------------------------
// parseSlides — basic splitting
// ---------------------------------------------------------------------------

describe('parseSlides — basic splitting', () => {
  it('returns a single slide when there is no --- separator', () => {
    const result = parseSlides('# Hello\n\nThis is a note.');
    expect(result.slides).toHaveLength(1);
    expect(result.slides[0].content).toContain('# Hello');
  });

  it('splits on --- into two slides', () => {
    const md = '# Slide 1\n\nContent A\n\n---\n\n# Slide 2\n\nContent B';
    const result = parseSlides(md);
    expect(result.slides).toHaveLength(2);
    expect(result.slides[0].content).toContain('# Slide 1');
    expect(result.slides[1].content).toContain('# Slide 2');
  });

  it('splits on multiple --- separators', () => {
    const md = '# S1\n\n---\n\n# S2\n\n---\n\n# S3';
    const { slides } = parseSlides(md);
    expect(slides).toHaveLength(3);
    expect(slides[0].title).toBe('S1');
    expect(slides[1].title).toBe('S2');
    expect(slides[2].title).toBe('S3');
  });

  it('assigns zero-based index to each slide', () => {
    const md = 'A\n\n---\n\nB\n\n---\n\nC';
    const { slides } = parseSlides(md);
    expect(slides.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it('handles --- with surrounding whitespace on the line', () => {
    const md = '# S1\n\n  ---  \n\n# S2';
    const { slides } = parseSlides(md);
    expect(slides).toHaveLength(2);
  });

  it('handles ---- (more than 3 hyphens) as a separator', () => {
    const md = '# S1\n\n----\n\n# S2';
    const { slides } = parseSlides(md);
    expect(slides).toHaveLength(2);
  });

  it('returns a single blank slide for completely empty input', () => {
    const { slides } = parseSlides('');
    expect(slides).toHaveLength(1);
    expect(slides[0].content).toBe('');
  });
});

// ---------------------------------------------------------------------------
// parseSlides — title extraction
// ---------------------------------------------------------------------------

describe('parseSlides — title extraction', () => {
  it('extracts h1 heading as slide title', () => {
    const { slides } = parseSlides('# My Title\n\nBody text');
    expect(slides[0].title).toBe('My Title');
  });

  it('returns empty string when no heading is present', () => {
    const { slides } = parseSlides('Just a paragraph, no heading.');
    expect(slides[0].title).toBe('');
  });

  it('uses the first h1 only (not h2)', () => {
    const { slides } = parseSlides('## Sub heading\n\n# Top heading');
    // The regex picks the first h1; there is none before ## so we get 'Top heading'
    expect(slides[0].title).toBe('Top heading');
  });

  it('each slide has its own title', () => {
    const md = '# First\n\n---\n\n# Second';
    const { slides } = parseSlides(md);
    expect(slides[0].title).toBe('First');
    expect(slides[1].title).toBe('Second');
  });

  it('trims extra whitespace from extracted title', () => {
    const { slides } = parseSlides('#  Title With Extra Spaces  ');
    expect(slides[0].title).toBe('Title With Extra Spaces');
  });
});

// ---------------------------------------------------------------------------
// parseSlides — speaker notes extraction
// ---------------------------------------------------------------------------

describe('parseSlides — speaker notes extraction', () => {
  it('extracts speaker notes from <!-- notes: ... --> comment', () => {
    const md = '# Slide\n\nContent\n\n<!-- notes: These are my notes. -->';
    const { slides } = parseSlides(md);
    expect(slides[0].speakerNotes).toBe('These are my notes.');
  });

  it('removes the notes comment from the slide content', () => {
    const md = '# Slide\n\nContent\n\n<!-- notes: Hidden note -->';
    const { slides } = parseSlides(md);
    expect(slides[0].content).not.toContain('<!-- notes:');
    expect(slides[0].content).toContain('# Slide');
  });

  it('returns empty string for speakerNotes when no comment is present', () => {
    const { slides } = parseSlides('# Slide\n\nContent');
    expect(slides[0].speakerNotes).toBe('');
  });

  it('handles multiline speaker notes', () => {
    const md = '# S\n\n<!-- notes: Line one.\nLine two.\nLine three. -->';
    const { slides } = parseSlides(md);
    expect(slides[0].speakerNotes).toContain('Line one.');
    expect(slides[0].speakerNotes).toContain('Line three.');
  });

  it('extracts independent notes per slide', () => {
    const md = '# S1\n<!-- notes: Note A -->\n\n---\n\n# S2\n<!-- notes: Note B -->';
    const { slides } = parseSlides(md);
    expect(slides[0].speakerNotes).toBe('Note A');
    expect(slides[1].speakerNotes).toBe('Note B');
  });

  it('is case-insensitive for the notes keyword', () => {
    const md = '# S\n<!-- NOTES: uppercase notes -->';
    const { slides } = parseSlides(md);
    expect(slides[0].speakerNotes).toBe('uppercase notes');
  });

  it('trims whitespace from extracted notes', () => {
    const md = '<!-- notes:   padded content   -->';
    const { slides } = parseSlides(md);
    expect(slides[0].speakerNotes).toBe('padded content');
  });
});

// ---------------------------------------------------------------------------
// parseSlides — frontmatter metadata
// ---------------------------------------------------------------------------

describe('parseSlides — frontmatter metadata', () => {
  it('parses title from frontmatter', () => {
    const note = makeNote('# Body', 'title: My Talk');
    const { frontmatter } = parseSlides(note);
    expect(frontmatter.title).toBe('My Talk');
  });

  it('parses theme from nested slides.theme', () => {
    const note = makeNote('# Body', 'slides:\n  theme: dark');
    const { frontmatter } = parseSlides(note);
    expect(frontmatter.theme).toBe('dark');
  });

  it('parses transition from nested slides.transition', () => {
    const note = makeNote('# Body', 'slides:\n  transition: slide');
    const { frontmatter } = parseSlides(note);
    expect(frontmatter.transition).toBe('slide');
  });

  it('falls back to first slide heading when title is absent from frontmatter', () => {
    const note = makeNote('# Heading From Body');
    const { frontmatter } = parseSlides(note);
    expect(frontmatter.title).toBe('Heading From Body');
  });

  it('returns empty title when no frontmatter title and no headings', () => {
    const { frontmatter } = parseSlides('Just plain text without a heading.');
    expect(frontmatter.title).toBe('');
  });

  it('returns undefined for theme when not set', () => {
    const { frontmatter } = parseSlides('# Slide');
    expect(frontmatter.theme).toBeUndefined();
  });

  it('strips frontmatter block from slide content', () => {
    const note = makeNote('# Body content', 'title: Test');
    const { slides } = parseSlides(note);
    expect(slides[0].content).not.toContain('title: Test');
  });

  it('parses both title and slides options together', () => {
    const note = makeNote(
      '# First Slide',
      'title: Conference Talk\nslides:\n  theme: academic\n  transition: fade',
    );
    const { frontmatter } = parseSlides(note);
    expect(frontmatter.title).toBe('Conference Talk');
    expect(frontmatter.theme).toBe('academic');
    expect(frontmatter.transition).toBe('fade');
  });
});

// ---------------------------------------------------------------------------
// extractSlides — convenience wrapper
// ---------------------------------------------------------------------------

describe('extractSlides', () => {
  it('returns the same slides as parseSlides', () => {
    const md = '# A\n\n---\n\n# B';
    const direct = parseSlides(md).slides;
    const wrapped = extractSlides(md);
    expect(wrapped).toEqual(direct);
  });

  it('returns an array of Slide objects', () => {
    const slides: Slide[] = extractSlides('# Test');
    expect(slides[0]).toHaveProperty('index');
    expect(slides[0]).toHaveProperty('content');
    expect(slides[0]).toHaveProperty('speakerNotes');
    expect(slides[0]).toHaveProperty('title');
  });
});

// ---------------------------------------------------------------------------
// countSlides
// ---------------------------------------------------------------------------

describe('countSlides', () => {
  it('returns 1 for content with no separator', () => {
    expect(countSlides('# Single slide')).toBe(1);
  });

  it('counts separators correctly', () => {
    expect(countSlides('A\n\n---\n\nB')).toBe(2);
    expect(countSlides('A\n\n---\n\nB\n\n---\n\nC')).toBe(3);
  });

  it('returns 1 for completely empty string', () => {
    expect(countSlides('')).toBe(1);
  });

  it('does not count frontmatter --- as a slide boundary', () => {
    const note = makeNote('# Body\n\n---\n\n# Slide 2', 'title: Test');
    // frontmatter stripped, 2 slides remain
    expect(countSlides(note)).toBe(2);
  });

  it('handles large numbers of slides', () => {
    const slides = Array.from({ length: 20 }, (_, i) => `# Slide ${i + 1}`).join('\n\n---\n\n');
    expect(countSlides(slides)).toBe(20);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('parseSlides — edge cases', () => {
  it('handles slides with only whitespace content gracefully', () => {
    const md = '# S1\n\n---\n\n   \n\n---\n\n# S3';
    const { slides } = parseSlides(md);
    expect(slides).toHaveLength(3);
    expect(slides[1].content).toBe('');
  });

  it('handles a note that is only frontmatter', () => {
    const note = '---\ntitle: Empty\n---\n';
    const { slides, frontmatter } = parseSlides(note);
    expect(frontmatter.title).toBe('Empty');
    expect(slides).toHaveLength(1);
    expect(slides[0].content).toBe('');
  });

  it('handles frontmatter ending with ...', () => {
    const note = '---\ntitle: Dot End\n...\n# Body here';
    const { frontmatter, slides } = parseSlides(note);
    expect(frontmatter.title).toBe('Dot End');
    expect(slides[0].content).toContain('# Body here');
  });

  it('does not include the notes comment text in slide content', () => {
    const md = '# S\n\n<!-- notes: hidden -->\n\nVisible body';
    const { slides } = parseSlides(md);
    expect(slides[0].content).not.toContain('hidden');
    expect(slides[0].content).toContain('Visible body');
  });

  it('returns a ParsedPresentation object with the correct shape', () => {
    const result: ParsedPresentation = parseSlides('# Test');
    expect(result).toHaveProperty('slides');
    expect(result).toHaveProperty('frontmatter');
    expect(Array.isArray(result.slides)).toBe(true);
  });
});
