-- Migration: 0015_api_key_enhancements
-- Adds request_count and rotated_to_id to the user_api_keys table.
--
-- request_count: cumulative counter of successful validation requests.
--   Updated atomically via UPDATE ... SET request_count = request_count + 1
--   on every successful key validation (fire-and-forget, same as last_used_at).
--
-- rotated_to_id: references the replacement key created during rotation.
--   When a key is rotated, the old key's rotated_to_id is set to the new key's
--   ID and the old key is revoked immediately. This creates an audit trail
--   linking old and new keys.

-- ── Add request_count ─────────────────────────────────────────────────────────
ALTER TABLE "user_api_keys"
  ADD COLUMN IF NOT EXISTS "request_count" INTEGER NOT NULL DEFAULT 0;

-- ── Add rotated_to_id ─────────────────────────────────────────────────────────
-- Self-referential: points to the replacement key created during rotation.
-- No FK constraint here to avoid circular dependency issues on migration order;
-- referential integrity is enforced at the application layer.
ALTER TABLE "user_api_keys"
  ADD COLUMN IF NOT EXISTS "rotated_to_id" TEXT;
