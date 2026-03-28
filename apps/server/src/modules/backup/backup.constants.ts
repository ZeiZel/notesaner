/** BullMQ queue name for backup operations. */
export const BACKUP_QUEUE = 'backup';

/** Job name for scheduled database backup. */
export const BACKUP_DATABASE_JOB = 'backup-database';

/** Job name for scheduled filesystem backup. */
export const BACKUP_FILESYSTEM_JOB = 'backup-filesystem';

/** Job name for full backup (database + filesystem). */
export const BACKUP_FULL_JOB = 'backup-full';

/** Job name for retention policy cleanup. */
export const BACKUP_RETENTION_JOB = 'backup-retention';

/** Job name for weekly restore verification test. */
export const BACKUP_VERIFY_JOB = 'backup-verify';

/** Cron expression: daily at 02:00 UTC. */
export const BACKUP_DAILY_CRON = '0 2 * * *';

/** Cron expression: weekly on Sunday at 03:00 UTC. */
export const BACKUP_WEEKLY_CRON = '0 3 * * 0';

/** Cron expression: monthly on the 1st at 04:00 UTC. */
export const BACKUP_MONTHLY_CRON = '0 4 1 * *';

/** Cron expression: retention cleanup daily at 05:00 UTC. */
export const BACKUP_RETENTION_CRON = '0 5 * * *';

/** Cron expression: restore verification weekly on Wednesday at 03:00 UTC. */
export const BACKUP_VERIFY_CRON = '0 3 * * 3';

/** Maximum concurrent backup workers. */
export const BACKUP_CONCURRENCY = 1;

// ─── Retention defaults ─────────────────────────────────────────────────────

/** Number of daily backups to retain. */
export const RETENTION_DAILY_COUNT = 7;

/** Number of weekly backups to retain. */
export const RETENTION_WEEKLY_COUNT = 4;

/** Number of monthly backups to retain. */
export const RETENTION_MONTHLY_COUNT = 3;

// ─── Encryption ─────────────────────────────────────────────────────────────

/** Algorithm used for backup encryption. */
export const BACKUP_ENCRYPTION_ALGORITHM = 'aes-256-gcm';

/** IV length in bytes for AES-256-GCM. */
export const BACKUP_IV_LENGTH = 16;

/** Auth tag length in bytes for AES-256-GCM. */
export const BACKUP_AUTH_TAG_LENGTH = 16;

// ─── File naming ────────────────────────────────────────────────────────────

/** Prefix for database backup files. */
export const DB_BACKUP_PREFIX = 'notesaner-db';

/** Prefix for filesystem backup files. */
export const FS_BACKUP_PREFIX = 'notesaner-fs';

/** Prefix for full backup files. */
export const FULL_BACKUP_PREFIX = 'notesaner-full';

/** Extension for encrypted backup files. */
export const BACKUP_ENCRYPTED_EXT = '.enc';
