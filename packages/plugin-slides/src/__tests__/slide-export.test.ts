/**
 * Tests for slide-export utilities.
 *
 * Coverage:
 * - exportToHtml — generates valid, self-contained HTML
 * - HTML structure (doctype, head, body, slides, counter, speaker notes)
 * - Theme CSS variable injection
 * - Slide content rendered into slide divs
 * - Speaker notes rendered / omitted based on includeSpeakerNotes flag
 * - Accessibility attributes (aria-label, role, aria-live)
 * - Export filename generation via getExportFilename
 * - Edge cases (empty slides, special characters in title)
 */

import { describe, it, expect } from 'vitest';
import { exportToHtml, getExportFilename } from '../slide-export';
import type { ExportOptions } from '../slide-export';
import type { Slide } from '../slide-parser';
import type { PresentationFrontmatter } from '../slide-parser';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSlide(index: number, overrides: Partial<Slide> = {}): Slide {
  return {
    index,
    title: `Slide ${index + 1}`,
    content: `# Slide ${index + 1}\n\nContent for slide ${index + 1}.`,
    speakerNotes: '',
    ...overrides,
  };
}

function makeOptions(overrides: Partial<ExportOptions> = {}): ExportOptions {
  return {
    slides: [makeSlide(0), makeSlide(1), makeSlide(2)],
    frontmatter: { title: 'Test Presentation', theme: 'default', transition: 'fade' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// exportToHtml — HTML structure
// ---------------------------------------------------------------------------

describe('exportToHtml — HTML structure', () => {
  it('generates a valid HTML5 document', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<head>');
    expect(html).toContain('<body>');
    expect(html).toContain('</html>');
  });

  it('includes the presentation title in the <title> tag', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('<title>Test Presentation</title>');
  });

  it('includes embedded CSS in a <style> tag', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toMatch(/<style>[\s\S]+<\/style>/);
  });

  it('includes embedded JS in a <script> tag', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toMatch(/<script>[\s\S]+<\/script>/);
  });

  it('renders one .slide div per slide', () => {
    const html = exportToHtml(makeOptions());
    // Match only the slide divs in the body (id="slide-N" pattern)
    const matches = html.match(/id="slide-\d+"/g) ?? [];
    expect(matches.length).toBe(3);
  });

  it('marks the first slide as active', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('class="slide active"');
  });

  it('includes a slide counter element', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('1 / 3');
  });

  it('includes a progress-bar element', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('progress-bar');
  });

  it('has a viewport meta tag', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('<meta name="viewport"');
  });

  it('includes a generator meta tag', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('content="Notesaner Slides"');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — slide content
// ---------------------------------------------------------------------------

describe('exportToHtml — slide content', () => {
  it('renders slide markdown content as HTML', () => {
    const slides = [makeSlide(0, { content: '# My Title\n\nParagraph text.', title: 'My Title' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<h1>My Title</h1>');
    expect(html).toContain('<p>Paragraph text.</p>');
  });

  it('renders bold text', () => {
    const slides = [makeSlide(0, { content: '**bold text**' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<strong>bold text</strong>');
  });

  it('renders italic text', () => {
    const slides = [makeSlide(0, { content: '*italic text*' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<em>italic text</em>');
  });

  it('renders unordered lists', () => {
    const slides = [makeSlide(0, { content: '- Item A\n- Item B' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>');
  });

  it('renders ordered lists', () => {
    const slides = [makeSlide(0, { content: '1. First\n2. Second' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<ol>');
  });

  it('renders fenced code blocks', () => {
    const slides = [makeSlide(0, { content: '```js\nconsole.log("hi");\n```' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('<pre>');
    expect(html).toContain('<code');
  });

  it('escapes HTML entities in content', () => {
    const slides = [makeSlide(0, { content: '<script>alert("xss")</script>' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).not.toContain('<script>alert');
    expect(html).toContain('&lt;script&gt;');
  });

  it('assigns sequential slide IDs', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('id="slide-0"');
    expect(html).toContain('id="slide-1"');
    expect(html).toContain('id="slide-2"');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — speaker notes
// ---------------------------------------------------------------------------

describe('exportToHtml — speaker notes', () => {
  it('includes speaker notes section by default', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('aria-label="Speaker notes"');
  });

  it('omits speaker notes section when includeSpeakerNotes is false', () => {
    const html = exportToHtml(makeOptions({ includeSpeakerNotes: false }));
    // The speaker-notes DIV element should not appear (CSS class definitions in <style> are still present)
    expect(html).not.toContain('aria-label="Speaker notes"');
  });

  it('embeds notes text as data-notes attribute on slide content div', () => {
    const slides = [makeSlide(0, { speakerNotes: 'Remember to pause here.' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('data-notes="Remember to pause here."');
  });

  it('does not add data-notes attribute when speakerNotes is empty', () => {
    const slides = [makeSlide(0, { speakerNotes: '' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    // The slide-content div should not have a data-notes attribute
    const match = html.match(/id="slide-0"[\s\S]*?<\/div>/);
    expect(match?.[0]).not.toContain('data-notes');
  });

  it('escapes double quotes in speaker notes', () => {
    const slides = [makeSlide(0, { speakerNotes: 'He said "hello".' })];
    const html = exportToHtml({ slides, frontmatter: { title: 'T' } });
    expect(html).toContain('&quot;hello&quot;');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — theme and CSS variables
// ---------------------------------------------------------------------------

describe('exportToHtml — theme', () => {
  it('injects dark theme CSS variables when dark theme is selected', () => {
    const html = exportToHtml(makeOptions({ themeId: 'dark' }));
    expect(html).toContain('--slide-bg: #0f172a');
  });

  it('injects default theme CSS variables by default', () => {
    const html = exportToHtml(makeOptions({ themeId: undefined, frontmatter: { title: 'T' } }));
    expect(html).toContain('--slide-bg: #ffffff');
  });

  it('uses frontmatter theme when themeId override is not provided', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T', theme: 'minimal' },
    });
    // Minimal theme has white bg as well, check a distinctive minimal property
    expect(html).toContain('--slide-radius: 0');
  });

  it('themeId override takes precedence over frontmatter theme', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T', theme: 'default' },
      themeId: 'neon',
    });
    // Neon theme has very dark bg
    expect(html).toContain('--slide-bg: #09090b');
  });

  it('falls back to default theme for unknown theme id', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T' },
      themeId: 'nonexistent-theme',
    });
    expect(html).toContain('--slide-bg: #ffffff');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — transition
// ---------------------------------------------------------------------------

describe('exportToHtml — transition', () => {
  it('applies fade transition CSS when transition is fade', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T', transition: 'fade' },
    });
    expect(html).toContain('opacity 0.4s ease');
  });

  it('applies slide transition CSS when transition is slide', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T', transition: 'slide' },
    });
    expect(html).toContain('transform 0.4s ease');
  });

  it('defaults to fade transition when not specified', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'T' },
    });
    expect(html).toContain('opacity 0.4s ease');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — accessibility
// ---------------------------------------------------------------------------

describe('exportToHtml — accessibility', () => {
  it('includes aria-label on the main presentation element', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('role="main"');
  });

  it('includes aria-label on each slide', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('aria-label="Slide 1 of 3"');
    expect(html).toContain('aria-label="Slide 3 of 3"');
  });

  it('includes aria-live on the slide counter', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('aria-live="polite"');
  });

  it('includes a progressbar role', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('role="progressbar"');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — JavaScript
// ---------------------------------------------------------------------------

describe('exportToHtml — JavaScript', () => {
  it('includes keyboard navigation code', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('ArrowRight');
    expect(html).toContain('ArrowLeft');
    expect(html).toContain('Escape');
  });

  it('includes fullscreen toggle code', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('requestFullscreen');
  });

  it('includes touch/swipe support', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('touchstart');
    expect(html).toContain('touchend');
  });

  it('embeds the correct total slide count in JS', () => {
    const html = exportToHtml(makeOptions());
    expect(html).toContain('var total = 3');
  });
});

// ---------------------------------------------------------------------------
// exportToHtml — edge cases
// ---------------------------------------------------------------------------

describe('exportToHtml — edge cases', () => {
  it('handles an empty slides array gracefully', () => {
    const html = exportToHtml({
      slides: [],
      frontmatter: { title: 'Empty' },
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('var total = 0');
  });

  it('uses fallback title "Presentation" when frontmatter title is empty', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: '' },
    });
    expect(html).toContain('<title>Presentation</title>');
  });

  it('escapes < > & " in the title attribute', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: '<bold> & "title"' },
    });
    expect(html).not.toContain('<title><bold>');
    expect(html).toContain('&lt;bold&gt;');
  });

  it('handles a single slide', () => {
    const html = exportToHtml({
      slides: [makeSlide(0)],
      frontmatter: { title: 'Solo' },
    });
    const slideMatches = html.match(/id="slide-\d+"/g) ?? [];
    expect(slideMatches.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getExportFilename
// ---------------------------------------------------------------------------

describe('getExportFilename', () => {
  it('converts a clean title to kebab-case with -presentation suffix', () => {
    expect(getExportFilename('My Amazing Talk')).toBe('my-amazing-talk-presentation.html');
  });

  it('returns "presentation.html" for an empty title', () => {
    expect(getExportFilename('')).toBe('presentation.html');
  });

  it('strips special characters from the title', () => {
    const name = getExportFilename('Talk: "Things & Stuff"!');
    expect(name).toMatch(/^[a-z0-9-]+-presentation\.html$/);
    expect(name).not.toContain('"');
    expect(name).not.toContain(':');
  });

  it('limits filename to 60 chars of title content plus suffix', () => {
    const longTitle = 'A'.repeat(80);
    const name = getExportFilename(longTitle);
    // 60 chars title + '-presentation.html' (18) = 78 total
    expect(name.length).toBeLessThanOrEqual(80);
  });

  it('collapses multiple spaces to single hyphens', () => {
    expect(getExportFilename('Hello   World')).toBe('hello-world-presentation.html');
  });

  it('handles all-special-character titles', () => {
    expect(getExportFilename('!@#$%^&*()')).toBe('presentation.html');
  });
});

// ---------------------------------------------------------------------------
// ExportOptions type checks (compile-time, via type annotation)
// ---------------------------------------------------------------------------

describe('ExportOptions type shape', () => {
  it('accepts minimal options (slides + frontmatter)', () => {
    const fm: PresentationFrontmatter = { title: 'T' };
    const opts: ExportOptions = { slides: [], frontmatter: fm };
    expect(() => exportToHtml(opts)).not.toThrow();
  });

  it('accepts all optional fields', () => {
    const opts: ExportOptions = {
      slides: [makeSlide(0)],
      frontmatter: { title: 'T', theme: 'dark', transition: 'fade' },
      themeId: 'neon',
      includeSpeakerNotes: false,
    };
    expect(() => exportToHtml(opts)).not.toThrow();
  });
});
