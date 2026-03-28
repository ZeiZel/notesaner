-- Migration: 0008_typed_links
--
-- Adds Zettelkasten-style typed link relationships to the note graph.
-- A "relationship type" (e.g. relates-to, contradicts, supports) is separate
-- from the "link type" (WIKI/MARKDOWN/EMBED/BLOCK_REF) which describes syntax.
--
-- New table: link_relationship_types
--   Stores both built-in and user-defined relationship types per workspace.
--   Built-in types have workspace_id = NULL.
--
-- New column: note_links.relationship_type_id
--   Nullable FK to link_relationship_types. NULL = untyped link.

-- ─── link_relationship_types ───────────────────────────────────────────────

CREATE TABLE link_relationship_types (
  id           TEXT        NOT NULL PRIMARY KEY,
  workspace_id TEXT        REFERENCES workspaces(id) ON DELETE CASCADE,
  slug         TEXT        NOT NULL,  -- e.g. "relates-to", "contradicts"
  label        TEXT        NOT NULL,  -- e.g. "Relates to", "Contradicts"
  color        TEXT        NOT NULL DEFAULT '#6366f1',  -- CSS color for visual distinction
  description  TEXT        DEFAULT NULL,
  is_built_in  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Uniqueness: slug must be unique per workspace (NULL workspace = global built-ins)
CREATE UNIQUE INDEX idx_link_rel_type_workspace_slug
  ON link_relationship_types (COALESCE(workspace_id, ''), slug);

CREATE INDEX idx_link_rel_type_workspace
  ON link_relationship_types (workspace_id);

-- ─── Seed built-in relationship types ─────────────────────────────────────

INSERT INTO link_relationship_types (id, workspace_id, slug, label, color, description, is_built_in)
VALUES
  ('lrt-relates-to',       NULL, 'relates-to',      'Relates to',       '#6366f1', 'General relationship between notes',              TRUE),
  ('lrt-contradicts',      NULL, 'contradicts',      'Contradicts',      '#ef4444', 'This note contradicts the linked note',            TRUE),
  ('lrt-supports',         NULL, 'supports',         'Supports',         '#10b981', 'This note supports or backs up the linked note',   TRUE),
  ('lrt-extends',          NULL, 'extends',          'Extends',          '#3b82f6', 'This note extends or elaborates on the linked note', TRUE),
  ('lrt-example-of',       NULL, 'example-of',       'Example of',       '#f59e0b', 'This note is a concrete example of the linked note', TRUE),
  ('lrt-source',           NULL, 'source',           'Source',           '#8b5cf6', 'The linked note is a primary source',              TRUE),
  ('lrt-continuation',     NULL, 'continuation',     'Continuation',     '#14b8a6', 'This note continues the thought from the linked note', TRUE),
  ('lrt-counterargument',  NULL, 'counterargument',  'Counterargument',  '#f97316', 'This note presents a counterargument to the linked note', TRUE);

-- ─── Add relationship_type_id to note_links ─────────────────────────────────

ALTER TABLE note_links
  ADD COLUMN IF NOT EXISTS "relationship_type_id" TEXT DEFAULT NULL
  REFERENCES link_relationship_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_note_links_relationship_type
  ON note_links ("relationship_type_id");
