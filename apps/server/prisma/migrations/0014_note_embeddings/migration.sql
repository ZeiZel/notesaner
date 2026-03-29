-- Migration: Add NoteEmbedding table with pgvector for semantic search
--
-- Requires the pgvector extension. The extension is created with IF NOT EXISTS
-- so this migration is safe to run even if pgvector is already enabled.
-- The default embedding dimension is 1536 (OpenAI text-embedding-3-small /
-- text-embedding-ada-002). The dimension is fixed at the column level; if you
-- switch to a different model with a different dimensionality you will need a
-- separate migration to recreate the column.

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- NoteEmbedding stores one embedding vector per note.
-- noteId is both PK and FK — one-to-one with notes.
CREATE TABLE "note_embeddings" (
  "id"          TEXT        NOT NULL,   -- note UUID (matches notes.id)
  "note_id"     TEXT        NOT NULL,
  "workspace_id" TEXT       NOT NULL,
  "model"       TEXT        NOT NULL,   -- model identifier used for this embedding
  "embedding"   vector(1536) NOT NULL,  -- 1536-dim for OpenAI models
  "content_hash" TEXT       NOT NULL,  -- SHA-256 of the content at index time
  "created_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at"  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT "note_embeddings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one embedding per note
CREATE UNIQUE INDEX "note_embeddings_note_id_key"
  ON "note_embeddings" ("note_id");

-- Index for workspace-scoped queries
CREATE INDEX "note_embeddings_workspace_id_idx"
  ON "note_embeddings" ("workspace_id");

-- IVFFlat approximate nearest-neighbour index for cosine similarity.
-- lists=100 is a sensible default for up to ~1 million vectors.
-- Rebuild with a higher lists value if the collection grows significantly.
CREATE INDEX "note_embeddings_embedding_ivfflat_idx"
  ON "note_embeddings"
  USING ivfflat ("embedding" vector_cosine_ops)
  WITH (lists = 100);

-- Foreign key: cascade delete embeddings when the note is removed
ALTER TABLE "note_embeddings"
  ADD CONSTRAINT "note_embeddings_note_id_fkey"
  FOREIGN KEY ("note_id")
  REFERENCES "notes" ("id")
  ON DELETE CASCADE;
