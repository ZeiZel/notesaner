/** BullMQ queue name for activity cleanup jobs. */
export const ACTIVITY_CLEANUP_QUEUE = 'activity-cleanup';

/** Job name for the activity cleanup cron job. */
export const ACTIVITY_CLEANUP_JOB = 'cleanup-old-activity';

/** Cron expression for activity cleanup (every day at 04:00 UTC). */
export const ACTIVITY_CLEANUP_CRON = '0 4 * * *';

/** Maximum age in days for activity logs before auto-deletion. */
export const ACTIVITY_MAX_AGE_DAYS = 90;

/** Default number of activity items per page. */
export const DEFAULT_ACTIVITY_PAGE_LIMIT = 20;

/** Maximum number of activity items per page. */
export const MAX_ACTIVITY_PAGE_LIMIT = 100;

/** WebSocket event name for new activity push. */
export const WS_ACTIVITY_NEW = 'activity:new';

/** Regex pattern for @mention detection in note content. */
export const MENTION_REGEX = /@([\w.-]+)/g;
