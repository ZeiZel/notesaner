import { describe, it, expect } from 'vitest';
import { slugify } from '../slugify';

describe('slugify', () => {
  it('lowercases the input', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('my note title')).toBe('my-note-title');
  });

  it('replaces underscores with hyphens', () => {
    expect(slugify('my_note_title')).toBe('my-note-title');
  });

  it('trims leading and trailing whitespace', () => {
    expect(slugify('  hello  ')).toBe('hello');
  });

  it('removes special characters', () => {
    expect(slugify('Hello, World!')).toBe('hello-world');
  });

  it('removes leading and trailing hyphens', () => {
    // Characters stripped at start/end should not leave orphan hyphens.
    expect(slugify('!hello!')).toBe('hello');
  });

  it('collapses multiple spaces into a single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('handles an already-slug string unchanged', () => {
    expect(slugify('my-note')).toBe('my-note');
  });

  it('handles a string with only special characters', () => {
    expect(slugify('!!!')).toBe('');
  });

  it('handles an empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('preserves numbers', () => {
    expect(slugify('Note 42')).toBe('note-42');
  });

  it('handles mixed case with punctuation', () => {
    expect(slugify("Zeizel's Quick Notes")).toBe('zeizels-quick-notes');
  });
});
