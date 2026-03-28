-- Migration: 0009_password_reset_email_verification
--
-- Adds email verification and password reset token support.
--
-- Changes:
--   1. New column: users.is_email_verified (BOOLEAN, default FALSE)
--   2. New table: password_reset_tokens
--   3. New table: email_verification_tokens
--
-- Both token tables store SHA-256 hashes of the actual tokens (never plaintext).
-- Tokens have an expiry timestamp and a nullable used_at for single-use enforcement.

-- ── Add is_email_verified to users ────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "is_email_verified" BOOLEAN NOT NULL DEFAULT FALSE;

-- ── password_reset_tokens ─────────────────────────────────────────────────────

CREATE TABLE password_reset_tokens (
  id          TEXT        NOT NULL PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_password_reset_tokens_user_id
  ON password_reset_tokens (user_id);

CREATE INDEX idx_password_reset_tokens_expires_at
  ON password_reset_tokens (expires_at);

-- ── email_verification_tokens ─────────────────────────────────────────────────

CREATE TABLE email_verification_tokens (
  id          TEXT        NOT NULL PRIMARY KEY,
  user_id     TEXT        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ DEFAULT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_verification_tokens_user_id
  ON email_verification_tokens (user_id);

CREATE INDEX idx_email_verification_tokens_expires_at
  ON email_verification_tokens (expires_at);
