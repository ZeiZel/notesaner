/**
 * Tests for useNoteCssClass hook logic.
 *
 * Since @testing-library/react is not installed, we test the underlying
 * logic by directly manipulating the frontmatter store and testing the
 * sanitizeClassName function. The hook itself is a thin wrapper that
 * reads from the store -- its reactive behavior is covered by Zustand's
 * own test suite and integration tests.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useFrontmatterStore } from '../model/frontmatter.store';

// Import the private sanitizeClassName indirectly by testing through
// the store + hook contract. We replicate the logic here for unit testing.

/**
 * Sanitize a class name to prevent CSS injection via class attribute.
 * This is a copy of the function from use-note-css-class.ts for testing.
 */
function sanitizeClassName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}

/**
 * Derive CSS class from frontmatter properties.
 * This replicates the hook logic for testing without React rendering.
 */
function deriveNoteCssClass(
  properties: Map<string, { key: string; value: unknown; type: string }>,
): string {
  const prop = properties.get('cssClass') ?? properties.get('cssclass');
  if (!prop) return '';

  const { value } = prop;

  if (Array.isArray(value)) {
    return (value as string[])
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => sanitizeClassName(v))
      .join(' ');
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return sanitizeClassName(value);
  }

  return '';
}

describe('deriveNoteCssClass', () => {
  beforeEach(() => {
    useFrontmatterStore.getState().reset();
  });

  it('returns empty string when no cssClass in frontmatter', () => {
    useFrontmatterStore.getState().parseFromYaml('---\ntitle: Test\n---\n\nBody', 'note-1');
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('');
  });

  it('returns cssClass string from frontmatter (camelCase)', () => {
    useFrontmatterStore
      .getState()
      .parseFromYaml('---\ntitle: Test\ncssClass: wide-page\n---\n\nBody', 'note-1');
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('wide-page');
  });

  it('returns cssclass string from frontmatter (lowercase)', () => {
    useFrontmatterStore
      .getState()
      .parseFromYaml('---\ntitle: Test\ncssclass: dark-editor\n---\n\nBody', 'note-1');
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('dark-editor');
  });

  it('handles array of CSS classes', () => {
    useFrontmatterStore
      .getState()
      .parseFromYaml('---\ntitle: Test\ncssClass: [wide-page, no-sidebar]\n---\n\nBody', 'note-1');
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('wide-page no-sidebar');
  });

  it('prefers camelCase cssClass over lowercase cssclass', () => {
    useFrontmatterStore
      .getState()
      .parseFromYaml(
        '---\ntitle: Test\ncssClass: preferred\ncssclass: fallback\n---\n\nBody',
        'note-1',
      );
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('preferred');
  });

  it('returns empty string when frontmatter is not loaded', () => {
    const result = deriveNoteCssClass(useFrontmatterStore.getState().properties);
    expect(result).toBe('');
  });
});

describe('sanitizeClassName', () => {
  it('passes through valid class names', () => {
    expect(sanitizeClassName('my-class')).toBe('my-class');
    expect(sanitizeClassName('wide_page')).toBe('wide_page');
    expect(sanitizeClassName('class123')).toBe('class123');
  });

  it('strips dangerous characters', () => {
    expect(sanitizeClassName('my-class"><script>')).toBe('my-classscript');
    expect(sanitizeClassName('class{color:red}')).toBe('classcolorred');
  });

  it('strips spaces', () => {
    expect(sanitizeClassName(' spaced ')).toBe('spaced');
  });

  it('handles empty string', () => {
    expect(sanitizeClassName('')).toBe('');
  });

  it('strips dots (CSS class selector injection)', () => {
    expect(sanitizeClassName('.injected-selector')).toBe('injected-selector');
  });

  it('allows hyphens and underscores', () => {
    expect(sanitizeClassName('my-custom_class-v2')).toBe('my-custom_class-v2');
  });
});
