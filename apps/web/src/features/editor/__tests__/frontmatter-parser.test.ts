/**
 * Tests for frontmatter-parser.ts
 *
 * Covers:
 *   - detectValueType — correct classification of scalars
 *   - coerceValue — correct JS coercion per type
 *   - parseInlineArray — inline array parsing
 *   - parseFrontmatter — full markdown → Map parsing
 *   - serializeFrontmatter — Map → YAML block serialization
 *   - buildMarkdown — reassembly of frontmatter + body
 *   - Round-trip stability — serialize(parse(x)) === x equivalence
 */

import { describe, it, expect } from 'vitest';
import {
  detectValueType,
  coerceValue,
  parseInlineArray,
  parseFrontmatter,
  serializeFrontmatter,
  buildMarkdown,
  type FrontmatterMap,
} from '../lib/frontmatter-parser';

// ---------------------------------------------------------------------------
// detectValueType
// ---------------------------------------------------------------------------

describe('detectValueType', () => {
  it('classifies "true" as boolean', () => {
    expect(detectValueType('true')).toBe('boolean');
  });

  it('classifies "false" as boolean', () => {
    expect(detectValueType('false')).toBe('boolean');
  });

  it('classifies "yes" as boolean (case-insensitive)', () => {
    expect(detectValueType('yes')).toBe('boolean');
    expect(detectValueType('YES')).toBe('boolean');
  });

  it('classifies "no" as boolean', () => {
    expect(detectValueType('no')).toBe('boolean');
  });

  it('classifies "on" / "off" as boolean', () => {
    expect(detectValueType('on')).toBe('boolean');
    expect(detectValueType('off')).toBe('boolean');
  });

  it('classifies integer strings as number', () => {
    expect(detectValueType('42')).toBe('number');
    expect(detectValueType('-7')).toBe('number');
    expect(detectValueType('0')).toBe('number');
  });

  it('classifies float strings as number', () => {
    expect(detectValueType('3.14')).toBe('number');
    expect(detectValueType('-0.5')).toBe('number');
  });

  it('classifies ISO date strings as date', () => {
    expect(detectValueType('2024-01-15')).toBe('date');
    expect(detectValueType('2000-12-31')).toBe('date');
  });

  it('classifies everything else as string', () => {
    expect(detectValueType('hello world')).toBe('string');
    expect(detectValueType('')).toBe('string');
    expect(detectValueType('not-a-date')).toBe('string');
    expect(detectValueType('2024-13-01')).toBe('string'); // invalid month
    expect(detectValueType('3.14.15')).toBe('string'); // not a valid number
  });

  it('handles leading/trailing whitespace correctly', () => {
    expect(detectValueType('  true  ')).toBe('boolean');
    expect(detectValueType('  42  ')).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// coerceValue
// ---------------------------------------------------------------------------

describe('coerceValue', () => {
  it('returns true for truthy boolean strings', () => {
    expect(coerceValue('true', 'boolean')).toBe(true);
    expect(coerceValue('yes', 'boolean')).toBe(true);
    expect(coerceValue('on', 'boolean')).toBe(true);
    expect(coerceValue('True', 'boolean')).toBe(true);
  });

  it('returns false for falsy boolean strings', () => {
    expect(coerceValue('false', 'boolean')).toBe(false);
    expect(coerceValue('no', 'boolean')).toBe(false);
    expect(coerceValue('off', 'boolean')).toBe(false);
  });

  it('returns a number for number type', () => {
    expect(coerceValue('42', 'number')).toBe(42);
    expect(coerceValue('-7', 'number')).toBe(-7);
    expect(coerceValue('3.14', 'number')).toBe(3.14);
  });

  it('returns the trimmed string for string type', () => {
    expect(coerceValue('  hello  ', 'string')).toBe('hello');
    expect(coerceValue('world', 'string')).toBe('world');
  });

  it('returns the trimmed string for date type', () => {
    expect(coerceValue('  2024-01-15  ', 'date')).toBe('2024-01-15');
  });
});

// ---------------------------------------------------------------------------
// parseInlineArray
// ---------------------------------------------------------------------------

describe('parseInlineArray', () => {
  it('returns null for non-array strings', () => {
    expect(parseInlineArray('hello')).toBeNull();
    expect(parseInlineArray('')).toBeNull();
    expect(parseInlineArray('123')).toBeNull();
  });

  it('returns empty array for []', () => {
    expect(parseInlineArray('[]')).toEqual([]);
    expect(parseInlineArray('[  ]')).toEqual([]);
  });

  it('parses simple unquoted items', () => {
    expect(parseInlineArray('[a, b, c]')).toEqual(['a', 'b', 'c']);
  });

  it('parses double-quoted items', () => {
    expect(parseInlineArray('["hello world", "foo bar"]')).toEqual(['hello world', 'foo bar']);
  });

  it('parses single-quoted items', () => {
    expect(parseInlineArray("['hello', 'world']")).toEqual(['hello', 'world']);
  });

  it('parses mixed quoted and unquoted items', () => {
    expect(parseInlineArray('["tag one", plain, 42]')).toEqual(['tag one', 'plain', '42']);
  });

  it('handles items with commas inside quotes', () => {
    expect(parseInlineArray('["a, b", c]')).toEqual(['a, b', 'c']);
  });

  it('handles single item arrays', () => {
    expect(parseInlineArray('[single]')).toEqual(['single']);
  });

  it('trims whitespace from items', () => {
    expect(parseInlineArray('[ a , b , c ]')).toEqual(['a', 'b', 'c']);
  });
});

// ---------------------------------------------------------------------------
// parseFrontmatter
// ---------------------------------------------------------------------------

describe('parseFrontmatter', () => {
  it('returns empty map and original content for markdown without frontmatter', () => {
    const md = '# Hello\n\nSome content.';
    const result = parseFrontmatter(md);
    expect(result.properties.size).toBe(0);
    expect(result.body).toBe(md);
  });

  it('returns empty map when opening --- has no closing ---', () => {
    const md = '---\ntitle: Test\n\n# Content';
    const result = parseFrontmatter(md);
    expect(result.properties.size).toBe(0);
    expect(result.body).toBe(md);
  });

  it('parses a simple string property', () => {
    const md = '---\ntitle: My Note\n---\n\n# Body';
    const { properties, body } = parseFrontmatter(md);
    expect(properties.get('title')?.value).toBe('My Note');
    expect(properties.get('title')?.type).toBe('string');
    expect(body).toBe('# Body');
  });

  it('parses a number property', () => {
    const md = '---\ncount: 42\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('count')?.value).toBe(42);
    expect(properties.get('count')?.type).toBe('number');
  });

  it('parses a boolean property', () => {
    const md = '---\npublished: true\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('published')?.value).toBe(true);
    expect(properties.get('published')?.type).toBe('boolean');
  });

  it('parses a date property', () => {
    const md = '---\ndate: 2024-03-15\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('date')?.value).toBe('2024-03-15');
    expect(properties.get('date')?.type).toBe('date');
  });

  it('parses inline array property', () => {
    const md = '---\ntags: [alpha, beta, gamma]\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('tags')?.value).toEqual(['alpha', 'beta', 'gamma']);
    expect(properties.get('tags')?.type).toBe('array');
  });

  it('parses block sequence array property', () => {
    const md = '---\ntags:\n  - foo\n  - bar\n  - baz\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('tags')?.value).toEqual(['foo', 'bar', 'baz']);
    expect(properties.get('tags')?.type).toBe('array');
  });

  it('parses empty inline array', () => {
    const md = '---\ntags: []\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('tags')?.value).toEqual([]);
    expect(properties.get('tags')?.type).toBe('array');
  });

  it('parses quoted string values', () => {
    const md = '---\ntitle: "My Note: With Colon"\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('title')?.value).toBe('My Note: With Colon');
  });

  it('parses single-quoted string values', () => {
    const md = "---\ntitle: 'My Note'\n---";
    const { properties } = parseFrontmatter(md);
    expect(properties.get('title')?.value).toBe('My Note');
  });

  it('preserves insertion order of properties', () => {
    const md = '---\nz: last\na: first\nm: middle\n---';
    const { properties } = parseFrontmatter(md);
    const keys = Array.from(properties.keys());
    expect(keys).toEqual(['z', 'a', 'm']);
  });

  it('skips blank lines and comments in frontmatter', () => {
    const md = '---\n# This is a comment\ntitle: Test\n\ncount: 5\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.size).toBe(2);
    expect(properties.has('title')).toBe(true);
    expect(properties.has('count')).toBe(true);
  });

  it('parses multiple properties of different types', () => {
    const md = [
      '---',
      'title: My Note',
      'count: 7',
      'published: false',
      'date: 2024-01-01',
      'tags: [a, b]',
      '---',
      '',
      '# Body content',
    ].join('\n');

    const { properties, body } = parseFrontmatter(md);
    expect(properties.size).toBe(5);
    expect(properties.get('title')?.type).toBe('string');
    expect(properties.get('count')?.type).toBe('number');
    expect(properties.get('published')?.type).toBe('boolean');
    expect(properties.get('date')?.type).toBe('date');
    expect(properties.get('tags')?.type).toBe('array');
    expect(body).toBe('# Body content');
  });

  it('handles frontmatter-only markdown (no body)', () => {
    const md = '---\ntitle: Only FM\n---';
    const { properties, body } = parseFrontmatter(md);
    expect(properties.size).toBe(1);
    expect(body).toBe('');
  });

  it('handles "false" value for boolean correctly', () => {
    const md = '---\ndraft: false\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('draft')?.value).toBe(false);
  });

  it('parses inline array with quoted items containing spaces', () => {
    const md = '---\naliases: ["My Note Title", "alternate name"]\n---';
    const { properties } = parseFrontmatter(md);
    expect(properties.get('aliases')?.value).toEqual(['My Note Title', 'alternate name']);
  });
});

// ---------------------------------------------------------------------------
// serializeFrontmatter
// ---------------------------------------------------------------------------

describe('serializeFrontmatter', () => {
  it('returns empty string for empty map', () => {
    expect(serializeFrontmatter(new Map())).toBe('');
  });

  it('serializes a string property', () => {
    const map: FrontmatterMap = new Map([
      ['title', { key: 'title', value: 'My Note', type: 'string' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('title: My Note');
    expect(result).toMatch(/^---/);
    expect(result).toMatch(/---$/);
  });

  it('quotes strings that contain colons', () => {
    const map: FrontmatterMap = new Map([
      ['title', { key: 'title', value: 'My Note: Part 2', type: 'string' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('title: "My Note: Part 2"');
  });

  it('quotes strings that look like keywords', () => {
    const map: FrontmatterMap = new Map([
      ['status', { key: 'status', value: 'true', type: 'string' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('status: "true"');
  });

  it('serializes boolean values without quotes', () => {
    const map: FrontmatterMap = new Map([
      ['published', { key: 'published', value: true, type: 'boolean' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('published: true');
  });

  it('serializes number values without quotes', () => {
    const map: FrontmatterMap = new Map([['count', { key: 'count', value: 42, type: 'number' }]]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('count: 42');
  });

  it('serializes date values without quotes', () => {
    const map: FrontmatterMap = new Map([
      ['date', { key: 'date', value: '2024-01-15', type: 'date' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('date: 2024-01-15');
  });

  it('serializes empty array as []', () => {
    const map: FrontmatterMap = new Map([['tags', { key: 'tags', value: [], type: 'array' }]]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('tags: []');
  });

  it('serializes single-item array as inline', () => {
    const map: FrontmatterMap = new Map([
      ['tags', { key: 'tags', value: ['single'], type: 'array' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('tags: [single]');
  });

  it('serializes multi-item array as block sequence', () => {
    const map: FrontmatterMap = new Map([
      ['tags', { key: 'tags', value: ['a', 'b', 'c'], type: 'array' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('tags:');
    expect(result).toContain('  - a');
    expect(result).toContain('  - b');
    expect(result).toContain('  - c');
  });

  it('quotes array items that contain colons', () => {
    const map: FrontmatterMap = new Map([
      ['tags', { key: 'tags', value: ['key: value', 'plain'], type: 'array' }],
    ]);
    const result = serializeFrontmatter(map);
    expect(result).toContain('  - "key: value"');
    expect(result).toContain('  - plain');
  });

  it('does not quote array items that are plain strings with spaces', () => {
    const map: FrontmatterMap = new Map([
      ['tags', { key: 'tags', value: ['tag one', 'tag two'], type: 'array' }],
    ]);
    const result = serializeFrontmatter(map);
    // Strings with spaces are valid in YAML block sequences without quotes
    expect(result).toContain('  - tag one');
    expect(result).toContain('  - tag two');
  });

  it('wraps output in --- delimiters', () => {
    const map: FrontmatterMap = new Map([
      ['title', { key: 'title', value: 'Test', type: 'string' }],
    ]);
    const result = serializeFrontmatter(map);
    const lines = result.split('\n');
    expect(lines[0]).toBe('---');
    expect(lines[lines.length - 1]).toBe('---');
  });
});

// ---------------------------------------------------------------------------
// buildMarkdown
// ---------------------------------------------------------------------------

describe('buildMarkdown', () => {
  it('returns body unchanged when properties map is empty', () => {
    const body = '# Hello\n\nSome content.';
    expect(buildMarkdown(new Map(), body)).toBe(body);
  });

  it('prepends frontmatter block when properties exist', () => {
    const map: FrontmatterMap = new Map([
      ['title', { key: 'title', value: 'My Note', type: 'string' }],
    ]);
    const body = '# Body';
    const result = buildMarkdown(map, body);
    expect(result).toMatch(/^---\n/);
    expect(result).toContain('title: My Note');
    expect(result).toContain('# Body');
  });

  it('handles empty body', () => {
    const map: FrontmatterMap = new Map([
      ['title', { key: 'title', value: 'Test', type: 'string' }],
    ]);
    const result = buildMarkdown(map, '');
    expect(result).toMatch(/^---/);
    // The result starts and ends with a --- block (trim trailing newline for check)
    expect(result.trim()).toMatch(/---$/);
  });
});

// ---------------------------------------------------------------------------
// Round-trip tests
// ---------------------------------------------------------------------------

describe('parseFrontmatter + serializeFrontmatter (round-trip)', () => {
  function roundTrip(input: string): FrontmatterMap {
    const { properties } = parseFrontmatter(input);
    const serialized = `${serializeFrontmatter(properties)}\n`;
    const { properties: reparsed } = parseFrontmatter(serialized);
    return reparsed;
  }

  it('preserves string values after round-trip', () => {
    const md = '---\ntitle: Hello World\n---';
    const result = roundTrip(md);
    expect(result.get('title')?.value).toBe('Hello World');
    expect(result.get('title')?.type).toBe('string');
  });

  it('preserves number values after round-trip', () => {
    const md = '---\ncount: 99\n---';
    const result = roundTrip(md);
    expect(result.get('count')?.value).toBe(99);
    expect(result.get('count')?.type).toBe('number');
  });

  it('preserves boolean values after round-trip', () => {
    const md = '---\npublished: false\n---';
    const result = roundTrip(md);
    expect(result.get('published')?.value).toBe(false);
    expect(result.get('published')?.type).toBe('boolean');
  });

  it('preserves date values after round-trip', () => {
    const md = '---\ndate: 2024-06-15\n---';
    const result = roundTrip(md);
    expect(result.get('date')?.value).toBe('2024-06-15');
    expect(result.get('date')?.type).toBe('date');
  });

  it('preserves array values after round-trip', () => {
    const md = '---\ntags: [alpha, beta, gamma]\n---';
    const result = roundTrip(md);
    expect(result.get('tags')?.value).toEqual(['alpha', 'beta', 'gamma']);
    expect(result.get('tags')?.type).toBe('array');
  });

  it('preserves empty array after round-trip', () => {
    const md = '---\ntags: []\n---';
    const result = roundTrip(md);
    expect(result.get('tags')?.value).toEqual([]);
  });

  it('preserves block sequence array after round-trip', () => {
    const md = '---\naliases:\n  - Alternate Name\n  - Another Name\n---';
    const result = roundTrip(md);
    expect(result.get('aliases')?.value).toEqual(['Alternate Name', 'Another Name']);
  });

  it('preserves property key order after round-trip', () => {
    const md = '---\nz: last\na: first\nm: middle\n---';
    const result = roundTrip(md);
    const keys = Array.from(result.keys());
    expect(keys).toEqual(['z', 'a', 'm']);
  });
});
