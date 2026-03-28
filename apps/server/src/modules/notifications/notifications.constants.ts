/** BullMQ queue name for notification digest email jobs. */
export const NOTIFICATION_DIGEST_QUEUE = 'notification-digest';

/** BullMQ queue name for notification cleanup jobs. */
export const NOTIFICATION_CLEANUP_QUEUE = 'notification-cleanup';

/** Job name for the daily digest email dispatch. */
export const DAILY_DIGEST_JOB = 'daily-digest';

/** Job name for the weekly digest email dispatch. */
export const WEEKLY_DIGEST_JOB = 'weekly-digest';

/** Job name for the notification cleanup cron job. */
export const CLEANUP_JOB = 'cleanup-old-notifications';

/** Cron expression for the daily digest (every day at 08:00 UTC). */
export const DAILY_DIGEST_CRON = '0 8 * * *';

/** Cron expression for the weekly digest (every Monday at 08:00 UTC). */
export const WEEKLY_DIGEST_CRON = '0 8 * * 1';

/** Cron expression for the cleanup job (every day at 03:00 UTC). */
export const CLEANUP_CRON = '0 3 * * *';

/** Maximum age in days for notifications before auto-deletion. */
export const NOTIFICATION_MAX_AGE_DAYS = 90;

/** Default number of notifications per page. */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maximum number of notifications per page. */
export const MAX_PAGE_LIMIT = 100;

/** Maximum number of notifications to include in a digest email. */
export const DIGEST_MAX_NOTIFICATIONS = 50;

/** Maximum number of notifications allowed per user per hour (rate limit). */
export const RATE_LIMIT_MAX_PER_HOUR = 100;

/** Rate limit window in seconds (1 hour). */
export const RATE_LIMIT_WINDOW_SECONDS = 3600;

/** ValKey key prefix for notification rate limiting. */
export const RATE_LIMIT_KEY_PREFIX = 'notif:rate:';

/** WebSocket event name for new notification push. */
export const WS_NOTIFICATION_NEW = 'notification:new';

/** WebSocket event name for unread count update. */
export const WS_UNREAD_COUNT = 'notification:unread-count';
