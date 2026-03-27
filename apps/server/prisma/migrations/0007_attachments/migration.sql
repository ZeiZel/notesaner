-- Create attachments table.
-- Attachments are files uploaded and associated with a specific note.
-- Files are stored on the filesystem under .attachments/<noteId>/<filename>.
-- The `path` column stores the workspace-relative path.
-- Cascade delete ensures attachment records are removed when the parent note
-- is permanently deleted.

CREATE TABLE IF NOT EXISTS attachments (
  id         TEXT        NOT NULL PRIMARY KEY DEFAULT gen_random_uuid()::text,
  note_id    TEXT        NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  filename   TEXT        NOT NULL,
  mime_type  TEXT        NOT NULL,
  size       INTEGER     NOT NULL,
  path       TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attachments_note_id ON attachments (note_id);
