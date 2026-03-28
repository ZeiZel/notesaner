/**
 * Tests for frontmatter-store.ts
 *
 * Covers:
 *   - parseFromYaml — hydrates store from markdown, resets isDirty
 *   - setProperty — auto-detects type, updates properties, sets isDirty
 *   - setPropertyTyped — explicit typed update
 *   - addProperty — adds new key, no-op for existing keys
 *   - removeProperty — removes key, no-op for missing keys
 *   - renameProperty — renames key preserving order and value
 *   - markClean — clears isDirty
 *   - reset — resets entire store
 *   - serializeToYaml — returns correct YAML block
 *   - Selectors: selectProperty, selectCustomProperties, selectSpecialProperties
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  useFrontmatterStore,
  SPECIAL_KEYS,
  selectProperty,
  selectCustomProperties,
  selectSpecialProperties,
} from '../frontmatter-store';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  useFrontmatterStore.setState({
    properties: new Map(),
    isDirty: false,
    activeNoteId: null,
  });
}

function parseNote(markdown: string, id = 'note-1'): void {
  useFrontmatterStore.getState().parseFromYaml(markdown, id);
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// parseFromYaml
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — parseFromYaml', () => {
  it('hydrates properties from valid frontmatter', () => {
    parseNote('---\ntitle: My Note\ntags: [a, b]\n---');
    const { properties } = useFrontmatterStore.getState();
    expect(properties.get('title')?.value).toBe('My Note');
    expect(properties.get('tags')?.value).toEqual(['a', 'b']);
  });

  it('resets isDirty to false after parse', () => {
    // First make it dirty
    parseNote('---\ntitle: Test\n---');
    useFrontmatterStore.getState().setProperty('title', 'Changed');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);

    // Re-parse should clear dirty
    parseNote('---\ntitle: Test\n---');
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });

  it('sets activeNoteId correctly', () => {
    parseNote('---\ntitle: Test\n---', 'note-abc');
    expect(useFrontmatterStore.getState().activeNoteId).toBe('note-abc');
  });

  it('handles markdown without frontmatter', () => {
    parseNote('# Just a heading\n\nNo frontmatter.');
    const { properties, isDirty } = useFrontmatterStore.getState();
    expect(properties.size).toBe(0);
    expect(isDirty).toBe(false);
  });

  it('replaces previously loaded properties', () => {
    parseNote('---\ntitle: First\ncustom: hello\n---');
    parseNote('---\ntitle: Second\n---');
    const { properties } = useFrontmatterStore.getState();
    expect(properties.get('title')?.value).toBe('Second');
    expect(properties.has('custom')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setProperty
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — setProperty', () => {
  beforeEach(() => {
    parseNote('---\ntitle: Test\ncount: 5\npublished: true\n---');
  });

  it('updates an existing string property', () => {
    useFrontmatterStore.getState().setProperty('title', 'Updated Title');
    expect(useFrontmatterStore.getState().properties.get('title')?.value).toBe('Updated Title');
  });

  it('auto-detects number type for numeric string', () => {
    useFrontmatterStore.getState().setProperty('count', '99');
    const prop = useFrontmatterStore.getState().properties.get('count');
    expect(prop?.value).toBe(99);
    expect(prop?.type).toBe('number');
  });

  it('auto-detects boolean type for boolean string', () => {
    useFrontmatterStore.getState().setProperty('published', 'false');
    const prop = useFrontmatterStore.getState().properties.get('published');
    expect(prop?.value).toBe(false);
    expect(prop?.type).toBe('boolean');
  });

  it('sets array directly when passed string[]', () => {
    useFrontmatterStore.getState().setProperty('tags', ['x', 'y', 'z']);
    const prop = useFrontmatterStore.getState().properties.get('tags');
    expect(prop?.value).toEqual(['x', 'y', 'z']);
    expect(prop?.type).toBe('array');
  });

  it('marks store as dirty', () => {
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
    useFrontmatterStore.getState().setProperty('title', 'Changed');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);
  });

  it('creates a new property if key does not exist', () => {
    useFrontmatterStore.getState().setProperty('newKey', 'newValue');
    expect(useFrontmatterStore.getState().properties.has('newKey')).toBe(true);
    expect(useFrontmatterStore.getState().properties.get('newKey')?.value).toBe('newValue');
  });
});

// ---------------------------------------------------------------------------
// setPropertyTyped
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — setPropertyTyped', () => {
  it('sets value with explicit type override', () => {
    parseNote('---\nstatus: 42\n---');
    // Force it to be a string type even though value looks like a number
    useFrontmatterStore.getState().setPropertyTyped('status', '42', 'string');
    const prop = useFrontmatterStore.getState().properties.get('status');
    expect(prop?.type).toBe('string');
    expect(prop?.value).toBe('42');
  });

  it('sets array type', () => {
    parseNote('---\ntags: []\n---');
    useFrontmatterStore.getState().setPropertyTyped('tags', ['a', 'b'], 'array');
    const prop = useFrontmatterStore.getState().properties.get('tags');
    expect(prop?.type).toBe('array');
    expect(prop?.value).toEqual(['a', 'b']);
  });

  it('marks store as dirty', () => {
    parseNote('---\ntitle: Test\n---');
    useFrontmatterStore.getState().setPropertyTyped('title', 'Changed', 'string');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// addProperty
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — addProperty', () => {
  beforeEach(() => {
    parseNote('---\ntitle: Test\n---');
  });

  it('adds a new property with empty string value', () => {
    useFrontmatterStore.getState().addProperty('custom_field');
    const prop = useFrontmatterStore.getState().properties.get('custom_field');
    expect(prop).toBeDefined();
    expect(prop?.value).toBe('');
    expect(prop?.type).toBe('string');
  });

  it('marks store as dirty when adding', () => {
    useFrontmatterStore.getState().addProperty('new_key');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);
  });

  it('is a no-op when key already exists', () => {
    useFrontmatterStore.getState().setProperty('title', 'Original');
    useFrontmatterStore.getState().markClean();

    useFrontmatterStore.getState().addProperty('title');

    expect(useFrontmatterStore.getState().properties.get('title')?.value).toBe('Original');
    // Should not become dirty since nothing changed
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });

  it('new property appears in the map', () => {
    useFrontmatterStore.getState().addProperty('extra');
    expect(useFrontmatterStore.getState().properties.has('extra')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// removeProperty
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — removeProperty', () => {
  beforeEach(() => {
    parseNote('---\ntitle: Test\ncustom: hello\n---');
  });

  it('removes an existing property', () => {
    useFrontmatterStore.getState().removeProperty('custom');
    expect(useFrontmatterStore.getState().properties.has('custom')).toBe(false);
  });

  it('marks store as dirty when removing', () => {
    useFrontmatterStore.getState().removeProperty('custom');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);
  });

  it('is a no-op for missing key (no error, no dirty)', () => {
    useFrontmatterStore.getState().removeProperty('nonexistent');
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
    expect(useFrontmatterStore.getState().properties.size).toBe(2); // title + custom
  });

  it('does not affect other properties', () => {
    useFrontmatterStore.getState().removeProperty('custom');
    expect(useFrontmatterStore.getState().properties.has('title')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// renameProperty
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — renameProperty', () => {
  beforeEach(() => {
    parseNote('---\nfirst: a\nsecond: b\nthird: c\n---');
  });

  it('renames a property key preserving value and type', () => {
    useFrontmatterStore.getState().renameProperty('first', 'renamed');
    const state = useFrontmatterStore.getState();
    expect(state.properties.has('first')).toBe(false);
    expect(state.properties.get('renamed')?.value).toBe('a');
  });

  it('preserves insertion order when renaming', () => {
    useFrontmatterStore.getState().renameProperty('second', 'middle');
    const keys = Array.from(useFrontmatterStore.getState().properties.keys());
    expect(keys).toEqual(['first', 'middle', 'third']);
  });

  it('marks store as dirty', () => {
    useFrontmatterStore.getState().renameProperty('first', 'newname');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);
  });

  it('is a no-op when oldKey does not exist', () => {
    useFrontmatterStore.getState().renameProperty('nonexistent', 'newname');
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });

  it('is a no-op when oldKey === newKey', () => {
    useFrontmatterStore.getState().renameProperty('first', 'first');
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });

  it('is a no-op when newKey already exists (prevents overwrite)', () => {
    useFrontmatterStore.getState().renameProperty('first', 'second');
    // first should still be there
    expect(useFrontmatterStore.getState().properties.has('first')).toBe(true);
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markClean
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — markClean', () => {
  it('sets isDirty to false', () => {
    parseNote('---\ntitle: Test\n---');
    useFrontmatterStore.getState().setProperty('title', 'Changed');
    expect(useFrontmatterStore.getState().isDirty).toBe(true);

    useFrontmatterStore.getState().markClean();
    expect(useFrontmatterStore.getState().isDirty).toBe(false);
  });

  it('does not affect properties', () => {
    parseNote('---\ntitle: Stable\n---');
    useFrontmatterStore.getState().setProperty('title', 'New Title');
    useFrontmatterStore.getState().markClean();

    expect(useFrontmatterStore.getState().properties.get('title')?.value).toBe('New Title');
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — reset', () => {
  it('clears all state', () => {
    parseNote('---\ntitle: Test\ntags: [a, b]\n---', 'note-xyz');
    useFrontmatterStore.getState().setProperty('title', 'Modified');

    useFrontmatterStore.getState().reset();

    const state = useFrontmatterStore.getState();
    expect(state.properties.size).toBe(0);
    expect(state.isDirty).toBe(false);
    expect(state.activeNoteId).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// serializeToYaml
// ---------------------------------------------------------------------------

describe('useFrontmatterStore — serializeToYaml', () => {
  it('returns empty string when no properties', () => {
    expect(useFrontmatterStore.getState().serializeToYaml()).toBe('');
  });

  it('returns YAML block with all properties', () => {
    parseNote('---\ntitle: My Note\ncount: 5\n---');
    const yaml = useFrontmatterStore.getState().serializeToYaml();
    expect(yaml).toContain('title:');
    expect(yaml).toContain('count: 5');
    expect(yaml).toMatch(/^---/);
    expect(yaml).toMatch(/---$/);
  });

  it('does NOT mutate state', () => {
    parseNote('---\ntitle: Test\n---');
    const before = useFrontmatterStore.getState().isDirty;
    useFrontmatterStore.getState().serializeToYaml();
    expect(useFrontmatterStore.getState().isDirty).toBe(before);
  });
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

describe('selectProperty', () => {
  it('returns property by key', () => {
    parseNote('---\ntitle: My Note\n---');
    const { properties } = useFrontmatterStore.getState();
    const prop = selectProperty(properties, 'title');
    expect(prop?.value).toBe('My Note');
  });

  it('returns undefined for missing key', () => {
    const { properties } = useFrontmatterStore.getState();
    expect(selectProperty(properties, 'nonexistent')).toBeUndefined();
  });
});

describe('SPECIAL_KEYS', () => {
  it('contains the expected set of special keys', () => {
    expect(SPECIAL_KEYS.has('title')).toBe(true);
    expect(SPECIAL_KEYS.has('tags')).toBe(true);
    expect(SPECIAL_KEYS.has('aliases')).toBe(true);
    expect(SPECIAL_KEYS.has('date')).toBe(true);
    expect(SPECIAL_KEYS.has('description')).toBe(true);
  });

  it('does not contain arbitrary keys', () => {
    expect(SPECIAL_KEYS.has('custom_field')).toBe(false);
    expect(SPECIAL_KEYS.has('author')).toBe(false);
  });
});

describe('selectCustomProperties', () => {
  it('returns only non-special properties', () => {
    parseNote('---\ntitle: Test\ntags: [a]\nauthor: Alice\ncustom: hello\n---');
    const { properties } = useFrontmatterStore.getState();
    const custom = selectCustomProperties(properties);
    const keys = custom.map((p) => p.key);
    expect(keys).toContain('author');
    expect(keys).toContain('custom');
    expect(keys).not.toContain('title');
    expect(keys).not.toContain('tags');
  });

  it('returns empty array when all properties are special', () => {
    parseNote('---\ntitle: Test\ntags: []\n---');
    const { properties } = useFrontmatterStore.getState();
    expect(selectCustomProperties(properties)).toHaveLength(0);
  });
});

describe('selectSpecialProperties', () => {
  it('returns only special properties', () => {
    parseNote('---\ntitle: Test\nauthor: Alice\ntags: []\n---');
    const { properties } = useFrontmatterStore.getState();
    const special = selectSpecialProperties(properties);
    const keys = special.map((p) => p.key);
    expect(keys).toContain('title');
    expect(keys).toContain('tags');
    expect(keys).not.toContain('author');
  });
});
