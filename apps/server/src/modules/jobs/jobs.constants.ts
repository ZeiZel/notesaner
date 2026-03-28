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

// ─── Freshness check ────────────────────────────────────────────────────────

/** BullMQ queue name for freshness check jobs. */
export const FRESHNESS_CHECK_QUEUE = 'freshness-check';

/** Job name for daily staleness check across all workspaces. */
export const FRESHNESS_CHECK_JOB = 'freshness-daily-check';

/** Cron expression for the daily freshness check (every day at 06:00 UTC). */
export const FRESHNESS_CHECK_CRON = '0 6 * * *';
