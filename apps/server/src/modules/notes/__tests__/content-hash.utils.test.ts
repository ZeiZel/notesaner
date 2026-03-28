import { describe, it, expect } from 'vitest';
import { sha256, hashesMatch, contentDiffersFromHash } from '../content-hash.utils';

// ─── sha256 ───────────────────────────────────────────────────────────────────

describe('sha256', () => {
  it('returns a 64-character lowercase hex string for a plain string', () => {
    const result = sha256('hello world');
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns the expected SHA-256 digest for a known input', () => {
    // Node.js crypto SHA-256 of "abc" (UTF-8, no newline):
    //   node -e "const c=require('crypto');console.log(c.createHash('sha256').update('abc','utf-8').digest('hex'))"
    const result = sha256('abc');
    expect(result).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('returns a different hash for different inputs', () => {
    const a = sha256('foo');
    const b = sha256('bar');
    expect(a).not.toBe(b);
  });

  it('returns the same hash for the same input called multiple times', () => {
    const content = '# My Note\n\nSome content.';
    expect(sha256(content)).toBe(sha256(content));
  });

  it('handles an empty string', () => {
    const result = sha256('');
    // Known SHA-256 of empty string
    expect(result).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('handles multi-line content', () => {
    const content = '---\ntitle: Test\n---\n\n# Heading\n\nParagraph.';
    const result = sha256(content);
    expect(result).toHaveLength(64);
  });

  it('is sensitive to whitespace differences', () => {
    expect(sha256('content\n')).not.toBe(sha256('content'));
    expect(sha256(' content')).not.toBe(sha256('content'));
  });

  it('accepts a Buffer input', () => {
    const buf = Buffer.from('hello world', 'utf-8');
    const result = sha256(buf);
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces the same digest for a string and its UTF-8 Buffer equivalent', () => {
    const str = 'unicode content: 你好';
    const buf = Buffer.from(str, 'utf-8');
    expect(sha256(str)).toBe(sha256(buf));
  });

  it('handles unicode content without error', () => {
    const result = sha256('日本語テスト 🚀');
    expect(result).toHaveLength(64);
  });

  it('handles large content without error', () => {
    const large = 'a'.repeat(1_000_000);
    const result = sha256(large);
    expect(result).toHaveLength(64);
  });
});

// ─── hashesMatch ──────────────────────────────────────────────────────────────

describe('hashesMatch', () => {
  it('returns true for two identical hash strings', () => {
    const hash = sha256('same content');
    expect(hashesMatch(hash, hash)).toBe(true);
  });

  it('returns false for two different hash strings', () => {
    const a = sha256('content A');
    const b = sha256('content B');
    expect(hashesMatch(a, b)).toBe(false);
  });

  it('returns false when lengths differ', () => {
    const full = sha256('content');
    const partial = full.slice(0, 32);
    expect(hashesMatch(full, partial)).toBe(false);
  });

  it('returns false for two distinct strings that happen to be equal length', () => {
    // Both are 64 chars but contain different content
    const a = 'a'.repeat(64);
    const b = 'b'.repeat(64);
    expect(hashesMatch(a, b)).toBe(false);
  });

  it('returns true for two independent computations of the same input', () => {
    const input = '# Title\n\nBody text.';
    const h1 = sha256(input);
    const h2 = sha256(input);
    expect(hashesMatch(h1, h2)).toBe(true);
  });

  it('handles empty string hashes', () => {
    const emptyHash = sha256('');
    expect(hashesMatch(emptyHash, emptyHash)).toBe(true);
  });

  it('is case-sensitive — uppercase hex does not match lowercase hex', () => {
    const lower = sha256('test');
    const upper = lower.toUpperCase();
    // The comparison is exact — even though both represent the same digest,
    // our implementation stores and compares lowercase only.
    if (lower !== upper) {
      expect(hashesMatch(lower, upper)).toBe(false);
    }
  });
});

// ─── contentDiffersFromHash ───────────────────────────────────────────────────

describe('contentDiffersFromHash', () => {
  it('returns false when content hash matches the stored hash', () => {
    const content = 'My note content';
    const stored = sha256(content);
    expect(contentDiffersFromHash(content, stored)).toBe(false);
  });

  it('returns true when content has been modified', () => {
    const original = 'Original content';
    const stored = sha256(original);
    const modified = 'Modified content';
    expect(contentDiffersFromHash(modified, stored)).toBe(true);
  });

  it('returns true when a single character is added', () => {
    const original = 'content';
    const stored = sha256(original);
    expect(contentDiffersFromHash(original + ' ', stored)).toBe(true);
  });

  it('returns true when a single character is removed', () => {
    const original = 'content';
    const stored = sha256(original);
    expect(contentDiffersFromHash(original.slice(0, -1), stored)).toBe(true);
  });

  it('returns false for empty content matching its own hash', () => {
    const stored = sha256('');
    expect(contentDiffersFromHash('', stored)).toBe(false);
  });

  it('accepts a Buffer as the content argument', () => {
    const str = 'buffer test content';
    const stored = sha256(str);
    const buf = Buffer.from(str, 'utf-8');
    expect(contentDiffersFromHash(buf, stored)).toBe(false);
  });

  it('returns true for a Buffer that differs from the stored hash', () => {
    const stored = sha256('original');
    const buf = Buffer.from('different', 'utf-8');
    expect(contentDiffersFromHash(buf, stored)).toBe(true);
  });
});
