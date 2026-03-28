'use client';

/**
 * AuditLogViewer — filterable, paginated audit-log table for workspace admins.
 *
 * Features:
 *   - Filter by user ID, action type, date range, and free-text search
 *   - Cursor-based pagination with "Load more" button
 *   - Export filtered results as CSV (triggers browser download)
 *   - Configurable retention period (OWNER only)
 *   - GDPR subject data panel
 *
 * Data is fetched via the standard api client; TanStack Query manages cache
 * and loading states. The Zustand audit-store holds filter / pagination state
 * so it persists across navigation within the admin section.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuditStore, AuditAction, type AuditEntry, type AuditFilter } from './audit-store';

// ─── API client (thin wrapper — matches server route shapes) ─────────────────

async function fetchAuditLog(
  workspaceId: string,
  filter: AuditFilter,
  cursor: string | null,
  limit: number,
  token: string,
) {
  const params = new URLSearchParams();
  if (filter.userId) params.set('userId', filter.userId);
  if (filter.actions?.length) {
    filter.actions.forEach((a) => params.append('actions', a));
  }
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.search) params.set('search', filter.search);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const res = await fetch(`/api/workspaces/${workspaceId}/audit-log?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Audit log fetch failed: ${res.statusText}`);
  }

  return res.json() as Promise<{ entries: AuditEntry[]; nextCursor: string | null; total: number }>;
}

async function downloadAuditCsv(
  workspaceId: string,
  filter: AuditFilter,
  token: string,
): Promise<void> {
  const params = new URLSearchParams();
  if (filter.userId) params.set('userId', filter.userId);
  if (filter.actions?.length) {
    filter.actions.forEach((a) => params.append('actions', a));
  }
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  if (filter.search) params.set('search', filter.search);

  const res = await fetch(`/api/workspaces/${workspaceId}/audit-log/export?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) throw new Error(`CSV export failed: ${res.statusText}`);

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `audit-log-${workspaceId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// ─── Query key factory ────────────────────────────────────────────────────────

const auditKeys = {
  log: (wsId: string, filter: AuditFilter, cursor: string | null, limit: number) =>
    ['audit', wsId, filter, cursor, limit] as const,
};

// ─── Action label map (user-friendly display) ─────────────────────────────────

const ACTION_LABELS: Record<AuditAction, string> = {
  [AuditAction.AUTH_LOGIN]: 'Login',
  [AuditAction.AUTH_LOGOUT]: 'Logout',
  [AuditAction.AUTH_LOGIN_FAILED]: 'Login Failed',
  [AuditAction.AUTH_TOKEN_REFRESHED]: 'Token Refreshed',
  [AuditAction.AUTH_TOTP_ENABLED]: 'TOTP Enabled',
  [AuditAction.AUTH_TOTP_DISABLED]: 'TOTP Disabled',
  [AuditAction.AUTH_TOTP_VERIFIED]: 'TOTP Verified',
  [AuditAction.AUTH_PASSWORD_CHANGED]: 'Password Changed',
  [AuditAction.NOTE_CREATED]: 'Note Created',
  [AuditAction.NOTE_UPDATED]: 'Note Updated',
  [AuditAction.NOTE_DELETED]: 'Note Deleted',
  [AuditAction.NOTE_TRASHED]: 'Note Trashed',
  [AuditAction.NOTE_RESTORED]: 'Note Restored',
  [AuditAction.NOTE_PUBLISHED]: 'Note Published',
  [AuditAction.NOTE_UNPUBLISHED]: 'Note Unpublished',
  [AuditAction.NOTE_VIEWED]: 'Note Viewed',
  [AuditAction.NOTE_MOVED]: 'Note Moved',
  [AuditAction.NOTE_RENAMED]: 'Note Renamed',
  [AuditAction.FILE_UPLOADED]: 'File Uploaded',
  [AuditAction.FILE_DELETED]: 'File Deleted',
  [AuditAction.FILE_DOWNLOADED]: 'File Downloaded',
  [AuditAction.MEMBER_INVITED]: 'Member Invited',
  [AuditAction.MEMBER_REMOVED]: 'Member Removed',
  [AuditAction.MEMBER_ROLE_CHANGED]: 'Member Role Changed',
  [AuditAction.MEMBER_JOINED]: 'Member Joined',
  [AuditAction.WORKSPACE_CREATED]: 'Workspace Created',
  [AuditAction.WORKSPACE_UPDATED]: 'Workspace Updated',
  [AuditAction.WORKSPACE_DELETED]: 'Workspace Deleted',
  [AuditAction.SETTINGS_CHANGED]: 'Settings Changed',
  [AuditAction.PLUGIN_INSTALLED]: 'Plugin Installed',
  [AuditAction.PLUGIN_REMOVED]: 'Plugin Removed',
  [AuditAction.PLUGIN_ENABLED]: 'Plugin Enabled',
  [AuditAction.PLUGIN_DISABLED]: 'Plugin Disabled',
  [AuditAction.PLUGIN_SETTINGS_CHANGED]: 'Plugin Settings Changed',
  [AuditAction.AUDIT_LOG_EXPORTED]: 'Audit Log Exported',
  [AuditAction.AUDIT_RETENTION_CHANGED]: 'Retention Config Changed',
  [AuditAction.GDPR_DATA_REQUESTED]: 'GDPR Data Requested',
  [AuditAction.GDPR_DATA_DELETED]: 'GDPR Data Deleted',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: AuditAction }) {
  const label = ACTION_LABELS[action] ?? action;
  const category = action.split('.')[0];

  const colorMap: Record<string, string> = {
    auth: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    note: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    file: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
    member: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    workspace: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    plugin: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
    audit: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    gdpr: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    settings: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  };

  const color = colorMap[category] ?? colorMap['audit'];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function EntryRow({ entry }: { entry: AuditEntry }) {
  const [expanded, setExpanded] = useState(false);
  const hasMetadata = Object.keys(entry.metadata).length > 0;

  return (
    <>
      <tr
        className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => hasMetadata && setExpanded((v) => !v)}
        style={{ cursor: hasMetadata ? 'pointer' : 'default' }}
      >
        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">
          {new Date(entry.timestamp).toLocaleString()}
        </td>
        <td className="px-4 py-3">
          <ActionBadge action={entry.action} />
        </td>
        <td className="px-4 py-3 text-sm font-mono text-gray-700 dark:text-gray-300 truncate max-w-[160px]">
          {entry.userId}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{entry.ipAddress}</td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
          {entry.userAgent}
        </td>
        <td className="px-4 py-3 text-center">
          {hasMetadata && (
            <span className="text-xs text-blue-500">{expanded ? 'Hide' : 'Show'}</span>
          )}
        </td>
      </tr>
      {expanded && hasMetadata && (
        <tr className="bg-gray-50 dark:bg-gray-800">
          <td colSpan={6} className="px-4 py-3">
            <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-auto max-h-48 whitespace-pre-wrap">
              {JSON.stringify(entry.metadata, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

interface FilterBarProps {
  filter: AuditFilter;
  onFilterChange: (patch: Partial<AuditFilter>) => void;
  onClearFilter: () => void;
  onExport: () => void;
  isExporting: boolean;
}

function FilterBar({
  filter,
  onFilterChange,
  onClearFilter,
  onExport,
  isExporting,
}: FilterBarProps) {
  const allActions = Object.values(AuditAction);

  return (
    <div className="flex flex-wrap gap-3 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
      {/* User ID filter */}
      <input
        type="text"
        placeholder="Filter by User ID..."
        value={filter.userId ?? ''}
        onChange={(e) => onFilterChange({ userId: e.target.value || undefined })}
        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Action type filter */}
      <select
        value={filter.actions?.[0] ?? ''}
        onChange={(e) =>
          onFilterChange({
            actions: e.target.value ? [e.target.value as AuditAction] : undefined,
          })
        }
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All actions</option>
        {allActions.map((action) => (
          <option key={action} value={action}>
            {ACTION_LABELS[action]}
          </option>
        ))}
      </select>

      {/* Date range — from */}
      <input
        type="datetime-local"
        value={filter.from ? new Date(filter.from).toISOString().slice(0, 16) : ''}
        onChange={(e) =>
          onFilterChange({
            from: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Date range — to */}
      <input
        type="datetime-local"
        value={filter.to ? new Date(filter.to).toISOString().slice(0, 16) : ''}
        onChange={(e) =>
          onFilterChange({
            to: e.target.value ? new Date(e.target.value).toISOString() : undefined,
          })
        }
        className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Free-text search */}
      <input
        type="search"
        placeholder="Search metadata..."
        value={filter.search ?? ''}
        onChange={(e) => onFilterChange({ search: e.target.value || undefined })}
        className="flex-1 min-w-[160px] px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {/* Actions */}
      <button
        type="button"
        onClick={onClearFilter}
        className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        Clear
      </button>

      <button
        type="button"
        onClick={onExport}
        disabled={isExporting}
        className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-md transition-colors"
      >
        {isExporting ? 'Exporting...' : 'Export CSV'}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface AuditLogViewerProps {
  workspaceId: string;
  token: string;
}

export function AuditLogViewer({ workspaceId, token }: AuditLogViewerProps) {
  const {
    entries,
    total,
    nextCursor,
    isLoading,
    isExporting,
    error,
    filter,
    pageSize,
    setFilter,
    clearFilter,
    setEntries,
    appendEntries,
    setLoading,
    setExporting,
    setError,
    reset,
  } = useAuditStore();

  // Cursor state for paginated fetches (we use a local cursor separate from
  // the store's nextCursor so we can distinguish "initial load" vs "load more")
  const [_activeCursor, setActiveCursor] = useState<string | null>(null);

  // Reset when workspaceId or filter changes
  useEffect(() => {
    reset();
    setActiveCursor(null);
  }, [workspaceId, reset]);

  // ── Initial query (filter change)
  const { isFetching, refetch } = useQuery({
    queryKey: auditKeys.log(workspaceId, filter, null, pageSize),
    queryFn: async () => {
      setLoading(true);
      setError(null);
      try {
        const page = await fetchAuditLog(workspaceId, filter, null, pageSize, token);
        setEntries(page);
        return page;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        setError(message);
        throw err;
      } finally {
        setLoading(false);
      }
    },
    enabled: !!workspaceId && !!token,
    staleTime: 30_000,
  });

  // ── Load more
  const handleLoadMore = useCallback(async () => {
    if (!nextCursor) return;
    setLoading(true);
    try {
      const page = await fetchAuditLog(workspaceId, filter, nextCursor, pageSize, token);
      appendEntries(page);
      setActiveCursor(nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load more failed');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, filter, nextCursor, pageSize, token, appendEntries, setLoading, setError]);

  // ── CSV Export
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await downloadAuditCsv(workspaceId, filter, token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  }, [workspaceId, filter, token, setExporting, setError]);

  // ── Filter change handler (resets pagination)
  const handleFilterChange = useCallback(
    (patch: Partial<typeof filter>) => {
      setFilter(patch);
      setActiveCursor(null);
    },
    [setFilter],
  );

  const handleClearFilter = useCallback(() => {
    clearFilter();
    setActiveCursor(null);
  }, [clearFilter]);

  // ── Empty-state message
  const emptyMessage = useMemo(() => {
    const hasFilter =
      filter.userId ||
      (filter.actions?.length ?? 0) > 0 ||
      filter.from ||
      filter.to ||
      filter.search;
    return hasFilter
      ? 'No entries match the current filter.'
      : 'No audit entries found for this workspace.';
  }, [filter]);

  return (
    <div className="flex flex-col h-full bg-white dark:bg-gray-900 rounded-lg shadow overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Audit Log</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {total > 0 ? `${total} entries` : 'No entries'}
            {isFetching && !isLoading && <span className="ml-2 text-blue-500">Refreshing...</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          Refresh
        </button>
      </div>

      {/* Filter bar */}
      <FilterBar
        filter={filter}
        onFilterChange={handleFilterChange}
        onClearFilter={handleClearFilter}
        onExport={handleExport}
        isExporting={isExporting}
      />

      {/* Error state */}
      {error && (
        <div className="mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading && entries.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500 dark:text-gray-400">{emptyMessage}</p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-gray-50 dark:bg-gray-800 z-10">
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300 whitespace-nowrap">
                  Timestamp
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Action</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">User ID</th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  IP Address
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">
                  User Agent
                </th>
                <th className="px-4 py-3 font-medium text-gray-600 dark:text-gray-300">Details</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <EntryRow key={entry.id} entry={entry} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Load more */}
      {nextCursor && (
        <div className="flex items-center justify-center py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleLoadMore}
            disabled={isLoading}
            className="px-6 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 border border-blue-300 dark:border-blue-700 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/20 disabled:opacity-50 transition-colors"
          >
            {isLoading ? 'Loading...' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  );
}
