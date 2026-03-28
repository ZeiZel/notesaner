/**
 * Built-in Zettelkasten relationship types for wiki links.
 *
 * These are the default relationship types that can be assigned to wiki links
 * in the editor. Workspaces can extend this with custom types via the API.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RelationshipTypeDef {
  slug: string;
  label: string;
  color: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Built-in relationship types
// ---------------------------------------------------------------------------

export const BUILT_IN_RELATIONSHIP_TYPES: readonly RelationshipTypeDef[] = [
  {
    slug: 'related',
    label: 'Related',
    color: '#89b4fa',
    description: 'General relationship between notes',
  },
  {
    slug: 'supports',
    label: 'Supports',
    color: '#a6e3a1',
    description: 'This note supports or provides evidence for the linked note',
  },
  {
    slug: 'contradicts',
    label: 'Contradicts',
    color: '#f38ba8',
    description: 'This note contradicts or disagrees with the linked note',
  },
  {
    slug: 'extends',
    label: 'Extends',
    color: '#cba6f7',
    description: 'This note extends or builds upon the linked note',
  },
  {
    slug: 'example-of',
    label: 'Example of',
    color: '#fab387',
    description: 'This note is an example or instance of the linked concept',
  },
  {
    slug: 'source',
    label: 'Source',
    color: '#f9e2af',
    description: 'The linked note is a source or reference for this note',
  },
] as const;
