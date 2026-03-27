-- Migration: Add full-text search vector column to notes table
-- Uses PostgreSQL tsvector with weighted components:
--   Weight A — title (highest relevance)
--   Weight B — headings extracted from markdown
--   Weight C — body content
--   Weight D — tags (lowest but still searchable)

-- Add search_vector column
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "search_vector" tsvector;

-- Add GIN index for fast full-text search queries
CREATE INDEX IF NOT EXISTS "notes_search_vector_idx"
  ON "notes" USING GIN ("search_vector");

-- Add frontmatter_search column for structured property search
ALTER TABLE "notes" ADD COLUMN IF NOT EXISTS "frontmatter_search" tsvector;

CREATE INDEX IF NOT EXISTS "notes_frontmatter_search_idx"
  ON "notes" USING GIN ("frontmatter_search");

-- Helper function to build the weighted tsvector for a note.
-- Called by the application layer via Prisma.$executeRaw.
-- Arguments:
--   p_note_id      UUID of the note to index
--   p_title        Note title (weight A)
--   p_headings     Space-separated heading text (weight B)
--   p_body         Plain-text body without headings (weight C)
--   p_tags         Space-separated tag names (weight D)
--   p_frontmatter  JSON string of frontmatter values (weight D)
--   p_lang         Text-search configuration, e.g. 'english'
CREATE OR REPLACE FUNCTION update_note_search_vector(
  p_note_id      UUID,
  p_title        TEXT,
  p_headings     TEXT,
  p_body         TEXT,
  p_tags         TEXT,
  p_frontmatter  TEXT,
  p_lang         REGCONFIG DEFAULT 'english'
) RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  UPDATE "notes"
  SET
    "search_vector" = (
      setweight(to_tsvector(p_lang, coalesce(p_title, '')),    'A') ||
      setweight(to_tsvector(p_lang, coalesce(p_headings, '')), 'B') ||
      setweight(to_tsvector(p_lang, coalesce(p_body, '')),     'C') ||
      setweight(to_tsvector(p_lang, coalesce(p_tags, '')),     'D')
    ),
    "frontmatter_search" = to_tsvector(p_lang, coalesce(p_frontmatter, ''))
  WHERE "id" = p_note_id;
END;
$$;
