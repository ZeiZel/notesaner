import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types (mirror server audit.types, no shared dep needed) ─────────────────

export enum AuditAction {
  AUTH_LOGIN = 'auth.login',
  AUTH_LOGOUT = 'auth.logout',
  AUTH_LOGIN_FAILED = 'auth.login_failed',
  AUTH_TOKEN_REFRESHED = 'auth.token_refreshed',
  AUTH_TOTP_ENABLED = 'auth.totp_enabled',
  AUTH_TOTP_DISABLED = 'auth.totp_disabled',
  AUTH_TOTP_VERIFIED = 'auth.totp_verified',
  AUTH_PASSWORD_CHANGED = 'auth.password_changed',
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
  FILE_UPLOADED = 'file.uploaded',
  FILE_DELETED = 'file.deleted',
  FILE_DOWNLOADED = 'file.downloaded',
  MEMBER_INVITED = 'member.invited',
  MEMBER_REMOVED = 'member.removed',
  MEMBER_ROLE_CHANGED = 'member.role_changed',
  MEMBER_JOINED = 'member.joined',
  WORKSPACE_CREATED = 'workspace.created',
  WORKSPACE_UPDATED = 'workspace.updated',
  WORKSPACE_DELETED = 'workspace.deleted',
  SETTINGS_CHANGED = 'settings.changed',
  PLUGIN_INSTALLED = 'plugin.installed',
  PLUGIN_REMOVED = 'plugin.removed',
  PLUGIN_ENABLED = 'plugin.enabled',
  PLUGIN_DISABLED = 'plugin.disabled',
  PLUGIN_SETTINGS_CHANGED = 'plugin.settings_changed',
  AUDIT_LOG_EXPORTED = 'audit.log_exported',
  AUDIT_RETENTION_CHANGED = 'audit.retention_changed',
  GDPR_DATA_REQUESTED = 'gdpr.data_requested',
  GDPR_DATA_DELETED = 'gdpr.data_deleted',
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: AuditAction;
  userId: string;
  workspaceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

export interface AuditFilter {
  userId?: string;
  actions?: AuditAction[];
  from?: string;
  to?: string;
  search?: string;
}

export interface AuditPage {
  entries: AuditEntry[];
  nextCursor: string | null;
  total: number;
}

export interface AuditRetentionConfig {
  retentionDays: number;
  updatedAt: string;
  updatedBy: string;
}

// ─── Store State & Actions ────────────────────────────────────────────────────

interface AuditStoreState {
  // ── Data
  entries: AuditEntry[];
  total: number;
  nextCursor: string | null;
  isLoading: boolean;
  isExporting: boolean;
  error: string | null;

  // ── Filter & pagination state
  filter: AuditFilter;
  pageSize: number;

  // ── Retention config
  retentionConfig: AuditRetentionConfig | null;
  isRetentionLoading: boolean;

  // ── Actions
  setFilter: (filter: Partial<AuditFilter>) => void;
  clearFilter: () => void;
  setPageSize: (size: number) => void;
  setEntries: (page: AuditPage) => void;
  appendEntries: (page: AuditPage) => void;
  setLoading: (loading: boolean) => void;
  setExporting: (exporting: boolean) => void;
  setError: (error: string | null) => void;
  setRetentionConfig: (config: AuditRetentionConfig) => void;
  setRetentionLoading: (loading: boolean) => void;
  reset: () => void;
}

const DEFAULT_FILTER: AuditFilter = {};
const DEFAULT_PAGE_SIZE = 50;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuditStore = create<AuditStoreState>()(
  devtools(
    (set) => ({
      // ── Initial state
      entries: [],
      total: 0,
      nextCursor: null,
      isLoading: false,
      isExporting: false,
      error: null,
      filter: DEFAULT_FILTER,
      pageSize: DEFAULT_PAGE_SIZE,
      retentionConfig: null,
      isRetentionLoading: false,

      // ── Filter actions
      setFilter: (partial) =>
        set((state) => ({ filter: { ...state.filter, ...partial } }), false, 'audit/setFilter'),

      clearFilter: () => set({ filter: DEFAULT_FILTER }, false, 'audit/clearFilter'),

      setPageSize: (pageSize) => set({ pageSize }, false, 'audit/setPageSize'),

      // ── Data actions
      setEntries: (page) =>
        set(
          {
            entries: page.entries,
            total: page.total,
            nextCursor: page.nextCursor,
          },
          false,
          'audit/setEntries',
        ),

      appendEntries: (page) =>
        set(
          (state) => ({
            entries: [...state.entries, ...page.entries],
            total: page.total,
            nextCursor: page.nextCursor,
          }),
          false,
          'audit/appendEntries',
        ),

      setLoading: (isLoading) => set({ isLoading }, false, 'audit/setLoading'),

      setExporting: (isExporting) => set({ isExporting }, false, 'audit/setExporting'),

      setError: (error) => set({ error }, false, 'audit/setError'),

      // ── Retention
      setRetentionConfig: (retentionConfig) =>
        set({ retentionConfig }, false, 'audit/setRetentionConfig'),

      setRetentionLoading: (isRetentionLoading) =>
        set({ isRetentionLoading }, false, 'audit/setRetentionLoading'),

      // ── Reset
      reset: () =>
        set(
          {
            entries: [],
            total: 0,
            nextCursor: null,
            isLoading: false,
            isExporting: false,
            error: null,
            filter: DEFAULT_FILTER,
            retentionConfig: null,
          },
          false,
          'audit/reset',
        ),
    }),
    { name: 'AuditStore' },
  ),
);
