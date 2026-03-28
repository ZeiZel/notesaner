-- Migration: 0007_api_keys_webhooks
-- Creates tables for the public REST API and webhook system.

-- ── api_keys ─────────────────────────────────────────────────────────────────
--
-- Stores hashed API keys for external REST API access.
-- The raw key value is NEVER stored — only its SHA-256 digest (key_hash).
-- The key_hash column has a unique index enabling O(1) lookup on validation.

CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name          TEXT        NOT NULL,
  -- SHA-256 hex digest of the raw key (raw key never persisted)
  key_hash      TEXT        NOT NULL UNIQUE,
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Array of permission strings, e.g. ARRAY['notes:read', 'notes:write']
  permissions   TEXT[]      NOT NULL DEFAULT '{}',
  is_revoked    BOOLEAN     NOT NULL DEFAULT false,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id      ON api_keys(user_id);

-- ── webhooks ─────────────────────────────────────────────────────────────────
--
-- Webhook subscription registry. Secrets are stored as SHA-256 digests.
-- The `events` column is a text array of WebhookEvent enum values.
-- GIN index accelerates the `events @> ARRAY[event]` containment query.

CREATE TABLE IF NOT EXISTS webhooks (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url           TEXT        NOT NULL,
  -- Array of subscribed event types, e.g. ARRAY['note.created', 'note.updated']
  events        TEXT[]      NOT NULL,
  -- SHA-256 hex digest of the user-facing signing secret
  secret_hash   TEXT        NOT NULL,
  is_active     BOOLEAN     NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks(workspace_id);
-- GIN index on events array for fast containment queries (events @> ARRAY[event])
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN (events);

-- ── webhook_deliveries ───────────────────────────────────────────────────────
--
-- Delivery attempt log for audit trail and retry inspection.
-- Each job enqueue creates one row; status is updated after each attempt.

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id            UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id    UUID        NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event         TEXT        NOT NULL,
  payload       JSONB       NOT NULL DEFAULT '{}',
  status_code   INTEGER,
  success       BOOLEAN     NOT NULL DEFAULT false,
  attempts      INTEGER     NOT NULL DEFAULT 0,
  delivered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);

-- Trigger to keep webhooks.updated_at current on every UPDATE
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhooks_updated_at ON webhooks;
CREATE TRIGGER trg_webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW EXECUTE FUNCTION update_webhooks_updated_at();
