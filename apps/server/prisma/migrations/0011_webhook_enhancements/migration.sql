-- Migration: 0011_webhook_enhancements
-- Adds fields required by the full webhook delivery system:
--   - failure_count on webhooks for auto-disable after 10 consecutive failures
--   - response_time_ms on webhook_deliveries for latency tracking
--   - Constraint: max 10 active webhooks per workspace (enforced at app level,
--     but we add a partial index to assist)

-- ── webhooks: add consecutive failure tracking ──────────────────────────────
ALTER TABLE webhooks
  ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;

-- ── webhook_deliveries: add response time tracking ──────────────────────────
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- Partial index on active webhooks per workspace for efficient count queries
CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_active
  ON webhooks(workspace_id) WHERE is_active = true;
