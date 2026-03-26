import { describe, it, expect } from 'vitest';
import { parseFrontmatter, stringifyFrontmatter } from '../frontmatter';

// FRONTMATTER_DELIMITER is '---' — tests use it literally for clarity.

describe('parseFrontmatter', () => {
  it('returns empty data and the full text when there is no frontmatter', () => {
    const text = 'Just body text.';
    const result = parseFrontmatter(text);
    expect(result.data).toEqual({});
    expect(result.content).toBe(text);
    expect(result.raw).toBe('');
  });

  it('parses a single key-value pair', () => {
    const text = '---\ntitle: My Note\n---\nBody text.';
    const result = parseFrontmatter(text);
    expect(result.data).toEqual({ title: 'My Note' });
    expect(result.content).toBe('Body text.');
    expect(result.raw).toBe('title: My Note');
  });

  it('parses multiple key-value pairs', () => {
    const text = '---\ntitle: Hello\ntags: dev\nstatus: active\n---\nContent.';
    const result = parseFrontmatter(text);
    expect(result.data).toMatchObject({
      title: 'Hello',
      tags: 'dev',
      status: 'active',
    });
  });

  it('returns the body content without the frontmatter block', () => {
    const text = '---\ntitle: Test\n---\nThis is the body.';
    const result = parseFrontmatter(text);
    expect(result.content).toBe('This is the body.');
  });

  it('returns empty data if the opening delimiter is not followed by a closing delimiter', () => {
    // Unclosed frontmatter should be treated as invalid.
    const text = '---\ntitle: Unclosed\nNo closing delimiter.';
    const result = parseFrontmatter(text);
    expect(result.data).toEqual({});
    expect(result.raw).toBe('');
  });

  it('ignores leading whitespace before the frontmatter delimiter', () => {
    const text = '  \n---\ntitle: Trimmed\n---\nBody.';
    const result = parseFrontmatter(text);
    expect(result.data).toMatchObject({ title: 'Trimmed' });
  });

  it('handles a value that contains a colon', () => {
    // Only the first colon should be treated as the key-value separator.
    const text = '---\nurl: https://example.com\n---\nBody.';
    const result = parseFrontmatter(text);
    expect(result.data['url']).toBe('https://example.com');
  });

  it('handles an empty frontmatter block gracefully', () => {
    const text = '---\n---\nBody only.';
    const result = parseFrontmatter(text);
    expect(result.data).toEqual({});
    expect(result.content).toBe('Body only.');
  });
});

describe('stringifyFrontmatter', () => {
  it('returns the content unchanged when data is empty', () => {
    expect(stringifyFrontmatter({}, 'Body.')).toBe('Body.');
  });

  it('prepends a YAML frontmatter block for non-empty data', () => {
    const result = stringifyFrontmatter({ title: 'Hello' }, 'Body.');
    expect(result).toBe('---\ntitle: Hello\n---\nBody.');
  });

  it('round-trips through parseFrontmatter', () => {
    const data = { title: 'My Note', tags: 'dev' };
    const content = 'Note body.';
    const serialised = stringifyFrontmatter(data, content);
    const parsed = parseFrontmatter(serialised);
    expect(parsed.data).toMatchObject(data);
    expect(parsed.content).toBe(content);
  });
});
