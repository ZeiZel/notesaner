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

  // Sync / Conflict resolution
  SYNC_MERGED = 'sync.merged',
  SYNC_FRONTMATTER_CONFLICT = 'sync.frontmatter_conflict',

  // Storage quota
  STORAGE_QUOTA_CHANGED = 'storage.quota_changed',

  // API keys
  API_KEY_CREATED = 'api_key.created',
  API_KEY_REVOKED = 'api_key.revoked',
  API_KEY_ROTATED = 'api_key.rotated',

  // Admin / GDPR
  AUDIT_LOG_EXPORTED = 'audit.log_exported',
  AUDIT_RETENTION_CHANGED = 'audit.retention_changed',
  GDPR_DATA_REQUESTED = 'gdpr.data_requested',
  GDPR_DATA_DELETED = 'gdpr.data_deleted',
}

// ─── Action Groups ────────────────────────────────────────────────────────────

/**
 * Logical groupings of audit actions for convenient bulk filtering.
 * Each group maps to a set of AuditAction values.
 *
 * Use the actionGroup query param in AuditQueryDto to filter by group —
 * the service expands it to the corresponding actions[] list when no explicit
 * actions filter is provided.
 */
export enum AuditActionGroup {
  /** All auth-related events (login, logout, TOTP, password). */
  AUTH = 'auth',
  /** All note lifecycle events. */
  NOTES = 'notes',
  /** All workspace member management events. */
  MEMBERS = 'members',
  /** Workspace and settings change events. */
  WORKSPACE_SETTINGS = 'workspace_settings',
  /** Storage quota change events. */
  STORAGE = 'storage',
  /** API key lifecycle events. */
  API_KEYS = 'api_keys',
  /** All plugin lifecycle events. */
  PLUGINS = 'plugins',
  /** GDPR and audit admin events. */
  ADMIN = 'admin',
}

/**
 * Maps each AuditActionGroup to the set of AuditAction values it contains.
 * Used by AuditService to expand a group filter into its constituent actions.
 *
 * Rules:
 *   - Every AuditActionGroup must have at least one entry.
 *   - No AuditAction should appear in more than one group.
 *   - All values must be valid AuditAction enum members.
 */
export const AUDIT_ACTION_GROUP_MAP: Record<AuditActionGroup, AuditAction[]> = {
  [AuditActionGroup.AUTH]: [
    AuditAction.AUTH_LOGIN,
    AuditAction.AUTH_LOGOUT,
    AuditAction.AUTH_LOGIN_FAILED,
    AuditAction.AUTH_TOKEN_REFRESHED,
    AuditAction.AUTH_TOTP_ENABLED,
    AuditAction.AUTH_TOTP_DISABLED,
    AuditAction.AUTH_TOTP_VERIFIED,
    AuditAction.AUTH_PASSWORD_CHANGED,
  ],
  [AuditActionGroup.NOTES]: [
    AuditAction.NOTE_CREATED,
    AuditAction.NOTE_UPDATED,
    AuditAction.NOTE_DELETED,
    AuditAction.NOTE_TRASHED,
    AuditAction.NOTE_RESTORED,
    AuditAction.NOTE_PUBLISHED,
    AuditAction.NOTE_UNPUBLISHED,
    AuditAction.NOTE_VIEWED,
    AuditAction.NOTE_MOVED,
    AuditAction.NOTE_RENAMED,
  ],
  [AuditActionGroup.MEMBERS]: [
    AuditAction.MEMBER_INVITED,
    AuditAction.MEMBER_REMOVED,
    AuditAction.MEMBER_ROLE_CHANGED,
    AuditAction.MEMBER_JOINED,
  ],
  [AuditActionGroup.WORKSPACE_SETTINGS]: [
    AuditAction.WORKSPACE_CREATED,
    AuditAction.WORKSPACE_UPDATED,
    AuditAction.WORKSPACE_DELETED,
    AuditAction.SETTINGS_CHANGED,
  ],
  [AuditActionGroup.STORAGE]: [
    AuditAction.STORAGE_QUOTA_CHANGED,
    AuditAction.FILE_UPLOADED,
    AuditAction.FILE_DELETED,
    AuditAction.FILE_DOWNLOADED,
  ],
  [AuditActionGroup.API_KEYS]: [
    AuditAction.API_KEY_CREATED,
    AuditAction.API_KEY_REVOKED,
    AuditAction.API_KEY_ROTATED,
  ],
  [AuditActionGroup.PLUGINS]: [
    AuditAction.PLUGIN_INSTALLED,
    AuditAction.PLUGIN_REMOVED,
    AuditAction.PLUGIN_ENABLED,
    AuditAction.PLUGIN_DISABLED,
    AuditAction.PLUGIN_SETTINGS_CHANGED,
  ],
  [AuditActionGroup.ADMIN]: [
    AuditAction.AUDIT_LOG_EXPORTED,
    AuditAction.AUDIT_RETENTION_CHANGED,
    AuditAction.GDPR_DATA_REQUESTED,
    AuditAction.GDPR_DATA_DELETED,
  ],
};

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

  /**
   * Convenience shorthand: restrict to all actions belonging to the given group.
   * When both `actionGroup` and `actions` are set, `actions` takes precedence.
   * The group is expanded to its constituent AuditAction values by AuditService.
   */
  actionGroup?: AuditActionGroup;

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
