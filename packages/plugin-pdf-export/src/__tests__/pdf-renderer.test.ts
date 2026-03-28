/**
 * Tests for pdf-renderer.
 *
 * Covers: convertMarkdownToHtml, injectHeadingAnchors, injectPageBreaks,
 * substituteMathImages, substituteBase64Images, detectMath,
 * assembleHtmlDocument, renderToPdf, simpleHash.
 */

import { describe, it, expect } from 'vitest';
import {
  convertMarkdownToHtml,
  injectHeadingAnchors,
  injectPageBreaks,
  substituteMathImages,
  substituteBase64Images,
  detectMath,
  assembleHtmlDocument,
  renderToPdf,
  simpleHash,
} from '../pdf-renderer';
import { type TocEntry } from '../toc-generator';

// ---------------------------------------------------------------------------
// convertMarkdownToHtml
// ---------------------------------------------------------------------------

describe('convertMarkdownToHtml', () => {
  it('converts ATX headings', () => {
    const html = convertMarkdownToHtml('# H1\n## H2\n### H3');
    expect(html).toContain('<h1>H1</h1>');
    expect(html).toContain('<h2>H2</h2>');
    expect(html).toContain('<h3>H3</h3>');
  });

  it('converts bold text', () => {
    const html = convertMarkdownToHtml('**bold text**');
    expect(html).toContain('<strong>bold text</strong>');
  });

  it('converts italic text', () => {
    const html = convertMarkdownToHtml('*italic text*');
    expect(html).toContain('<em>italic text</em>');
  });

  it('converts inline code', () => {
    const html = convertMarkdownToHtml('Use `code` here');
    expect(html).toContain('<code>code</code>');
  });

  it('converts fenced code blocks', () => {
    const md = '```js\nconst x = 1;\n```';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('<pre><code class="language-js">');
    expect(html).toContain('const x = 1;');
  });

  it('does not treat headings inside fenced blocks as headings', () => {
    const md = '```\n# Not a heading\n```';
    const html = convertMarkdownToHtml(md);
    expect(html).not.toContain('<h1>');
    expect(html).toContain('# Not a heading');
  });

  it('converts unordered lists', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li>Item 1</li>');
    expect(html).toContain('<li>Item 3</li>');
    expect(html).toContain('</ul>');
  });

  it('converts ordered lists', () => {
    const md = '1. First\n2. Second';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('<ol>');
    expect(html).toContain('<li>First</li>');
    expect(html).toContain('</ol>');
  });

  it('converts task list items', () => {
    const md = '- [x] Done\n- [ ] Todo';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('type="checkbox" checked');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('class="task-list-item"');
  });

  it('converts blockquotes', () => {
    const md = '> Quoted text';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('<blockquote>');
    expect(html).toContain('Quoted text');
    expect(html).toContain('</blockquote>');
  });

  it('converts horizontal rules', () => {
    const html = convertMarkdownToHtml('---');
    expect(html).toContain('<hr>');
  });

  it('converts links', () => {
    const html = convertMarkdownToHtml('[Click here](https://example.com)');
    expect(html).toContain('<a href="https://example.com">Click here</a>');
  });

  it('converts images', () => {
    const html = convertMarkdownToHtml('![Alt text](image.png)');
    expect(html).toContain('<img alt="Alt text" src="image.png">');
  });

  it('converts strikethrough', () => {
    const html = convertMarkdownToHtml('~~deleted~~');
    expect(html).toContain('<del>deleted</del>');
  });

  it('wraps plain text in paragraph tags', () => {
    const html = convertMarkdownToHtml('Hello world');
    expect(html).toContain('<p>');
    expect(html).toContain('Hello world');
  });

  it('handles math blocks', () => {
    const md = '$$\nE = mc^2\n$$';
    const html = convertMarkdownToHtml(md);
    expect(html).toContain('class="math-block"');
    expect(html).toContain('data-math=');
    expect(html).toContain('E = mc^2');
  });

  it('escapes HTML entities in code blocks', () => {
    const md = '```\n<script>alert(1)</script>\n```';
    const html = convertMarkdownToHtml(md);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

// ---------------------------------------------------------------------------
// injectHeadingAnchors
// ---------------------------------------------------------------------------

describe('injectHeadingAnchors', () => {
  it('injects id attributes into heading tags', () => {
    const html = '<h1>Title</h1><h2>Section</h2>';
    const toc: TocEntry[] = [
      {
        level: 1,
        text: 'Title',
        id: 'title',
        children: [{ level: 2, text: 'Section', id: 'section', children: [] }],
      },
    ];
    const result = injectHeadingAnchors(html, toc);
    expect(result).toContain('id="title"');
    expect(result).toContain('id="section"');
  });

  it('does not overwrite existing id attributes', () => {
    const html = '<h1 id="existing-id">Title</h1>';
    const toc: TocEntry[] = [{ level: 1, text: 'Title', id: 'title', children: [] }];
    const result = injectHeadingAnchors(html, toc);
    expect(result).toContain('id="existing-id"');
    expect(result).not.toContain('id="title"');
  });

  it('handles empty TOC gracefully', () => {
    const html = '<h1>Title</h1>';
    const result = injectHeadingAnchors(html, []);
    // Should still inject a generated id
    expect(result).toContain('id=');
  });
});

// ---------------------------------------------------------------------------
// injectPageBreaks
// ---------------------------------------------------------------------------

describe('injectPageBreaks', () => {
  it('adds page-break-before class to h2 elements', () => {
    const html = '<h2>Section</h2>';
    const result = injectPageBreaks(html);
    expect(result).toContain('class="page-break-before"');
  });

  it('does not affect h1 or h3 elements', () => {
    const html = '<h1>Title</h1><h3>Sub</h3>';
    const result = injectPageBreaks(html);
    expect(result).toBe(html);
  });

  it('preserves existing attributes on h2', () => {
    const html = '<h2 id="section">Section</h2>';
    const result = injectPageBreaks(html);
    expect(result).toContain('id="section"');
    expect(result).toContain('class="page-break-before"');
  });

  it('handles multiple h2 elements', () => {
    const html = '<h2>A</h2><h2>B</h2>';
    const result = injectPageBreaks(html);
    const count = (result.match(/page-break-before/g) || []).length;
    expect(count).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// substituteMathImages
// ---------------------------------------------------------------------------

describe('substituteMathImages', () => {
  it('returns html unchanged when mathImages is empty', () => {
    const html = '<div class="math-block" data-math="E=mc2">E=mc2</div>';
    expect(substituteMathImages(html, {})).toBe(html);
  });

  it('replaces math block with img when key matches', () => {
    const content = 'E = mc^2';
    // Use the simpleHash function that was already imported at the top of the file
    const key = simpleHash(content);
    const html = `<div class="math-block" data-math="${content}">${content}</div>`;
    const result = substituteMathImages(html, { [key]: 'data:image/png;base64,abc123' });
    expect(result).toContain('<img class="math-image"');
    expect(result).toContain('data:image/png;base64,abc123');
  });

  it('leaves unmatched math blocks unchanged', () => {
    const html = '<div class="math-block" data-math="x+y">x+y</div>';
    const result = substituteMathImages(html, { 'nonexistent-key': 'data:...' });
    expect(result).toBe(html);
  });
});

// ---------------------------------------------------------------------------
// substituteBase64Images
// ---------------------------------------------------------------------------

describe('substituteBase64Images', () => {
  it('returns html unchanged when base64Images is empty', () => {
    const html = '<img src="image.png">';
    expect(substituteBase64Images(html, {})).toBe(html);
  });

  it('replaces matching src attributes', () => {
    const html = '<img src="image.png">';
    const result = substituteBase64Images(html, { 'image.png': 'data:image/png;base64,xyz' });
    expect(result).toContain('src="data:image/png;base64,xyz"');
    expect(result).not.toContain('src="image.png"');
  });

  it('only replaces matching src values', () => {
    const html = '<img src="a.png"><img src="b.png">';
    const result = substituteBase64Images(html, { 'a.png': 'data:image/png;base64,AAA' });
    expect(result).toContain('src="data:image/png;base64,AAA"');
    expect(result).toContain('src="b.png"');
  });
});

// ---------------------------------------------------------------------------
// detectMath
// ---------------------------------------------------------------------------

describe('detectMath', () => {
  it('returns false for html without math', () => {
    expect(detectMath('<p>Hello</p>')).toBe(false);
  });

  it('returns true when data-math attribute is present', () => {
    expect(detectMath('<div data-math="x+y">x+y</div>')).toBe(true);
  });

  it('returns true for math-block class', () => {
    expect(detectMath('<div class="math-block">...</div>')).toBe(true);
  });

  it('returns true for math-inline class', () => {
    expect(detectMath('<span class="math-inline">x</span>')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// assembleHtmlDocument
// ---------------------------------------------------------------------------

describe('assembleHtmlDocument', () => {
  it('produces a valid HTML5 document', () => {
    const result = assembleHtmlDocument({
      title: 'My Note',
      bodyHtml: '<p>Hello</p>',
      css: 'body { color: red; }',
    });
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html lang="en">');
    expect(result).toContain('<head>');
    expect(result).toContain('<title>My Note</title>');
    expect(result).toContain('body { color: red; }');
    expect(result).toContain('<body>');
    expect(result).toContain('<p>Hello</p>');
  });

  it('escapes HTML in the title', () => {
    const result = assembleHtmlDocument({
      title: '<script>',
      bodyHtml: '',
      css: '',
    });
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });
});

// ---------------------------------------------------------------------------
// renderToPdf
// ---------------------------------------------------------------------------

describe('renderToPdf', () => {
  it('returns a full HTML document', () => {
    const result = renderToPdf({ markdown: '# Hello\n\nWorld' });
    expect(result.html).toContain('<!DOCTYPE html>');
    expect(result.html).toContain('<body>');
  });

  it('includes the note title as h1', () => {
    const result = renderToPdf({ markdown: '## Section', title: 'My Note' });
    expect(result.html).toContain('My Note');
  });

  it('includes TOC when includeToc is true', () => {
    const md = '# Title\n## Section A\n## Section B';
    const result = renderToPdf({ markdown: md, includeToc: true });
    expect(result.html).toContain('class="pdf-toc"');
    expect(result.toc.length).toBeGreaterThan(0);
  });

  it('does not include TOC when includeToc is false', () => {
    const md = '# Title\n## Section';
    const result = renderToPdf({ markdown: md, includeToc: false });
    expect(result.html).not.toContain('class="pdf-toc"');
    expect(result.toc).toHaveLength(0);
  });

  it('detects math and sets hasMath to true', () => {
    const md = '$$\nE=mc^2\n$$';
    const result = renderToPdf({ markdown: md });
    expect(result.hasMath).toBe(true);
  });

  it('sets hasMath to false for non-math content', () => {
    const result = renderToPdf({ markdown: '# Normal note\n\nJust text.' });
    expect(result.hasMath).toBe(false);
  });

  it('uses pre-rendered HTML when provided', () => {
    const html = '<p>Pre-rendered content</p>';
    const result = renderToPdf({ html });
    expect(result.html).toContain('Pre-rendered content');
  });

  it('injects page breaks before h2 by default', () => {
    const md = '# Title\n## Section A\n## Section B';
    const result = renderToPdf({ markdown: md, pageBreakBeforeH2: true });
    expect(result.html).toContain('page-break-before');
  });

  it('does not inject page breaks when pageBreakBeforeH2 is false', () => {
    const md = '## Section A';
    const result = renderToPdf({ markdown: md, pageBreakBeforeH2: false });
    // The class should not be in the h2 attribute (it may appear in CSS)
    expect(result.html).not.toMatch(/<h2[^>]*class="page-break-before"/);
  });

  it('applies custom CSS', () => {
    const result = renderToPdf({ markdown: '# Test', customCSS: 'body { background: pink; }' });
    expect(result.html).toContain('background: pink');
  });

  it('accepts pageSize option', () => {
    const result = renderToPdf({ markdown: '# Test', pageSize: 'Letter' });
    expect(result.html).toContain('@page');
  });

  it('returns empty toc for empty markdown', () => {
    const result = renderToPdf({ markdown: '', includeToc: true });
    expect(result.toc).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// simpleHash
// ---------------------------------------------------------------------------

describe('simpleHash', () => {
  it('returns a non-empty string', () => {
    expect(simpleHash('hello')).toBeTruthy();
  });

  it('returns the same value for the same input', () => {
    expect(simpleHash('test string')).toBe(simpleHash('test string'));
  });

  it('returns different values for different inputs', () => {
    expect(simpleHash('hello')).not.toBe(simpleHash('world'));
  });

  it('handles empty string', () => {
    expect(simpleHash('')).toBe('0');
  });
});
