/**
 * use-note-css-class.ts -- Derives the CSS class from note frontmatter.
 *
 * Reads the `cssClass` or `cssclass` property from the frontmatter store
 * and returns it as a string (or empty string if not set).
 *
 * This allows per-note custom styling via frontmatter, matching Obsidian's
 * behavior where `cssclass: my-custom-note` adds the class to the note
 * view container.
 *
 * Supports both single values and arrays:
 *   cssclass: wide-page
 *   cssClass: [wide-page, no-sidebar]
 *
 * No useEffect needed -- this is a derived calculation from store state.
 */

import { useFrontmatterStore } from '../model/frontmatter.store';

/**
 * Returns the CSS class(es) derived from the active note's frontmatter.
 *
 * Checks for both `cssClass` and `cssclass` keys (Obsidian supports both).
 * Returns a space-separated string of class names, or an empty string.
 *
 * @example
 * ```tsx
 * function EditorContainer() {
 *   const cssClass = useNoteCssClass();
 *   return <div className={cn('editor-container', cssClass)}>...</div>;
 * }
 * ```
 */
export function useNoteCssClass(): string {
  const properties = useFrontmatterStore((s) => s.properties);

  // Check both camelCase and lowercase variants (Obsidian supports both)
  const prop = properties.get('cssClass') ?? properties.get('cssclass');

  if (!prop) return '';

  const { value } = prop;

  if (Array.isArray(value)) {
    // Filter out non-string items and join with space
    return value
      .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
      .map((v) => sanitizeClassName(v))
      .join(' ');
  }

  if (typeof value === 'string' && value.trim() !== '') {
    return sanitizeClassName(value);
  }

  return '';
}

/**
 * Sanitize a class name to prevent CSS injection via class attribute.
 * Only allows alphanumeric characters, hyphens, and underscores.
 * This prevents injection of arbitrary selectors or breaking out of
 * the class attribute.
 */
function sanitizeClassName(name: string): string {
  // Remove any character that is not alphanumeric, hyphen, or underscore
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '');
}
