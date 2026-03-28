/**
 * TypedWikiLink — TipTap extension that adds Zettelkasten relationship type
 * annotations to wiki link nodes.
 *
 * This extension does NOT modify wiki-link.ts. Instead it extends the WikiLink
 * node definition by:
 *   1. Registering an additional `relationshipType` attribute on the existing
 *      `wikiLink` node schema.
 *   2. Providing a `setWikiLinkType` command to annotate an existing link.
 *   3. Exposing `RELATIONSHIP_TYPE_COLORS` for editors and the graph view to
 *      look up the color for a given type slug.
 *
 * The visual distinction (colored underline) is applied in CSS using the
 * `data-relationship-type` attribute rendered by this extension.
 *
 * Usage:
 * ```ts
 * import { WikiLink, TypedWikiLink } from '@notesaner/editor-core';
 *
 * // Register TypedWikiLink AFTER WikiLink in the extensions array.
 * // TypedWikiLink patches the wikiLink node schema — it must not replace it.
 * const extensions = [
 *   WikiLink.configure({ ... }),
 *   TypedWikiLink.configure({ ... }),
 * ];
 * ```
 *
 * Note on architecture:
 *   - The `relationshipType` attribute is a runtime annotation only.
 *     It is stored in the Prosemirror document as `data-relationship-type` in HTML.
 *   - The canonical source of truth for the type is the NoteLink.relationshipTypeId
 *     on the backend; the in-editor attribute is populated on load from the API.
 *   - Serialization back to Markdown does NOT include the type — relationship types
 *     are metadata stored in the database, not encoded in the .md file.
 */

import { Extension } from '@tiptap/core';

// ---------------------------------------------------------------------------
// Built-in relationship type definitions (mirrors backend seed data)
// ---------------------------------------------------------------------------

export interface RelationshipTypeDef {
  slug: string;
  label: string;
  /** CSS hex color for the underline. */
  color: string;
  description: string;
}

/**
 * Built-in Zettelkasten relationship types with their canonical colors.
 * Keyed by slug for O(1) lookup.
 */
export const BUILT_IN_RELATIONSHIP_TYPES: readonly RelationshipTypeDef[] = [
  {
    slug: 'relates-to',
    label: 'Relates to',
    color: '#6366f1',
    description: 'General relationship between notes',
  },
  {
    slug: 'contradicts',
    label: 'Contradicts',
    color: '#ef4444',
    description: 'This note contradicts the linked note',
  },
  {
    slug: 'supports',
    label: 'Supports',
    color: '#10b981',
    description: 'This note supports or backs up the linked note',
  },
  {
    slug: 'extends',
    label: 'Extends',
    color: '#3b82f6',
    description: 'This note extends or elaborates on the linked note',
  },
  {
    slug: 'example-of',
    label: 'Example of',
    color: '#f59e0b',
    description: 'This note is a concrete example of the linked note',
  },
  {
    slug: 'source',
    label: 'Source',
    color: '#8b5cf6',
    description: 'The linked note is a primary source',
  },
  {
    slug: 'continuation',
    label: 'Continuation',
    color: '#14b8a6',
    description: 'This note continues the thought from the linked note',
  },
  {
    slug: 'counterargument',
    label: 'Counterargument',
    color: '#f97316',
    description: 'This note presents a counterargument to the linked note',
  },
] as const;

/**
 * A map from slug → color string.
 * Includes all built-in types. Custom types must be merged in by the host app.
 */
export const RELATIONSHIP_TYPE_COLORS: Record<string, string> = Object.fromEntries(
  BUILT_IN_RELATIONSHIP_TYPES.map((t) => [t.slug, t.color]),
);

/**
 * Returns the display color for a given relationship type slug.
 * Falls back to a neutral grey when the slug is unknown.
 */
export function getRelationshipTypeColor(
  slug: string | null | undefined,
  customColors: Record<string, string> = {},
): string {
  if (!slug) return 'inherit';
  return customColors[slug] ?? RELATIONSHIP_TYPE_COLORS[slug] ?? '#94a3b8';
}

// ---------------------------------------------------------------------------
// TipTap Commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    typedWikiLink: {
      /**
       * Set the relationship type annotation on the wiki link node at the
       * current cursor position (or selection).
       *
       * Pass `null` to clear the annotation.
       *
       * @param slug - The relationship type slug (e.g. "relates-to"), or null.
       */
      setWikiLinkType: (slug: string | null) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension options
// ---------------------------------------------------------------------------

export interface TypedWikiLinkOptions {
  /**
   * Map of slug → color for custom workspace-defined relationship types.
   * The extension merges these with the built-in colors when rendering.
   * Update this via `editor.extensionManager.extensions.find(...)` after
   * loading custom types from the API.
   */
  customTypeColors?: Record<string, string>;

  /**
   * Called when the user sets a relationship type via the right-click menu.
   * Use this hook to persist the change to the backend API.
   *
   * @param noteLinkId        - The backend NoteLink ID (stored in the node attr)
   * @param relationshipTypeId - The backend ID of the chosen type, or null to clear
   */
  onSetRelationshipType?: (noteLinkId: string, relationshipTypeId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * TypedWikiLink — adds relationship type attributes and commands to wiki links.
 *
 * This is a headless TipTap Extension (not a Node). It patches the existing
 * wikiLink node schema's attribute set and registers new editor commands.
 */
export const TypedWikiLink = Extension.create<TypedWikiLinkOptions>({
  name: 'typedWikiLink',

  addOptions() {
    return {
      customTypeColors: {},
      onSetRelationshipType: undefined,
    };
  },

  /**
   * Extend the existing wikiLink node with two additional attributes:
   *   - `relationshipType`: the slug (e.g. "relates-to"), used for styling
   *   - `noteLinkId`: the backend NoteLink UUID, used to persist the type
   *
   * These attributes are serialised to HTML data attributes so they survive
   * copy/paste and HTML export, but they are NOT written to Markdown.
   */
  addGlobalAttributes() {
    return [
      {
        types: ['wikiLink'],
        attributes: {
          relationshipType: {
            default: null,
            parseHTML: (el: Element) => el.getAttribute('data-relationship-type') ?? null,
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs['relationshipType']) return {};
              return { 'data-relationship-type': attrs['relationshipType'] };
            },
          },
          noteLinkId: {
            default: null,
            parseHTML: (el: Element) => el.getAttribute('data-note-link-id') ?? null,
            renderHTML: (attrs: Record<string, unknown>) => {
              if (!attrs['noteLinkId']) return {};
              return { 'data-note-link-id': attrs['noteLinkId'] };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setWikiLinkType:
        (slug: string | null) =>
        // TipTap command helpers: state, dispatch, editor are provided by the command runner
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ state, dispatch, editor }: any) => {
          const { selection } = state;
          const { $from } = selection;

          // Find the wikiLink node at or around the cursor
          const node = $from.nodeAfter;
          if (!node || node.type.name !== 'wikiLink') return false;

          const noteLinkId: string | null =
            ((node.attrs as Record<string, unknown>)['noteLinkId'] as string | null) ?? null;

          if (dispatch) {
            const { tr } = state;
            tr.setNodeMarkup($from.pos, undefined, {
              ...node.attrs,
              relationshipType: slug,
            });
            dispatch(tr);

            // Notify host application to persist to backend
            const ext = editor.extensionManager.extensions.find(
              (e: { name: string }) => e.name === 'typedWikiLink',
            );
            if (ext && noteLinkId) {
              const options = ext.options as TypedWikiLinkOptions;
              options.onSetRelationshipType?.(noteLinkId, slug ?? null);
            }
          }

          return true;
        },
    };
  },
});
