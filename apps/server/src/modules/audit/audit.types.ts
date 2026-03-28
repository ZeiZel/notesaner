/**
 * audit.types.ts
 *
 * Shared types for the audit-log subsystem. These are service-level types —
 * they have no Prisma schema backing. Audit entries are stored in a Valkey
 * sorted-set (score = Unix timestamp ms) which provides:
 *   - O(log N) inserts
 *   - O(log N + M) range queries by time
 *   - TTL-based expiry via a background purge job
 *
 * The append-only guarantee is enforced by only ever writing via AuditService.log()
 * and never exposing a delete endpoint on entries (only anonymization for GDPR).
 */

// ─── Action Catalogue ────────────────────────────────────────────────────────

export enum AuditAction {
  // Auth
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_LOGIN_FAILED = 'auth.login_failed',
  AUTH_TOKEN_REFRESHED = 'auth.token_refreshed',
  AUTH_TOTP_ENABLED = 'auth.totp_enabled',
  AUTH_TOTP_DISABLED = 'auth.totp_disabled',
  AUTH_TOTP_VERIFIED = 'auth.totp_verified',
  AUTH_PASSWORD_CHANGED = 'auth.password_changed',

  // Notes
  NOTE_CREATED = 'note.created',
  NOTE_UPDATED = 'note.updated',
  NOTE_DELETED = 'note.deleted',
  NOTE_TRASHED = 'note.trashed',
  NOTE_RESTORED = 'note.restored',
  NOTE_PUBLISHED = 'note.published',
  NOTE_UNPUBLISHED = 'note.unpublished',
  NOTE_VIEWED = 'note.viewed',
  NOTE_MOVED = 'note.moved',
  NOTE_RENAMED = 'note.renamed',

  // Files
  FILE_UPLOADED = 'file.uploaded',
  FILE_DELETED = 'file.deleted',
  FILE_DOWNLOADED = 'file.downloaded',

  // Workspace members
  MEMBER_INVITED = 'member.invited',
  MEMBER_REMOVED = 'member.removed',
  MEMBER_ROLE_CHANGED = 'member.role_changed',
  MEMBER_JOINED = 'member.joined',

  // Workspace settings
  WORKSPACE_CREATED = 'workspace.created',
  WORKSPACE_UPDATED = 'workspace.updated',
  WORKSPACE_DELETED = 'workspace.deleted',
  SETTINGS_CHANGED = 'settings.changed',

  // Plugins
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_REMOVED = 'plugin.removed',
  PLUGIN_ENABLED = 'plugin.enabled',
  PLUGIN_DISABLED = 'plugin.disabled',
  PLUGIN_SETTINGS_CHANGED = 'plugin.settings_changed',

  // Admin / GDPR
  AUDIT_LOG_EXPORTED = 'audit.log_exported',
  AUDIT_RETENTION_CHANGED = 'audit.retention_changed',
  GDPR_DATA_REQUESTED = 'gdpr.data_requested',
  GDPR_DATA_DELETED = 'gdpr.data_deleted',
}

// ─── Entry Shape ─────────────────────────────────────────────────────────────

/** A single immutable audit-log entry. */
export interface AuditEntry {
  /** Globally unique entry ID (UUID v4). */
  id: string;

  /** ISO 8601 timestamp of when the action occurred. */
  timestamp: string;

  /** The action that was performed. */
  action: AuditAction;

  /** ID of the user who performed the action. May be GDPR-anonymized. */
  userId: string;

  /** Workspace scope. Null for instance-level actions (e.g. first login). */
  workspaceId: string | null;

  /** Free-form metadata — note IDs, old/new values, etc. */
  metadata: Record<string, unknown>;

  /** IPv4 or IPv6 address of the request. */
  ipAddress: string;

  /** Browser / client user-agent string. */
  userAgent: string;
}

// ─── Filter / Query ──────────────────────────────────────────────────────────

export interface AuditFilter {
  /** Restrict to a specific user. */
  userId?: string;

  /** Restrict to one or more action types. */
  actions?: AuditAction[];

  /** Restrict to entries at or after this ISO 8601 datetime. */
  from?: string;

  /** Restrict to entries at or before this ISO 8601 datetime. */
  to?: string;

  /** Free text to match against serialised metadata (case-insensitive). */
  search?: string;
}

export interface AuditQueryOptions {
  filter?: AuditFilter;
  /** Cursor-based pagination: opaque value returned from the previous page. */
  cursor?: string;
  /** Maximum entries per page. Default 50, max 500. */
  limit?: number;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
  total: number;
}

// ─── Retention Config ────────────────────────────────────────────────────────

export interface AuditRetentionConfig {
  /**
   * Number of days to keep audit entries. After this period entries are
   * purged by the background purge job.
   * Range: 30–365 days. Default: 90.
   */
  retentionDays: number;
  /** ISO 8601 timestamp of when the config was last modified. */
  updatedAt: string;
  /** ID of the admin who last modified the config. */
  updatedBy: string;
}

// ─── GDPR ────────────────────────────────────────────────────────────────────

export interface GdprSubjectData {
  userId: string;
  totalEntries: number;
  entries: AuditEntry[];
}
