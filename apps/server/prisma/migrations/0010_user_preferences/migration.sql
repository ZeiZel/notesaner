-- Migration: 0010_user_preferences
--
-- Adds user preferences storage for per-user settings.
--
-- Changes:
--   1. New table: user_preferences
--      - Stores key-value pairs per user with JSONB values
--      - Unique constraint on (user_id, key) for upsert support

-- ── user_preferences ─────────────────────────────────────────────────────────

CREATE TABLE user_preferences (
  id          TEXT        NOT NULL PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key         TEXT        NOT NULL,
  value       JSONB       NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_user_preferences_user_key UNIQUE (user_id, key)
);

CREATE INDEX idx_user_preferences_user_id
  ON user_preferences (user_id);
