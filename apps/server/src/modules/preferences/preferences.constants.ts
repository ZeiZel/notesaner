/**
 * Valid preference key namespace prefixes.
 * All preference keys must start with one of these namespaces.
 */
export const PREFERENCE_NAMESPACES = [
  'theme',
  'editor',
  'sidebar',
  'notifications',
  'keybindings',
  'favorites',
] as const;

export type PreferenceNamespace = (typeof PREFERENCE_NAMESPACES)[number];

/**
 * Maximum number of preference keys a single user may store.
 */
export const MAX_PREFERENCES_PER_USER = 100;

/**
 * Maximum size in bytes for a single preference value (64 KB).
 * Measured as the byte length of the JSON-serialized value.
 */
export const MAX_PREFERENCE_VALUE_BYTES = 64 * 1024;

/**
 * Default TTL for cached preferences: 5 minutes (in seconds).
 */
export const CACHE_TTL_SECONDS = 300;

/**
 * Default preference values, keyed by preference key.
 * When a user has no stored value for a key, the default is returned.
 *
 * These defaults are merged into the response from getAll() and used
 * as fallback in getByKey() when no stored value exists.
 */
export const DEFAULT_PREFERENCES: Record<string, unknown> = {
  'theme.mode': 'system',
  'theme.accentColor': '#1677ff',
  'editor.fontSize': 16,
  'editor.fontFamily': 'Inter',
  'editor.lineHeight': 1.6,
  'editor.tabSize': 2,
  'editor.wordWrap': true,
  'editor.spellcheck': true,
  'editor.autoSave': true,
  'editor.autoSaveDelay': 500,
  'sidebar.collapsed': false,
  'sidebar.width': 280,
  'sidebar.showTags': true,
  'sidebar.showBacklinks': true,
  'notifications.enabled': true,
  'notifications.sound': true,
  'notifications.desktop': false,
  'keybindings.preset': 'default',
  'favorites.noteIds': [],
};
