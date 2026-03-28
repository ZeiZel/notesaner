-- Migration: 0010_notifications
--
-- Adds in-app notification system with user preferences and digest scheduling.
--
-- Changes:
--   1. New enum: NotificationType (COMMENT_MENTION, NOTE_SHARED, WORKSPACE_INVITE, SYSTEM_ANNOUNCEMENT)
--   2. New enum: NotificationChannel (IN_APP, EMAIL, BOTH, NONE)
--   3. New enum: DigestFrequency (DAILY, WEEKLY, NONE)
--   4. New table: notifications
--   5. New table: notification_preferences
--   6. New table: notification_digest_schedules

-- ── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE "NotificationType" AS ENUM ('COMMENT_MENTION', 'NOTE_SHARED', 'WORKSPACE_INVITE', 'SYSTEM_ANNOUNCEMENT');
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'BOTH', 'NONE');
CREATE TYPE "DigestFrequency" AS ENUM ('DAILY', 'WEEKLY', 'NONE');

-- ── notifications ────────────────────────────────────────────────────────────

CREATE TABLE notifications (
  id          TEXT              NOT NULL PRIMARY KEY,
  user_id     TEXT              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        "NotificationType" NOT NULL,
  title       TEXT              NOT NULL,
  body        TEXT              NOT NULL,
  is_read     BOOLEAN           NOT NULL DEFAULT FALSE,
  note_id     TEXT              DEFAULT NULL,
  metadata    JSONB             NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_read
  ON notifications (user_id, is_read);

CREATE INDEX idx_notifications_user_created
  ON notifications (user_id, created_at);

CREATE INDEX idx_notifications_type
  ON notifications (type);

-- Index on created_at for efficient cleanup of old notifications
CREATE INDEX idx_notifications_created_at
  ON notifications (created_at);

-- ── notification_preferences ─────────────────────────────────────────────────

CREATE TABLE notification_preferences (
  id          TEXT                NOT NULL PRIMARY KEY,
  user_id     TEXT                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        "NotificationType"  NOT NULL,
  channel     "NotificationChannel" NOT NULL DEFAULT 'BOTH',
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_notification_preferences_user_type
  ON notification_preferences (user_id, type);

-- ── notification_digest_schedules ────────────────────────────────────────────

CREATE TABLE notification_digest_schedules (
  id           TEXT              NOT NULL PRIMARY KEY,
  user_id      TEXT              NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  frequency    "DigestFrequency" NOT NULL DEFAULT 'DAILY',
  last_sent_at TIMESTAMPTZ       DEFAULT NULL,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);
