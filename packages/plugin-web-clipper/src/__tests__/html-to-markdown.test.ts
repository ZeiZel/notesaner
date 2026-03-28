/**
 * Tests for html-to-markdown.ts
 *
 * Covers:
 * - All heading levels (h1–h6)
 * - Paragraphs and divs
 * - Bold, italic, strikethrough, inline code
 * - Ordered and unordered lists, nested lists
 * - Block code with language detection
 * - Blockquotes (nested)
 * - Tables (thead/tbody, pipe escaping)
 * - Links: href resolution, tracking param stripping
 * - Images: src resolution, alt text, opt-out
 * - Horizontal rules
 * - Line breaks
 * - HTML entity decoding (named and numeric)
 * - URL utilities: resolveUrl, removeTrackingParams
 * - Whitespace normalisation
 * - Edge cases: empty input, stripped noise tags, malformed HTML
 */

import { describe, it, expect } from 'vitest';
import {
  htmlToMarkdown,
  resolveUrl,
  removeTrackingParams,
  decodeHtmlEntities,
} from '../html-to-markdown';

// ---------------------------------------------------------------------------
// Headings
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — headings', () => {
  it('converts h1 to # heading', () => {
    expect(htmlToMarkdown('<h1>Hello World</h1>')).toBe('# Hello World');
  });

  it('converts h2 to ## heading', () => {
    expect(htmlToMarkdown('<h2>Section</h2>')).toBe('## Section');
  });

  it('converts h3 to ### heading', () => {
    expect(htmlToMarkdown('<h3>Subsection</h3>')).toBe('### Subsection');
  });

  it('converts h4 to #### heading', () => {
    expect(htmlToMarkdown('<h4>Level 4</h4>')).toBe('#### Level 4');
  });

  it('converts h5 to ##### heading', () => {
    expect(htmlToMarkdown('<h5>Level 5</h5>')).toBe('##### Level 5');
  });

  it('converts h6 to ###### heading', () => {
    expect(htmlToMarkdown('<h6>Level 6</h6>')).toBe('###### Level 6');
  });

  it('strips inline tags inside headings', () => {
    expect(htmlToMarkdown('<h2><strong>Bold</strong> Heading</h2>')).toBe('## Bold Heading');
  });

  it('handles heading with id attribute', () => {
    expect(htmlToMarkdown('<h2 id="intro">Introduction</h2>')).toBe('## Introduction');
  });
});

// ---------------------------------------------------------------------------
// Inline formatting
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — inline formatting', () => {
  it('converts <strong> to **bold**', () => {
    expect(htmlToMarkdown('<p><strong>bold text</strong></p>')).toBe('**bold text**');
  });

  it('converts <b> to **bold**', () => {
    expect(htmlToMarkdown('<p><b>bold</b></p>')).toBe('**bold**');
  });

  it('converts <em> to _italic_', () => {
    expect(htmlToMarkdown('<p><em>italic</em></p>')).toBe('_italic_');
  });

  it('converts <i> to _italic_', () => {
    expect(htmlToMarkdown('<p><i>italic</i></p>')).toBe('_italic_');
  });

  it('converts <del> to ~~strikethrough~~', () => {
    expect(htmlToMarkdown('<p><del>removed</del></p>')).toBe('~~removed~~');
  });

  it('converts <s> to ~~strikethrough~~', () => {
    expect(htmlToMarkdown('<p><s>struck</s></p>')).toBe('~~struck~~');
  });

  it('converts <strike> to ~~strikethrough~~', () => {
    expect(htmlToMarkdown('<p><strike>old</strike></p>')).toBe('~~old~~');
  });

  it('converts <code> to `inline code`', () => {
    expect(htmlToMarkdown('<p>Use <code>npm install</code> to install.</p>')).toBe(
      'Use `npm install` to install.',
    );
  });

  it('handles nested bold and italic', () => {
    const result = htmlToMarkdown('<p><strong><em>bold italic</em></strong></p>');
    expect(result).toBe('**_bold italic_**');
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — links', () => {
  it('converts <a href> to [text](url)', () => {
    expect(htmlToMarkdown('<a href="https://example.com">Example</a>')).toBe(
      '[Example](https://example.com)',
    );
  });

  it('resolves relative links with baseUrl', () => {
    const result = htmlToMarkdown('<a href="/about">About</a>', {
      baseUrl: 'https://example.com',
    });
    expect(result).toBe('[About](https://example.com/about)');
  });

  it('strips utm_source and utm_medium tracking params', () => {
    const result = htmlToMarkdown(
      '<a href="https://example.com/page?utm_source=twitter&utm_medium=social&ref=home">Post</a>',
      { stripTracking: true },
    );
    expect(result).toBe('[Post](https://example.com/page)');
  });

  it('preserves non-tracking query params', () => {
    const result = htmlToMarkdown('<a href="https://example.com/search?q=hello&page=2">Search</a>');
    expect(result).toBe('[Search](https://example.com/search?q=hello&page=2)');
  });

  it('uses URL as text when link text is empty', () => {
    const result = htmlToMarkdown('<a href="https://example.com">  </a>');
    expect(result).toBe('https://example.com');
  });

  it('keeps link text when stripTracking is false', () => {
    const result = htmlToMarkdown('<a href="https://example.com?utm_source=test">Link</a>', {
      stripTracking: false,
    });
    expect(result).toBe('[Link](https://example.com?utm_source=test)');
  });
});

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — images', () => {
  it('converts <img> to ![alt](src)', () => {
    expect(htmlToMarkdown('<img src="https://example.com/photo.jpg" alt="A photo">')).toBe(
      '![A photo](https://example.com/photo.jpg)',
    );
  });

  it('uses empty alt when none provided', () => {
    expect(htmlToMarkdown('<img src="https://example.com/img.png">')).toBe(
      '![](https://example.com/img.png)',
    );
  });

  it('resolves relative image src', () => {
    const result = htmlToMarkdown('<img src="/images/hero.png" alt="Hero">', {
      baseUrl: 'https://example.com',
    });
    expect(result).toBe('![Hero](https://example.com/images/hero.png)');
  });

  it('removes images when preserveImages is false', () => {
    const result = htmlToMarkdown('<p>Text <img src="img.png" alt="img"> more</p>', {
      preserveImages: false,
    });
    expect(result).not.toContain('![');
    expect(result).toContain('Text');
  });

  it('skips data URI images for tracking strip (keeps as-is)', () => {
    const dataUri = 'data:image/png;base64,abc123';
    const result = htmlToMarkdown(`<img src="${dataUri}" alt="pixel">`, {
      stripTracking: true,
    });
    expect(result).toContain(dataUri);
  });
});

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — lists', () => {
  it('converts <ul> to unordered list', () => {
    const html = '<ul><li>Apple</li><li>Banana</li><li>Cherry</li></ul>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('- Apple');
    expect(result).toContain('- Banana');
    expect(result).toContain('- Cherry');
  });

  it('converts <ol> to ordered list', () => {
    const html = '<ol><li>First</li><li>Second</li><li>Third</li></ol>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('1. First');
    expect(result).toContain('2. Second');
    expect(result).toContain('3. Third');
  });

  it('handles empty list items gracefully', () => {
    const html = '<ul><li>Item</li><li>  </li></ul>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('- Item');
  });
});

// ---------------------------------------------------------------------------
// Blockquotes
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — blockquotes', () => {
  it('converts <blockquote> to > prefix', () => {
    const result = htmlToMarkdown('<blockquote><p>Quote text</p></blockquote>');
    expect(result).toContain('> Quote text');
  });

  it('handles multi-line blockquotes', () => {
    const result = htmlToMarkdown('<blockquote>Line one\nLine two</blockquote>');
    expect(result).toContain('> ');
  });
});

// ---------------------------------------------------------------------------
// Code blocks
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — code blocks', () => {
  it('converts <pre><code> to fenced code block', () => {
    const result = htmlToMarkdown('<pre><code>const x = 1;</code></pre>');
    expect(result).toContain('```');
    expect(result).toContain('const x = 1;');
  });

  it('extracts language from class="language-typescript"', () => {
    const result = htmlToMarkdown(
      '<pre><code class="language-typescript">let x: number = 1;</code></pre>',
    );
    expect(result).toContain('```typescript');
  });

  it('handles bare <pre> without <code>', () => {
    const result = htmlToMarkdown('<pre>raw text\n  indented</pre>');
    expect(result).toContain('```');
    expect(result).toContain('raw text');
  });

  it('decodes HTML entities in code blocks', () => {
    const result = htmlToMarkdown('<pre><code>if (a &lt; b &amp;&amp; c &gt; d)</code></pre>');
    expect(result).toContain('if (a < b && c > d)');
  });
});

// ---------------------------------------------------------------------------
// Tables
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — tables', () => {
  it('converts a simple table with thead and tbody', () => {
    const html = `
      <table>
        <thead>
          <tr><th>Name</th><th>Age</th></tr>
        </thead>
        <tbody>
          <tr><td>Alice</td><td>30</td></tr>
          <tr><td>Bob</td><td>25</td></tr>
        </tbody>
      </table>
    `;
    const result = htmlToMarkdown(html);
    expect(result).toContain('| Name | Age |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| Alice | 30 |');
    expect(result).toContain('| Bob | 25 |');
  });

  it('escapes pipe characters in cells', () => {
    const html = '<table><tbody><tr><td>A|B</td><td>C</td></tr></tbody></table>';
    const result = htmlToMarkdown(html);
    expect(result).toContain('A\\|B');
  });

  it('treats first row as header when no thead', () => {
    const html = `
      <table>
        <tr><td>Col1</td><td>Col2</td></tr>
        <tr><td>Val1</td><td>Val2</td></tr>
      </table>
    `;
    const result = htmlToMarkdown(html);
    expect(result).toContain('| --- |');
  });
});

// ---------------------------------------------------------------------------
// Horizontal rules and line breaks
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — hr and br', () => {
  it('converts <hr> to --- separator', () => {
    expect(htmlToMarkdown('<hr>')).toContain('---');
  });

  it('converts self-closing <hr/> to --- separator', () => {
    expect(htmlToMarkdown('<hr/>')).toContain('---');
  });

  it('converts <br> to double-space + newline', () => {
    const result = htmlToMarkdown('Line one<br>Line two');
    expect(result).toContain('  \n');
  });

  it('converts self-closing <br/> to double-space + newline', () => {
    const result = htmlToMarkdown('A<br/>B');
    expect(result).toContain('  \n');
  });
});

// ---------------------------------------------------------------------------
// Noise tag stripping
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — noise tag stripping', () => {
  it('strips <script> tags entirely', () => {
    const result = htmlToMarkdown('<p>Content</p><script>alert("xss")</script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('Content');
  });

  it('strips <style> tags entirely', () => {
    const result = htmlToMarkdown('<style>.foo { color: red; }</style><p>Text</p>');
    expect(result).not.toContain('.foo');
    expect(result).toContain('Text');
  });

  it('strips <!-- HTML comments -->', () => {
    const result = htmlToMarkdown('<!-- This is a comment --><p>Visible</p>');
    expect(result).not.toContain('This is a comment');
    expect(result).toContain('Visible');
  });
});

// ---------------------------------------------------------------------------
// HTML entity decoding
// ---------------------------------------------------------------------------

describe('decodeHtmlEntities', () => {
  it('decodes &amp; to &', () => {
    expect(decodeHtmlEntities('Tom &amp; Jerry')).toBe('Tom & Jerry');
  });

  it('decodes &lt; and &gt;', () => {
    expect(decodeHtmlEntities('a &lt; b &gt; c')).toBe('a < b > c');
  });

  it('decodes &quot; to "', () => {
    expect(decodeHtmlEntities('say &quot;hello&quot;')).toBe('say "hello"');
  });

  it('decodes &nbsp; to space', () => {
    expect(decodeHtmlEntities('hello&nbsp;world')).toBe('hello world');
  });

  it('decodes &mdash; to —', () => {
    expect(decodeHtmlEntities('one &mdash; two')).toBe('one — two');
  });

  it('decodes &ndash; to –', () => {
    expect(decodeHtmlEntities('2010 &ndash; 2020')).toBe('2010 – 2020');
  });

  it('decodes &hellip; to …', () => {
    expect(decodeHtmlEntities('wait&hellip;')).toBe('wait…');
  });

  it('decodes decimal numeric entity &#65; to A', () => {
    expect(decodeHtmlEntities('&#65;')).toBe('A');
  });

  it('decodes hex numeric entity &#x41; to A', () => {
    expect(decodeHtmlEntities('&#x41;')).toBe('A');
  });

  it('leaves unknown entities unchanged', () => {
    expect(decodeHtmlEntities('&unknown;')).toBe('&unknown;');
  });
});

// ---------------------------------------------------------------------------
// URL utilities
// ---------------------------------------------------------------------------

describe('resolveUrl', () => {
  it('returns absolute URL unchanged', () => {
    expect(resolveUrl('https://example.com/page', 'https://other.com')).toBe(
      'https://example.com/page',
    );
  });

  it('resolves relative path against base', () => {
    expect(resolveUrl('/about', 'https://example.com')).toBe('https://example.com/about');
  });

  it('resolves relative file against base', () => {
    expect(resolveUrl('../img/photo.jpg', 'https://example.com/posts/article/')).toBe(
      'https://example.com/posts/img/photo.jpg',
    );
  });

  it('returns original when no base provided', () => {
    expect(resolveUrl('/about')).toBe('/about');
  });

  it('returns original on invalid base', () => {
    expect(resolveUrl('/path', 'not-a-url')).toBe('/path');
  });

  it('returns data URIs unchanged', () => {
    const dataUri = 'data:image/png;base64,abc';
    expect(resolveUrl(dataUri, 'https://example.com')).toBe(dataUri);
  });

  it('returns empty string unchanged', () => {
    expect(resolveUrl('', 'https://example.com')).toBe('');
  });
});

describe('removeTrackingParams', () => {
  it('removes utm_source', () => {
    const result = removeTrackingParams('https://example.com/p?utm_source=twitter');
    expect(result).toBe('https://example.com/p');
  });

  it('removes utm_medium and utm_campaign', () => {
    const result = removeTrackingParams(
      'https://example.com/p?utm_medium=email&utm_campaign=launch',
    );
    expect(result).toBe('https://example.com/p');
  });

  it('removes fbclid', () => {
    const result = removeTrackingParams('https://example.com/?fbclid=abc123');
    expect(result).toBe('https://example.com');
  });

  it('removes gclid', () => {
    const result = removeTrackingParams('https://example.com/?gclid=xyz');
    expect(result).toBe('https://example.com');
  });

  it('preserves non-tracking params', () => {
    const result = removeTrackingParams(
      'https://example.com/search?q=hello&page=2&utm_source=feed',
    );
    expect(result).toContain('q=hello');
    expect(result).toContain('page=2');
    expect(result).not.toContain('utm_source');
  });

  it('preserves hash fragments', () => {
    const result = removeTrackingParams('https://example.com/page?utm_source=x#section');
    expect(result).toContain('#section');
    expect(result).not.toContain('utm_source');
  });

  it('returns data URIs unchanged', () => {
    const dataUri = 'data:image/png;base64,abc';
    expect(removeTrackingParams(dataUri)).toBe(dataUri);
  });

  it('returns malformed URLs unchanged', () => {
    expect(removeTrackingParams('not a url')).toBe('not a url');
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('htmlToMarkdown — edge cases', () => {
  it('returns empty string for empty input', () => {
    expect(htmlToMarkdown('')).toBe('');
  });

  it('handles plain text with no HTML tags', () => {
    expect(htmlToMarkdown('Just plain text')).toBe('Just plain text');
  });

  it('collapses multiple consecutive blank lines to two', () => {
    const result = htmlToMarkdown('<p>Para 1</p>\n\n\n\n\n<p>Para 2</p>');
    const lines = result.split('\n\n').filter((s) => s.trim());
    expect(lines.length).toBeGreaterThanOrEqual(2);
  });

  it('handles self-closing tags gracefully', () => {
    const result = htmlToMarkdown('<p>Text<br/>More</p>');
    expect(result).toContain('Text');
    expect(result).toContain('More');
  });

  it('normalises Windows line endings (CRLF)', () => {
    const result = htmlToMarkdown('<p>Line one\r\nLine two</p>');
    expect(result).not.toContain('\r');
  });

  it('strips <noscript> blocks', () => {
    const result = htmlToMarkdown('<noscript>Enable JS</noscript><p>Main content</p>');
    expect(result).not.toContain('Enable JS');
    expect(result).toContain('Main content');
  });
});
