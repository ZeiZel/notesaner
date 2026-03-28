/**
 * Tests for docx-renderer.
 *
 * Covers: renderToDocx (entry map structure), parseMarkdownBlocks,
 * parseInlineSegments, renderInlineMarkdown, renderTable.
 */

import { describe, it, expect } from 'vitest';
import {
  renderToDocx,
  parseMarkdownBlocks,
  parseInlineSegments,
  renderInlineMarkdown,
  renderTable,
} from '../docx-renderer';

// ---------------------------------------------------------------------------
// renderToDocx — entry map structure
// ---------------------------------------------------------------------------

describe('renderToDocx', () => {
  it('returns a non-empty DocxEntries map', () => {
    const entries = renderToDocx({ markdown: '# Hello\n\nWorld.' });
    expect(Object.keys(entries).length).toBeGreaterThan(0);
  });

  it('includes required OOXML entry files', () => {
    const entries = renderToDocx({ markdown: '# Test' });
    expect(entries['[Content_Types].xml']).toBeDefined();
    expect(entries['_rels/.rels']).toBeDefined();
    expect(entries['word/document.xml']).toBeDefined();
    expect(entries['word/styles.xml']).toBeDefined();
    expect(entries['word/numbering.xml']).toBeDefined();
    expect(entries['word/_rels/document.xml.rels']).toBeDefined();
    expect(entries['docProps/core.xml']).toBeDefined();
  });

  it('includes the note title in document.xml', () => {
    const entries = renderToDocx({ markdown: '## Section', title: 'My Note' });
    expect(entries['word/document.xml']).toContain('My Note');
  });

  it('includes content from markdown in document.xml', () => {
    const entries = renderToDocx({ markdown: 'Hello world', title: '' });
    expect(entries['word/document.xml']).toContain('Hello world');
  });

  it('includes a TOC placeholder when includeToc is true', () => {
    const entries = renderToDocx({ markdown: '# Title\n## Section', includeToc: true });
    expect(entries['word/document.xml']).toContain('Table of Contents');
  });

  it('does not include TOC placeholder when includeToc is false', () => {
    const entries = renderToDocx({ markdown: '# Title', includeToc: false });
    expect(entries['word/document.xml']).not.toContain('Table of Contents');
  });

  it('includes author in core properties', () => {
    const entries = renderToDocx({ markdown: '# Test', author: 'Alice' });
    expect(entries['docProps/core.xml']).toContain('Alice');
  });

  it('produces valid XML (starts with declaration)', () => {
    const entries = renderToDocx({ markdown: '# Test' });
    expect(entries['word/document.xml'].trim()).toMatch(/^<\?xml/);
    expect(entries['word/styles.xml'].trim()).toMatch(/^<\?xml/);
    expect(entries['[Content_Types].xml'].trim()).toMatch(/^<\?xml/);
  });

  it('includes numbering.xml with bullet and number lists', () => {
    const entries = renderToDocx({ markdown: '- item\n1. item' });
    const numbering = entries['word/numbering.xml'];
    expect(numbering).toContain('w:numFmt w:val="bullet"');
    expect(numbering).toContain('w:numFmt w:val="decimal"');
  });
});

// ---------------------------------------------------------------------------
// parseMarkdownBlocks
// ---------------------------------------------------------------------------

describe('parseMarkdownBlocks', () => {
  it('parses headings', () => {
    const blocks = parseMarkdownBlocks('# H1\n## H2\n### H3');
    expect(blocks.filter((b) => b.type === 'heading')).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1, text: 'H1' });
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2, text: 'H2' });
  });

  it('parses paragraphs', () => {
    const blocks = parseMarkdownBlocks('Hello world\n\nSecond paragraph');
    const paras = blocks.filter((b) => b.type === 'paragraph');
    expect(paras).toHaveLength(2);
  });

  it('parses fenced code blocks', () => {
    const blocks = parseMarkdownBlocks('```ts\nconst x = 1;\n```');
    const code = blocks.find((b) => b.type === 'code');
    expect(code).toBeDefined();
    if (code?.type === 'code') {
      expect(code.lang).toBe('ts');
      expect(code.lines).toContain('const x = 1;');
    }
  });

  it('parses unordered list items', () => {
    const blocks = parseMarkdownBlocks('- Item A\n- Item B');
    const items = blocks.filter((b) => b.type === 'ul-item');
    expect(items).toHaveLength(2);
    if (items[0].type === 'ul-item') expect(items[0].text).toBe('Item A');
  });

  it('parses ordered list items', () => {
    const blocks = parseMarkdownBlocks('1. First\n2. Second');
    const items = blocks.filter((b) => b.type === 'ol-item');
    expect(items).toHaveLength(2);
    if (items[0].type === 'ol-item') {
      expect(items[0].text).toBe('First');
      expect(items[0].num).toBe(1);
    }
  });

  it('parses blockquotes', () => {
    const blocks = parseMarkdownBlocks('> Quoted line');
    const bq = blocks.find((b) => b.type === 'blockquote');
    expect(bq).toBeDefined();
    if (bq?.type === 'blockquote') {
      expect(bq.lines).toContain('Quoted line');
    }
  });

  it('parses horizontal rules', () => {
    const blocks = parseMarkdownBlocks('---');
    expect(blocks.find((b) => b.type === 'hr')).toBeDefined();
  });

  it('parses math blocks', () => {
    const blocks = parseMarkdownBlocks('$$\nE=mc^2\n$$');
    const math = blocks.find((b) => b.type === 'math');
    expect(math).toBeDefined();
    if (math?.type === 'math') {
      expect(math.content).toBe('E=mc^2');
    }
  });

  it('parses tables', () => {
    const md = '| A | B |\n| - | - |\n| 1 | 2 |';
    const blocks = parseMarkdownBlocks(md);
    const table = blocks.find((b) => b.type === 'table');
    expect(table).toBeDefined();
    if (table?.type === 'table') {
      expect(table.header).toEqual(['A', 'B']);
      expect(table.rows).toHaveLength(1);
      expect(table.rows[0]).toEqual(['1', '2']);
    }
  });

  it('does not parse headings inside code blocks', () => {
    const blocks = parseMarkdownBlocks('```\n# Not a heading\n```');
    expect(blocks.find((b) => b.type === 'heading')).toBeUndefined();
  });

  it('handles empty string', () => {
    expect(parseMarkdownBlocks('')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// parseInlineSegments
// ---------------------------------------------------------------------------

describe('parseInlineSegments', () => {
  it('returns plain text as a single segment', () => {
    const segs = parseInlineSegments('hello world');
    expect(segs).toHaveLength(1);
    expect(segs[0]).toMatchObject({ text: 'hello world' });
  });

  it('parses bold text', () => {
    const segs = parseInlineSegments('**bold**');
    const bold = segs.find((s) => s.bold);
    expect(bold).toBeDefined();
    expect(bold?.text).toBe('bold');
  });

  it('parses italic text', () => {
    const segs = parseInlineSegments('*italic*');
    const italic = segs.find((s) => s.italic);
    expect(italic).toBeDefined();
    expect(italic?.text).toBe('italic');
  });

  it('parses inline code', () => {
    const segs = parseInlineSegments('Use `code` here');
    const code = segs.find((s) => s.code);
    expect(code).toBeDefined();
    expect(code?.text).toBe('code');
  });

  it('parses strikethrough', () => {
    const segs = parseInlineSegments('~~deleted~~');
    const strike = segs.find((s) => s.strikethrough);
    expect(strike).toBeDefined();
    expect(strike?.text).toBe('deleted');
  });

  it('parses links', () => {
    const segs = parseInlineSegments('[Click](https://example.com)');
    const link = segs.find((s) => s.link);
    expect(link).toBeDefined();
    expect(link?.link).toBe('https://example.com');
    expect(link?.text).toBe('Click');
  });

  it('parses images as placeholder text', () => {
    const segs = parseInlineSegments('![alt text](image.png)');
    const img = segs.find((s) => s.isImage);
    expect(img).toBeDefined();
    expect(img?.text).toContain('Image:');
    expect(img?.text).toContain('alt text');
  });

  it('handles mixed inline formatting', () => {
    const segs = parseInlineSegments('Start **bold** middle *italic* end');
    expect(segs.length).toBeGreaterThan(3);
    expect(segs.some((s) => s.bold)).toBe(true);
    expect(segs.some((s) => s.italic)).toBe(true);
  });

  it('handles empty string', () => {
    expect(parseInlineSegments('')).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// renderInlineMarkdown
// ---------------------------------------------------------------------------

describe('renderInlineMarkdown', () => {
  it('produces w:r elements', () => {
    const xml = renderInlineMarkdown('Hello');
    expect(xml).toContain('<w:r>');
    expect(xml).toContain('Hello');
  });

  it('applies bold properties', () => {
    const xml = renderInlineMarkdown('**bold**');
    expect(xml).toContain('<w:b/>');
    expect(xml).toContain('bold');
  });

  it('applies italic properties', () => {
    const xml = renderInlineMarkdown('*italic*');
    expect(xml).toContain('<w:i/>');
  });

  it('applies code style', () => {
    const xml = renderInlineMarkdown('`code`');
    expect(xml).toContain('CodeChar');
  });

  it('applies strikethrough', () => {
    const xml = renderInlineMarkdown('~~deleted~~');
    expect(xml).toContain('<w:strike/>');
  });

  it('escapes XML entities in text', () => {
    const xml = renderInlineMarkdown('A & B < C > D');
    expect(xml).toContain('&amp;');
    expect(xml).toContain('&lt;');
    expect(xml).toContain('&gt;');
    expect(xml).not.toContain(' & ');
  });
});

// ---------------------------------------------------------------------------
// renderTable
// ---------------------------------------------------------------------------

describe('renderTable', () => {
  it('produces a w:tbl element', () => {
    const xml = renderTable(['Col A', 'Col B'], ['left', 'right'], [['1', '2']]);
    expect(xml).toContain('<w:tbl>');
    expect(xml).toContain('</w:tbl>');
  });

  it('includes header row with tblHeader marker', () => {
    const xml = renderTable(['Header'], ['left'], [['Row 1']]);
    expect(xml).toContain('<w:tblHeader/>');
  });

  it('includes cell content', () => {
    const xml = renderTable(['Name'], ['left'], [['Alice'], ['Bob']]);
    expect(xml).toContain('Alice');
    expect(xml).toContain('Bob');
  });

  it('applies alignment from alignments array', () => {
    const xml = renderTable(['L', 'C', 'R'], ['left', 'center', 'right'], []);
    expect(xml).toContain('w:val="left"');
    expect(xml).toContain('w:val="center"');
    expect(xml).toContain('w:val="right"');
  });

  it('handles empty rows array (header only)', () => {
    const xml = renderTable(['Col'], ['left'], []);
    expect(xml).toContain('Col');
    expect(xml).toContain('<w:tr>');
  });
});
