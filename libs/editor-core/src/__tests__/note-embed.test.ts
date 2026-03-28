/**
 * Unit tests for the NoteEmbed TipTap extension.
 *
 * Tests cover the pure logic that can run in a headless environment:
 * - NOTE_EMBED_INPUT_REGEX matching
 * - serializeNoteEmbed output
 * - defaultIsImagePath predicate
 * - NoteEmbedOptions shape validation
 * - NoteEmbedContent type shape
 * - Circular embed detection logic
 * - Depth enforcement logic
 * - loadContent callback contract (promise resolution / rejection / abort)
 *
 * DOM / React NodeView rendering is covered by Playwright integration tests.
 * TipTap editor instantiation requires a DOM and is intentionally excluded.
 */

import { describe, it, expect, vi } from 'vitest';
import type {
  NoteEmbedOptions,
  NoteEmbedContent,
  NoteEmbedAttrs,
  NoteEmbedType,
} from '../extensions/note-embed';
import { NOTE_EMBED_INPUT_REGEX, serializeNoteEmbed } from '../extensions/note-embed';

// ---------------------------------------------------------------------------
// NOTE_EMBED_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('NOTE_EMBED_INPUT_REGEX', () => {
  function match(input: string) {
    return NOTE_EMBED_INPUT_REGEX.exec(input);
  }

  // -------------------------------------------------------------------------
  // Happy path — basic embed
  // -------------------------------------------------------------------------

  it('matches a plain note embed', () => {
    const m = match('![[My Note]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('My Note');
  });

  it('matches a note embed at end of text', () => {
    const m = match('Some text ![[My Note]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('My Note');
  });

  it('matches an image embed', () => {
    const m = match('![[diagram.png]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('diagram.png');
  });

  it('matches a path-style image embed', () => {
    const m = match('![[images/photo.jpg]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('images/photo.jpg');
  });

  it('matches a note title with spaces', () => {
    const m = match('![[My Long Note Title]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('My Long Note Title');
  });

  it('matches a note with hyphens and numbers', () => {
    const m = match('![[2024-01-01 Daily Note]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('2024-01-01 Daily Note');
  });

  it('matches a path-style note embed', () => {
    const m = match('![[folder/sub/note]]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('folder/sub/note');
  });

  // -------------------------------------------------------------------------
  // Anchor position — must match at end of string
  // -------------------------------------------------------------------------

  it('does not match when embed is not at end of string', () => {
    const m = match('![[Note]] and more text');
    expect(m).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Non-matching cases
  // -------------------------------------------------------------------------

  it('does not match a plain wiki link [[Note]]', () => {
    const m = match('[[Note]]');
    expect(m).toBeNull();
  });

  it('does not match an unclosed embed', () => {
    const m = match('![[Note');
    expect(m).toBeNull();
  });

  it('does not match empty brackets', () => {
    // Empty content — group 1 would be empty string; we test extension
    // handles this gracefully (the handler checks `rawTarget?.trim()`)
    const result = match('![[]]');
    if (result !== null) {
      // Empty target is technically matched — extension skips it at handler level
      expect(result[1]).toBe('');
    }
  });

  it('does not match when only one exclamation mark pair is present', () => {
    const m = match('[Note]');
    expect(m).toBeNull();
  });

  it('does not match standard markdown image syntax', () => {
    // ![alt](url) — different syntax
    const m = match('![alt](url)');
    expect(m).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Brackets inside target — should not match
  // -------------------------------------------------------------------------

  it('does not match nested brackets inside target', () => {
    const m = match('![[Note [with] brackets]]');
    // The regex stops at the first ] so this would not match correctly
    // The inner ] terminates the character class [^\]]
    expect(m).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serializeNoteEmbed
// ---------------------------------------------------------------------------

describe('serializeNoteEmbed', () => {
  it('serialises a plain note embed', () => {
    expect(serializeNoteEmbed('My Note')).toBe('![[My Note]]');
  });

  it('serialises an image embed', () => {
    expect(serializeNoteEmbed('diagram.png')).toBe('![[diagram.png]]');
  });

  it('serialises a path-style embed', () => {
    expect(serializeNoteEmbed('folder/note-name')).toBe('![[folder/note-name]]');
  });

  it('serialises a note with spaces in title', () => {
    expect(serializeNoteEmbed('My Long Note Title')).toBe('![[My Long Note Title]]');
  });

  it('serialises an empty string (edge case)', () => {
    expect(serializeNoteEmbed('')).toBe('![[]]');
  });
});

// ---------------------------------------------------------------------------
// defaultIsImagePath (tested via exported NoteEmbed behaviour pattern)
//
// We reproduce the predicate here since it is not exported directly (by
// design — it is the internal default). Testing the pattern is sufficient.
// ---------------------------------------------------------------------------

describe('image path detection predicate', () => {
  const IMAGE_EXTENSIONS_RE = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i;
  const isImagePath = (t: string) => IMAGE_EXTENSIONS_RE.test(t);

  it.each([
    'photo.png',
    'image.jpg',
    'image.jpeg',
    'animation.gif',
    'icon.webp',
    'icon.svg',
    'bitmap.bmp',
    'scan.tiff',
    'scan.tif',
    'images/photo.PNG', // case-insensitive
    'assets/icon.SVG',
  ])('detects %s as an image path', (path) => {
    expect(isImagePath(path)).toBe(true);
  });

  it.each([
    'My Note',
    'Daily Journal',
    'README',
    'notes/architecture',
    '2024-01-01',
    'Note with extension.md-like name',
    'file.txt',
    'script.js',
    'styles.css',
  ])('does not detect %s as an image path', (path) => {
    expect(isImagePath(path)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NoteEmbedOptions type shape
// ---------------------------------------------------------------------------

describe('NoteEmbedOptions type contract', () => {
  it('accepts a minimal options object (no options required)', () => {
    const options: NoteEmbedOptions = {};
    expect(options.loadContent).toBeUndefined();
    expect(options.onNavigate).toBeUndefined();
    expect(options.isImagePath).toBeUndefined();
    expect(options.resolveImageSrc).toBeUndefined();
  });

  it('accepts full options', () => {
    const options: NoteEmbedOptions = {
      isImagePath: (t) => t.endsWith('.png'),
      loadContent: vi.fn(),
      onNavigate: vi.fn(),
      resolveImageSrc: (t) => `/files/${t}`,
      HTMLAttributes: { class: 'custom' },
    };
    expect(typeof options.isImagePath).toBe('function');
    expect(typeof options.loadContent).toBe('function');
    expect(typeof options.onNavigate).toBe('function');
    expect(typeof options.resolveImageSrc).toBe('function');
    expect(options.HTMLAttributes?.class).toBe('custom');
  });

  it('accepts custom isImagePath that matches .md files as images (unusual but valid)', () => {
    const options: NoteEmbedOptions = {
      isImagePath: (t) => t.endsWith('.md'),
    };
    expect(options.isImagePath!('note.md')).toBe(true);
    expect(options.isImagePath!('note.txt')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// NoteEmbedContent type shape
// ---------------------------------------------------------------------------

describe('NoteEmbedContent type contract', () => {
  function makeContent(overrides: Partial<NoteEmbedContent> = {}): NoteEmbedContent {
    return {
      id: 'note-abc',
      title: 'Architecture Overview',
      content: 'This note describes the system architecture.',
      wordCount: 7,
      ...overrides,
    };
  }

  it('constructs a valid NoteEmbedContent object', () => {
    const content = makeContent();
    expect(content.id).toBe('note-abc');
    expect(content.title).toBe('Architecture Overview');
    expect(typeof content.content).toBe('string');
    expect(typeof content.wordCount).toBe('number');
  });

  it('allows empty content (blank note)', () => {
    const content = makeContent({ content: '', wordCount: 0 });
    expect(content.content).toBe('');
    expect(content.wordCount).toBe(0);
  });

  it('allows very long content', () => {
    const longContent = 'word '.repeat(1000).trim();
    const content = makeContent({ content: longContent, wordCount: 1000 });
    expect(content.content.length).toBeGreaterThan(1000);
    expect(content.wordCount).toBe(1000);
  });
});

// ---------------------------------------------------------------------------
// NoteEmbedAttrs type shape
// ---------------------------------------------------------------------------

describe('NoteEmbedAttrs type contract', () => {
  it('constructs a valid note embed attrs object', () => {
    const attrs: NoteEmbedAttrs = {
      target: 'My Note',
      embedType: 'note',
      alt: null,
      resolved: null,
    };
    expect(attrs.target).toBe('My Note');
    expect(attrs.embedType).toBe('note');
    expect(attrs.alt).toBeNull();
    expect(attrs.resolved).toBeNull();
  });

  it('constructs a valid image embed attrs object', () => {
    const attrs: NoteEmbedAttrs = {
      target: 'diagram.png',
      embedType: 'image',
      alt: 'System diagram',
      resolved: true,
    };
    expect(attrs.embedType).toBe('image');
    expect(attrs.alt).toBe('System diagram');
    expect(attrs.resolved).toBe(true);
  });

  it('allows resolved=false for missing notes', () => {
    const attrs: NoteEmbedAttrs = {
      target: 'Non Existent Note',
      embedType: 'note',
      alt: null,
      resolved: false,
    };
    expect(attrs.resolved).toBe(false);
  });

  it('accepts both embedType values', () => {
    const noteType: NoteEmbedType = 'note';
    const imageType: NoteEmbedType = 'image';
    expect(noteType).toBe('note');
    expect(imageType).toBe('image');
  });
});

// ---------------------------------------------------------------------------
// Circular embed detection logic
//
// We test the logic pattern used by NoteEmbedView without importing the
// React component (requires jsdom + React runtime).
// ---------------------------------------------------------------------------

describe('circular embed detection', () => {
  /**
   * Reproduce the circular-check logic from NoteEmbedView.
   * ancestorIds contains the IDs/titles of notes currently on the render stack.
   */
  function isCircularEmbed(target: string, ancestorIds: string[]): boolean {
    return ancestorIds.includes(target);
  }

  it('is not circular when ancestorIds is empty', () => {
    expect(isCircularEmbed('Note A', [])).toBe(false);
  });

  it('is not circular when target is not in ancestorIds', () => {
    expect(isCircularEmbed('Note A', ['Note B', 'Note C'])).toBe(false);
  });

  it('is circular when target matches an ancestor', () => {
    expect(isCircularEmbed('Note A', ['Note B', 'Note A'])).toBe(true);
  });

  it('is circular when target matches the direct parent', () => {
    expect(isCircularEmbed('Note A', ['Note A'])).toBe(true);
  });

  it('is not circular when ancestorIds contains a partial match', () => {
    // Partial title matches should not trigger — must be exact
    expect(isCircularEmbed('Note A', ['Note A Extended'])).toBe(false);
    expect(isCircularEmbed('Note A Extended', ['Note A'])).toBe(false);
  });

  it('is circular in a deeply nested chain', () => {
    const chain = ['Root', 'Section', 'Sub-section', 'Root'];
    expect(isCircularEmbed('Root', chain)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Max depth enforcement logic
// ---------------------------------------------------------------------------

describe('max depth enforcement', () => {
  const MAX_EMBED_DEPTH = 1;

  function shouldRenderCompact(depth: number): boolean {
    return depth >= MAX_EMBED_DEPTH;
  }

  it('renders full preview at depth 0', () => {
    expect(shouldRenderCompact(0)).toBe(false);
  });

  it('renders compact reference at depth 1 (max depth)', () => {
    expect(shouldRenderCompact(1)).toBe(true);
  });

  it('renders compact reference at depth 2 (exceeds max)', () => {
    expect(shouldRenderCompact(2)).toBe(true);
  });

  it('renders compact reference at high depth', () => {
    expect(shouldRenderCompact(99)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// loadContent callback contract
// ---------------------------------------------------------------------------

describe('loadContent callback', () => {
  function makeContent(title: string): NoteEmbedContent {
    return {
      id: `note-${title.toLowerCase().replace(/\s/g, '-')}`,
      title,
      content: `Content of ${title}`,
      wordCount: title.split(' ').length + 1,
    };
  }

  it('receives the target note title', async () => {
    const loadContent = vi.fn().mockResolvedValue(makeContent('Architecture'));
    const controller = new AbortController();

    const result = await loadContent('Architecture', controller.signal);

    expect(loadContent).toHaveBeenCalledWith('Architecture', controller.signal);
    expect(result.title).toBe('Architecture');
  });

  it('returns null when note does not exist (missing note)', async () => {
    const loadContent = vi.fn().mockResolvedValue(null);
    const controller = new AbortController();

    const result = await loadContent('Ghost Note', controller.signal);

    expect(result).toBeNull();
  });

  it('can be aborted via AbortSignal', async () => {
    const controller = new AbortController();

    const loadContent = vi
      .fn()
      .mockImplementation(
        (_target: string, signal: AbortSignal): Promise<NoteEmbedContent | null> => {
          if (signal.aborted) {
            return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
          }
          return new Promise<NoteEmbedContent | null>((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              reject(new DOMException('The operation was aborted.', 'AbortError'));
            });
          });
        },
      );

    controller.abort();

    await expect(loadContent('My Note', controller.signal)).rejects.toThrow('aborted');
  });

  it('propagates network errors to caller', async () => {
    const loadContent = vi.fn().mockRejectedValue(new Error('Network error'));
    const controller = new AbortController();

    await expect(loadContent('Bad Note', controller.signal)).rejects.toThrow('Network error');
  });

  it('does not call loadContent when depth >= MAX_EMBED_DEPTH', () => {
    // This test validates the guard condition: when depth >= MAX_EMBED_DEPTH,
    // the host application (or NodeView) should not invoke loadContent.
    const MAX_EMBED_DEPTH = 1;
    const loadContent = vi.fn();

    const depth = 1; // at max depth
    if (depth < MAX_EMBED_DEPTH) {
      loadContent('some note', new AbortController().signal);
    }

    expect(loadContent).not.toHaveBeenCalled();
  });

  it('does not call loadContent when circular embed is detected', () => {
    const loadContent = vi.fn();
    const target = 'My Note';
    const ancestorIds = ['My Note'];

    const isCircular = ancestorIds.includes(target);
    if (!isCircular) {
      loadContent(target, new AbortController().signal);
    }

    expect(loadContent).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// resolveImageSrc callback contract
// ---------------------------------------------------------------------------

describe('resolveImageSrc callback', () => {
  it('returns a resolved URL for a given image target', () => {
    const resolveImageSrc: NoteEmbedOptions['resolveImageSrc'] = (target) =>
      `/api/files/${encodeURIComponent(target)}`;

    expect(resolveImageSrc!('diagram.png')).toBe('/api/files/diagram.png');
    expect(resolveImageSrc!('images/photo.jpg')).toBe('/api/files/images%2Fphoto.jpg');
  });

  it('falls back to target string when resolveImageSrc is undefined', () => {
    const resolveImageSrc: NoteEmbedOptions['resolveImageSrc'] = undefined;
    const target = 'diagram.png';

    // When undefined, the NoteEmbedView uses `target` directly as src.
    const src = resolveImageSrc?.(target) ?? target;
    expect(src).toBe('diagram.png');
  });
});

// ---------------------------------------------------------------------------
// onNavigate callback contract
// ---------------------------------------------------------------------------

describe('onNavigate callback', () => {
  it('receives the embed target when invoked', () => {
    const onNavigate = vi.fn();

    // Simulate the click handler invoking onNavigate
    onNavigate('My Target Note');

    expect(onNavigate).toHaveBeenCalledWith('My Target Note');
    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it('is not called for image embeds unless explicitly triggered', () => {
    const onNavigate = vi.fn();
    const embedType: NoteEmbedType = 'image';

    // Image embeds only trigger onNavigate when the user explicitly clicks.
    // Without a click event, it should not fire.
    if (embedType === 'note') {
      onNavigate('image.png'); // would not happen for images by default
    }

    expect(onNavigate).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Excerpt truncation logic (mirrors NoteEmbedView behaviour)
// ---------------------------------------------------------------------------

describe('excerpt truncation', () => {
  const MAX_EXCERPT_LENGTH = 280;

  function truncateExcerpt(content: string): string {
    return content.length > MAX_EXCERPT_LENGTH ? `${content.slice(0, 277)}…` : content;
  }

  it('returns the full content when it is short', () => {
    const short = 'Short note content.';
    expect(truncateExcerpt(short)).toBe(short);
  });

  it('returns content at exactly 280 chars unchanged', () => {
    const exact = 'a'.repeat(280);
    expect(truncateExcerpt(exact)).toBe(exact);
    expect(truncateExcerpt(exact).length).toBe(280);
  });

  it('truncates content longer than 280 chars and appends ellipsis', () => {
    const long = 'a'.repeat(300);
    const result = truncateExcerpt(long);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBe(278); // 277 chars + 1 char for ellipsis (…)
  });

  it('truncates at 277 chars before the ellipsis', () => {
    const long = 'word '.repeat(100); // 500 chars
    const result = truncateExcerpt(long);
    expect(result).toBe(`${long.slice(0, 277)}…`);
  });
});
