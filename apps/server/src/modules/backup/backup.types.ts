import type { BackupType, BackupCategory, BackupStatus } from '@prisma/client';

// ─── Job payloads ───────────────────────────────────────────────────────────

/** Payload for backup BullMQ jobs. */
export interface BackupJobData {
  /** Type of backup to perform. */
  type: BackupType;
  /** Category for retention policy classification. */
  category: BackupCategory;
  /** Who triggered this backup. */
  triggeredBy: 'scheduler' | 'manual' | 'restore-test';
}

/** Payload for the retention cleanup job. */
export interface BackupRetentionJobData {
  /** Dry run: log what would be deleted without actually deleting. */
  dryRun?: boolean;
}

/** Payload for the restore verification job. */
export interface BackupVerifyJobData {
  /** Specific backup ID to verify. If omitted, verifies the latest completed backup. */
  backupId?: string;
}

// ─── Job results ────────────────────────────────────────────────────────────

/** Result returned by backup processors. */
export interface BackupJobResult {
  backupLogId: string;
  type: BackupType;
  category: BackupCategory;
  filename: string;
  destination: string;
  sizeBytes: number;
  durationMs: number;
  checksum: string;
}

/** Result returned by the retention cleanup processor. */
export interface BackupRetentionJobResult {
  deleted: number;
  freedBytes: number;
  durationMs: number;
  details: Array<{
    id: string;
    filename: string;
    category: string;
    reason: string;
  }>;
}

/** Result returned by the restore verification processor. */
export interface BackupVerifyJobResult {
  backupLogId: string;
  verified: boolean;
  durationMs: number;
  error?: string;
}

// ─── API DTOs ───────────────────────────────────────────────────────────────

/** Response shape for a single backup log entry. */
export interface BackupLogDto {
  id: string;
  type: BackupType;
  status: BackupStatus;
  category: BackupCategory;
  filename: string;
  destination: string;
  sizeBytes: string; // BigInt serialized as string
  durationMs: number;
  checksum: string | null;
  error: string | null;
  triggeredBy: string;
  startedAt: string;
  completedAt: string | null;
  verifiedAt: string | null;
  expiresAt: string | null;
}

/** Request body for manual backup trigger. */
export interface TriggerBackupDto {
  type: BackupType;
}

/** Response for manual backup trigger. */
export interface TriggerBackupResponse {
  jobId: string;
  message: string;
}

/** Response for backup list endpoint. */
export interface BackupListResponse {
  backups: BackupLogDto[];
  total: number;
  /** Summary statistics. */
  stats: {
    totalSizeBytes: string;
    lastSuccessful: string | null;
    lastFailed: string | null;
    dailyCount: number;
    weeklyCount: number;
    monthlyCount: number;
  };
}

// ─── Configuration ──────────────────────────────────────────────────────────

/** Backup module configuration shape (read from ConfigService). */
export interface BackupConfig {
  /** Whether the backup scheduler is enabled. */
  enabled: boolean;
  /** Base directory for local backup storage. */
  localPath: string;
  /** S3-compatible storage configuration (null = local-only). */
  s3: S3BackupConfig | null;
  /** AES-256 encryption key (hex-encoded, 64 characters). */
  encryptionKey: string;
  /** Retention policy configuration. */
  retention: RetentionConfig;
  /** SMTP alert configuration (uses EmailService). */
  alertEmail: string | null;
  /** Path to pg_dump binary. */
  pgDumpPath: string;
}

export interface S3BackupConfig {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional prefix/folder within the bucket. */
  prefix: string;
}

export interface RetentionConfig {
  dailyCount: number;
  weeklyCount: number;
  monthlyCount: number;
}
