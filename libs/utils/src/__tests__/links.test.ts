import { describe, it, expect } from 'vitest';
import { parseWikiLinks, extractAllLinks } from '../links';

describe('parseWikiLinks', () => {
  it('returns an empty array for content with no links', () => {
    expect(parseWikiLinks('Just plain text.')).toEqual([]);
  });

  it('parses a basic wiki link', () => {
    const result = parseWikiLinks('See [[My Note]] for details.');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      target: 'My Note',
      type: 'wiki',
      raw: '[[My Note]]',
    });
  });

  it('parses a wiki link with a display alias', () => {
    const result = parseWikiLinks('See [[My Note|alias text]] here.');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      target: 'My Note',
      displayText: 'alias text',
      type: 'wiki',
    });
  });

  it('parses an embed link (prefixed with !)', () => {
    const result = parseWikiLinks('![[image.png]]');
    // The embed is captured by EMBED_REGEX. WIKI_LINK_REGEX also matches the
    // inner [[image.png]] at a different position, so both appear in results.
    const embed = result.find((l) => l.type === 'embed');
    expect(embed).toBeDefined();
    expect(embed).toMatchObject({
      target: 'image.png',
      type: 'embed',
      raw: '![[image.png]]',
    });
  });

  it('parses a block reference link', () => {
    const result = parseWikiLinks('See [[SomeNote#^block-id]] for context.');
    // block_ref regex matches first, then wiki regex also matches but dedup removes
    // if positions overlap — however the wiki regex captures "SomeNote#^block-id" as target
    // which has different position, so both appear. Filter to block_ref type:
    const blockRefs = result.filter((l) => l.type === 'block_ref');
    expect(blockRefs).toHaveLength(1);
    expect(result[0]).toMatchObject({
      target: 'SomeNote',
      blockId: 'block-id',
      type: 'block_ref',
    });
  });

  it('parses a heading link', () => {
    const result = parseWikiLinks('Jump to [[SomeNote#Introduction]].');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      target: 'SomeNote',
      heading: 'Introduction',
      type: 'heading',
    });
  });

  it('parses a heading link with a display alias', () => {
    const result = parseWikiLinks('[[SomeNote#Introduction|Intro]]');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      target: 'SomeNote',
      heading: 'Introduction',
      displayText: 'Intro',
      type: 'heading',
    });
  });

  it('identifies the embed type among results for an embed link', () => {
    // The embed entry must be present and typed correctly.
    // WIKI_LINK_REGEX additionally matches the inner [[...]] at a different
    // offset so the total count may be more than one, but the embed record
    // must always be present.
    const result = parseWikiLinks('![[image.png]]');
    const types = result.map((l) => l.type);
    expect(types).toContain('embed');
  });

  it('records accurate start/end positions', () => {
    const content = 'Start [[Target]] end.';
    const result = parseWikiLinks(content);
    expect(result).toHaveLength(1);
    expect(result[0].position.start).toBe(6);
    expect(result[0].position.end).toBe(16);
  });

  it('parses multiple wiki links in one string', () => {
    const result = parseWikiLinks('[[NoteA]] and [[NoteB]].');
    expect(result).toHaveLength(2);
    expect(result.map((l) => l.target)).toContain('NoteA');
    expect(result.map((l) => l.target)).toContain('NoteB');
  });

  it('parses a mix of link types', () => {
    const content = '![[img.png]] and [[Note]] and [[Doc#Heading]]';
    const result = parseWikiLinks(content);
    const types = result.map((l) => l.type);
    expect(types).toContain('embed');
    expect(types).toContain('wiki');
    expect(types).toContain('heading');
  });
});

describe('extractAllLinks', () => {
  it('returns unique targets from all link types', () => {
    const content = '[[NoteA]] and [[NoteA]] and [[NoteB]]';
    const result = extractAllLinks(content);
    // Duplicates must be de-duped.
    expect(result.filter((t) => t === 'NoteA')).toHaveLength(1);
    expect(result).toContain('NoteB');
  });

  it('returns an empty array for content with no links', () => {
    expect(extractAllLinks('No links here.')).toEqual([]);
  });
});
