/**
 * Tests for toc-generator.
 *
 * Covers: slugify, fromMarkdown, fromHtml, renderTocHtml, flattenToc,
 * heading deduplication, nesting, code block exclusion.
 */

import { describe, it, expect } from 'vitest';
import {
  slugify,
  fromMarkdown,
  fromHtml,
  renderTocHtml,
  flattenToc,
  type TocEntry,
} from '../toc-generator';

// ---------------------------------------------------------------------------
// slugify
// ---------------------------------------------------------------------------

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('hello world')).toBe('hello-world');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('collapses multiple hyphens', () => {
    expect(slugify('hello---world')).toBe('hello-world');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello-  ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles numeric text', () => {
    expect(slugify('Section 1.2')).toBe('section-12');
  });

  it('preserves underscores as word separators', () => {
    expect(slugify('hello_world')).toBe('hello-world');
  });

  it('handles unicode by removing non-word chars', () => {
    expect(slugify('héllo')).toBe('hllo');
  });
});

// ---------------------------------------------------------------------------
// fromMarkdown
// ---------------------------------------------------------------------------

describe('fromMarkdown', () => {
  it('returns empty array for content with no headings', () => {
    expect(fromMarkdown('Just a paragraph.')).toHaveLength(0);
  });

  it('extracts a single h1', () => {
    const entries = fromMarkdown('# Hello World\n\nParagraph.');
    expect(entries).toHaveLength(1);
    expect(entries[0].level).toBe(1);
    expect(entries[0].text).toBe('Hello World');
    expect(entries[0].id).toBe('hello-world');
  });

  it('extracts h1–h3 with nesting', () => {
    const md = `
# Title
## Section A
### Sub-section
## Section B
`;
    const toc = fromMarkdown(md);
    expect(toc).toHaveLength(1); // Root: Title
    expect(toc[0].text).toBe('Title');
    expect(toc[0].children).toHaveLength(2); // Section A, Section B

    const sectionA = toc[0].children[0];
    expect(sectionA.text).toBe('Section A');
    expect(sectionA.children).toHaveLength(1);
    expect(sectionA.children[0].text).toBe('Sub-section');
  });

  it('skips headings inside fenced code blocks', () => {
    const md = `
# Real Heading

\`\`\`
# Not a heading
## Also not
\`\`\`

## Real H2
`;
    const flat = flattenToc(fromMarkdown(md));
    expect(flat.map((e) => e.text)).toEqual(['Real Heading', 'Real H2']);
  });

  it('strips markdown formatting from heading text', () => {
    const md = '## **Bold** and _italic_ heading';
    const toc = fromMarkdown(md);
    expect(toc[0].text).toBe('Bold and italic heading');
  });

  it('strips inline code from heading text', () => {
    const md = '## `code` heading';
    const toc = fromMarkdown(md);
    expect(toc[0].text).toBe('code heading');
  });

  it('deduplicates slugs for identical headings', () => {
    const md = `
## Same Title
## Same Title
## Same Title
`;
    const flat = flattenToc(fromMarkdown(md));
    expect(flat[0].id).toBe('same-title');
    expect(flat[1].id).toBe('same-title-1');
    expect(flat[2].id).toBe('same-title-2');
  });

  it('handles all heading levels h1–h6', () => {
    const md = `# H1\n## H2\n### H3\n#### H4\n##### H5\n###### H6`;
    const flat = flattenToc(fromMarkdown(md));
    expect(flat.map((e) => e.level)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('handles tilde fenced code blocks', () => {
    const md = `
# Title

~~~
# Inside tilde fence
~~~

## After
`;
    const flat = flattenToc(fromMarkdown(md));
    expect(flat.map((e) => e.text)).toEqual(['Title', 'After']);
  });

  it('returns empty array for whitespace-only content', () => {
    expect(fromMarkdown('   \n\n\t  ')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// fromHtml
// ---------------------------------------------------------------------------

describe('fromHtml', () => {
  it('extracts h1–h3 from HTML', () => {
    const html = `
      <h1>Title</h1>
      <p>Content</p>
      <h2>Section</h2>
      <h3>Sub</h3>
    `;
    const flat = flattenToc(fromHtml(html));
    expect(flat).toHaveLength(3);
    expect(flat[0].text).toBe('Title');
    expect(flat[1].text).toBe('Section');
    expect(flat[2].text).toBe('Sub');
  });

  it('preserves existing id attributes', () => {
    const html = '<h2 id="my-section">My Section</h2>';
    const flat = flattenToc(fromHtml(html));
    expect(flat[0].id).toBe('my-section');
  });

  it('generates id from text when no id attribute present', () => {
    const html = '<h2>Generated ID</h2>';
    const flat = flattenToc(fromHtml(html));
    expect(flat[0].id).toBe('generated-id');
  });

  it('strips HTML tags from heading text', () => {
    const html = '<h2><strong>Bold</strong> Heading</h2>';
    const flat = flattenToc(fromHtml(html));
    expect(flat[0].text).toBe('Bold Heading');
  });

  it('returns empty array for HTML with no headings', () => {
    expect(fromHtml('<p>No headings</p>')).toHaveLength(0);
  });

  it('builds nested tree from HTML headings', () => {
    const html = '<h1>Root</h1><h2>Child A</h2><h2>Child B</h2>';
    const toc = fromHtml(html);
    expect(toc).toHaveLength(1);
    expect(toc[0].children).toHaveLength(2);
  });

  it('deduplicates slugs for identical HTML headings', () => {
    const html = '<h2>Duplicate</h2><h2>Duplicate</h2>';
    const flat = flattenToc(fromHtml(html));
    expect(flat[0].id).toBe('duplicate');
    expect(flat[1].id).toBe('duplicate-1');
  });
});

// ---------------------------------------------------------------------------
// flattenToc
// ---------------------------------------------------------------------------

describe('flattenToc', () => {
  it('flattens a nested tree depth-first', () => {
    const toc: TocEntry[] = [
      {
        level: 1,
        text: 'Root',
        id: 'root',
        children: [
          { level: 2, text: 'Child A', id: 'child-a', children: [] },
          {
            level: 2,
            text: 'Child B',
            id: 'child-b',
            children: [{ level: 3, text: 'Grandchild', id: 'grandchild', children: [] }],
          },
        ],
      },
    ];

    const flat = flattenToc(toc);
    expect(flat.map((e) => e.id)).toEqual(['root', 'child-a', 'child-b', 'grandchild']);
  });

  it('returns empty array for empty input', () => {
    expect(flattenToc([])).toHaveLength(0);
  });

  it('handles single-level list', () => {
    const toc: TocEntry[] = [
      { level: 2, text: 'A', id: 'a', children: [] },
      { level: 2, text: 'B', id: 'b', children: [] },
    ];
    expect(flattenToc(toc).map((e) => e.id)).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
// renderTocHtml
// ---------------------------------------------------------------------------

describe('renderTocHtml', () => {
  it('returns empty string for empty entries', () => {
    expect(renderTocHtml([])).toBe('');
  });

  it('generates a nav element with the default title', () => {
    const entries: TocEntry[] = [{ level: 1, text: 'Intro', id: 'intro', children: [] }];
    const html = renderTocHtml(entries);
    expect(html).toContain('<nav class="pdf-toc">');
    expect(html).toContain('Table of Contents');
    expect(html).toContain('href="#intro"');
    expect(html).toContain('Intro');
  });

  it('uses custom title', () => {
    const entries: TocEntry[] = [{ level: 1, text: 'A', id: 'a', children: [] }];
    const html = renderTocHtml(entries, 'Contents');
    expect(html).toContain('Contents');
  });

  it('respects maxDepth', () => {
    const entries: TocEntry[] = [
      {
        level: 1,
        text: 'H1',
        id: 'h1',
        children: [
          {
            level: 2,
            text: 'H2',
            id: 'h2',
            children: [{ level: 3, text: 'H3', id: 'h3', children: [] }],
          },
        ],
      },
    ];
    // maxDepth=2: H3 should not appear
    const html = renderTocHtml(entries, 'TOC', 2);
    expect(html).toContain('H1');
    expect(html).toContain('H2');
    expect(html).not.toContain('H3');
  });

  it('escapes HTML in heading text', () => {
    const entries: TocEntry[] = [
      { level: 1, text: '<script>alert(1)</script>', id: 'script', children: [] },
    ];
    const html = renderTocHtml(entries);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('applies level-based CSS classes', () => {
    const entries: TocEntry[] = [
      {
        level: 1,
        text: 'Root',
        id: 'root',
        children: [{ level: 2, text: 'Child', id: 'child', children: [] }],
      },
    ];
    const html = renderTocHtml(entries);
    expect(html).toContain('pdf-toc-level-1');
    expect(html).toContain('pdf-toc-level-2');
  });
});
