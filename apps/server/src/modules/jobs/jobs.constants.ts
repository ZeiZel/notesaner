/** BullMQ queue name for all note-related indexing jobs. */
export const NOTE_INDEX_QUEUE = 'note-index';

/** Job name for single-note indexing (debounced on save). */
export const INDEX_NOTE_JOB = 'index-note';

/** Job name for full workspace reindex (admin batch operation). */
export const REINDEX_WORKSPACE_JOB = 'reindex-workspace';

/** Default debounce delay in milliseconds before indexing after a note save. */
export const INDEX_DEBOUNCE_MS = 2_000;

/** Maximum number of concurrent note-indexing workers. */
export const NOTE_INDEX_CONCURRENCY = 4;

// ─── Webhook delivery ──────────────────────────────────────────────────────

/** BullMQ queue name for webhook delivery jobs. */
export const WEBHOOK_DELIVERY_QUEUE = 'webhook-delivery';

/** Job name for delivering a single webhook payload. */
export const DELIVER_WEBHOOK_JOB = 'deliver-webhook';

/** Maximum number of delivery attempts before permanently failing. */
export const WEBHOOK_MAX_ATTEMPTS = 3;

/**
 * Base delay in milliseconds for exponential back-off.
 * BullMQ exponential: attempt 1 = 1s, attempt 2 = 10s, attempt 3 = ~60s
 */
export const WEBHOOK_BACKOFF_BASE_DELAY_MS = 1_000;

/** HTTP timeout for webhook delivery requests (milliseconds). */
export const WEBHOOK_DELIVERY_TIMEOUT_MS = 10_000;

/** Number of consecutive failures before auto-disabling a webhook. */
export const WEBHOOK_AUTO_DISABLE_THRESHOLD = 10;

/** Maximum number of active webhooks per workspace. */
export const WEBHOOK_MAX_PER_WORKSPACE = 10;

/** Maximum number of concurrent webhook delivery workers. */
export const WEBHOOK_DELIVERY_CONCURRENCY = 4;

// ─── Freshness check ────────────────────────────────────────────────────────

/** BullMQ queue name for freshness check jobs. */
export const FRESHNESS_CHECK_QUEUE = 'freshness-check';

/** Job name for daily staleness check across all workspaces. */
export const FRESHNESS_CHECK_JOB = 'freshness-daily-check';

/** Cron expression for the daily freshness check (every day at 06:00 UTC). */
export const FRESHNESS_CHECK_CRON = '0 6 * * *';

// ─── Storage recalculation ─────────────────────────────────────────────────

/** BullMQ queue name for storage recalculation jobs. */
export const STORAGE_RECALCULATION_QUEUE = 'storage-recalculation';

/** Job name for daily storage recalculation across all workspaces. */
export const STORAGE_RECALCULATION_JOB = 'storage-daily-recalculation';

/** Cron expression for the daily storage recalculation (every day at 03:00 UTC). */
export const STORAGE_RECALCULATION_CRON = '0 3 * * *';

// ─── Trash purge ───────────────────────────────────────────────────────────

/** BullMQ queue name for trash purge jobs. */
export const TRASH_PURGE_QUEUE = 'trash-purge';

/** Job name for daily purge of notes expired from trash. */
export const TRASH_PURGE_JOB = 'trash-daily-purge';

/** Cron expression for the daily trash purge (every day at 02:00 UTC). */
export const TRASH_PURGE_CRON = '0 2 * * *';

// ─── Attachment cleanup ────────────────────────────────────────────────────

/** BullMQ queue name for attachment cleanup jobs. */
export const QUEUE_ATTACHMENT_CLEANUP = 'attachment-cleanup';

/** Job name for cleaning up orphaned attachment records and files. */
export const JOB_CLEANUP_ATTACHMENTS = 'cleanup-attachments';
