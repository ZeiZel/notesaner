/** BullMQ queue name for notification digest email jobs. */
export const NOTIFICATION_DIGEST_QUEUE = 'notification-digest';

/** Job name for the daily digest email dispatch. */
export const DAILY_DIGEST_JOB = 'daily-digest';

/** Job name for the weekly digest email dispatch. */
export const WEEKLY_DIGEST_JOB = 'weekly-digest';

/** Cron expression for the daily digest (every day at 08:00 UTC). */
export const DAILY_DIGEST_CRON = '0 8 * * *';

/** Cron expression for the weekly digest (every Monday at 08:00 UTC). */
export const WEEKLY_DIGEST_CRON = '0 8 * * 1';

/** Default number of notifications per page. */
export const DEFAULT_PAGE_LIMIT = 20;

/** Maximum number of notifications per page. */
export const MAX_PAGE_LIMIT = 100;

/** Maximum number of notifications to include in a digest email. */
export const DIGEST_MAX_NOTIFICATIONS = 50;
