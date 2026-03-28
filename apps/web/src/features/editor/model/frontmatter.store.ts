// NOTE: Business store — manages note frontmatter (YAML metadata). Not persisted
// to localStorage (data comes from note content). Domain logic includes parsing,
// serialization, type detection, and property manipulation.
/**
 * frontmatter-store.ts
 *
 * Zustand store for managing frontmatter properties of the active note.
 *
 * This store is the single source of truth for frontmatter while editing.
 * Components read from it; the editor syncs it when a note is loaded or saved.
 *
 * Lifecycle:
 *   1. When a note opens, call `parseFromYaml(markdown)` to hydrate the store.
 *   2. Components call `setProperty / addProperty / removeProperty` to mutate.
 *   3. Before save, call `serializeToYaml()` to get the updated frontmatter block.
 *   4. Call `markClean()` after the note is persisted.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  parseFrontmatter,
  serializeFrontmatter,
  detectValueType,
  coerceValue,
  type FrontmatterMap,
  type FrontmatterProperty,
  type FrontmatterValueType,
} from '../lib/frontmatter-parser';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FrontmatterState {
  /** Ordered map of all frontmatter properties. */
  properties: FrontmatterMap;

  /** True when properties have been modified since last parse/markClean. */
  isDirty: boolean;

  /** ID of the note currently loaded in this store. Prevents stale updates. */
  activeNoteId: string | null;

  // ---- Actions ----

  /**
   * Parses a markdown string, extracts frontmatter, and hydrates the store.
   * Resets isDirty to false.
   */
  parseFromYaml: (markdown: string, noteId: string) => void;

  /**
   * Returns the serialized YAML frontmatter block (e.g. ---\nkey: val\n---).
   * Does NOT mutate state.
   */
  serializeToYaml: () => string;

  /**
   * Sets (or updates) a property value. Type is auto-detected from the raw
   * string representation. Pass the value as its native JS type.
   */
  setProperty: (key: string, value: string | number | boolean | string[]) => void;

  /**
   * Explicitly sets a property with a known type, bypassing auto-detection.
   */
  setPropertyTyped: (
    key: string,
    value: FrontmatterProperty['value'],
    type: FrontmatterValueType,
  ) => void;

  /**
   * Adds a new property with a default empty-string value.
   * No-op if key already exists.
   */
  addProperty: (key: string) => void;

  /**
   * Removes a property by key. No-op if key doesn't exist.
   */
  removeProperty: (key: string) => void;

  /**
   * Renames a property key, preserving value and type, and maintaining order.
   * No-op if oldKey doesn't exist or newKey already exists (would overwrite).
   */
  renameProperty: (oldKey: string, newKey: string) => void;

  /**
   * Marks the store as clean (no unsaved changes).
   * Call after the note content has been persisted.
   */
  markClean: () => void;

  /**
   * Clears all properties and resets state.
   */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFrontmatterStore = create<FrontmatterState>()(
  devtools(
    (set, get) => ({
      properties: new Map(),
      isDirty: false,
      activeNoteId: null,

      parseFromYaml: (markdown, noteId) => {
        const { properties } = parseFrontmatter(markdown);
        set(
          { properties, isDirty: false, activeNoteId: noteId },
          false,
          'frontmatter/parseFromYaml',
        );
      },

      serializeToYaml: () => {
        return serializeFrontmatter(get().properties);
      },

      setProperty: (key, value) => {
        set(
          (state) => {
            const next: FrontmatterMap = new Map(state.properties);

            if (Array.isArray(value)) {
              next.set(key, { key, value: value as string[], type: 'array' });
            } else {
              const raw = String(value);
              const type = detectValueType(raw);
              const coerced = coerceValue(raw, type);
              next.set(key, { key, value: coerced, type });
            }

            return { properties: next, isDirty: true };
          },
          false,
          'frontmatter/setProperty',
        );
      },

      setPropertyTyped: (key, value, type) => {
        set(
          (state) => {
            const next: FrontmatterMap = new Map(state.properties);
            next.set(key, { key, value, type });
            return { properties: next, isDirty: true };
          },
          false,
          'frontmatter/setPropertyTyped',
        );
      },

      addProperty: (key) => {
        const { properties } = get();
        if (properties.has(key)) return;

        set(
          (state) => {
            const next: FrontmatterMap = new Map(state.properties);
            next.set(key, { key, value: '', type: 'string' });
            return { properties: next, isDirty: true };
          },
          false,
          'frontmatter/addProperty',
        );
      },

      removeProperty: (key) => {
        const { properties } = get();
        if (!properties.has(key)) return;

        set(
          (state) => {
            const next: FrontmatterMap = new Map(state.properties);
            next.delete(key);
            return { properties: next, isDirty: true };
          },
          false,
          'frontmatter/removeProperty',
        );
      },

      renameProperty: (oldKey, newKey) => {
        const { properties } = get();
        if (!properties.has(oldKey)) return;
        if (oldKey === newKey) return;
        if (properties.has(newKey)) return; // would overwrite

        set(
          (state) => {
            const next: FrontmatterMap = new Map();

            // Rebuild map preserving insertion order
            for (const [k, prop] of state.properties) {
              if (k === oldKey) {
                next.set(newKey, { ...prop, key: newKey });
              } else {
                next.set(k, prop);
              }
            }

            return { properties: next, isDirty: true };
          },
          false,
          'frontmatter/renameProperty',
        );
      },

      markClean: () => {
        set({ isDirty: false }, false, 'frontmatter/markClean');
      },

      reset: () => {
        set(
          { properties: new Map(), isDirty: false, activeNoteId: null },
          false,
          'frontmatter/reset',
        );
      },
    }),
    { name: 'FrontmatterStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Returns the value of a specific property, or undefined if not present. */
export function selectProperty(
  properties: FrontmatterMap,
  key: string,
): FrontmatterProperty | undefined {
  return properties.get(key);
}

/** Returns all properties as a sorted array (special keys first). */
export function selectSortedProperties(properties: FrontmatterMap): FrontmatterProperty[] {
  return Array.from(properties.values());
}

/** Returns custom properties (everything except special keys). */
export const SPECIAL_KEYS = new Set([
  'title',
  'tags',
  'aliases',
  'date',
  'description',
  'cssClass',
  'cssclass',
]);

export function selectCustomProperties(properties: FrontmatterMap): FrontmatterProperty[] {
  return Array.from(properties.values()).filter((p) => !SPECIAL_KEYS.has(p.key));
}

export function selectSpecialProperties(properties: FrontmatterMap): FrontmatterProperty[] {
  return Array.from(properties.values()).filter((p) => SPECIAL_KEYS.has(p.key));
}
