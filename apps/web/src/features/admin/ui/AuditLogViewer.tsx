'use client';

/**
 * AuditLogViewer — filterable, paginated audit-log table for workspace admins.
 * Migrated from raw HTML table to Ant Design Table, Input, Select, Button, Tag, Alert.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Table, Input, Select, Button, Tag, Alert, Flex, Typography } from 'antd';
import { ReloadOutlined, DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  useAuditStore,
  AuditAction,
  type AuditEntry,
  type AuditFilter,
} from '../model/audit-store';

const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

const auditKeys = {
  log: (wsId: string, filter: AuditFilter, cursor: string | null, limit: number) =>
    ['audit', wsId, filter, cursor, limit] as const,
};

// ---------------------------------------------------------------------------
// Action label map
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Action color map for Tag
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<string, string> = {
  auth: 'blue',
  note: 'green',
  file: 'orange',
  member: 'purple',
  workspace: 'gold',
  plugin: 'magenta',
  audit: 'default',
  gdpr: 'red',
  settings: 'cyan',
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

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

  const [_activeCursor, setActiveCursor] = useState<string | null>(null);

  // Effect: reset store state when workspaceId changes.
  // This synchronizes Zustand store state with the route param -- a valid
  // side effect that ensures stale data from a previous workspace is cleared.
  useEffect(() => {
    reset();
    setActiveCursor(null);
  }, [workspaceId, reset]);

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

  // Table columns definition
  const columns: ColumnsType<AuditEntry> = useMemo(
    () => [
      {
        title: 'Timestamp',
        dataIndex: 'timestamp',
        key: 'timestamp',
        width: 180,
        render: (ts: string) => new Date(ts).toLocaleString(),
      },
      {
        title: 'Action',
        dataIndex: 'action',
        key: 'action',
        width: 200,
        render: (action: AuditAction) => {
          const category = action.split('.')[0];
          const color = CATEGORY_COLORS[category] ?? 'default';
          return <Tag color={color}>{ACTION_LABELS[action] ?? action}</Tag>;
        },
      },
      {
        title: 'User ID',
        dataIndex: 'userId',
        key: 'userId',
        width: 160,
        ellipsis: true,
        render: (uid: string) => (
          <Text code copyable style={{ fontSize: 12 }}>
            {uid}
          </Text>
        ),
      },
      {
        title: 'IP Address',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 140,
      },
      {
        title: 'User Agent',
        dataIndex: 'userAgent',
        key: 'userAgent',
        ellipsis: true,
      },
    ],
    [],
  );

  const allActions = Object.values(AuditAction);

  return (
    <Flex vertical style={{ height: '100%', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <Flex
        justify="space-between"
        align="center"
        style={{ padding: '16px 24px', borderBottom: '1px solid var(--ant-color-border)' }}
      >
        <Flex vertical>
          <Title level={4} style={{ margin: 0 }}>
            Audit Log
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            {total > 0 ? `${total} entries` : 'No entries'}
            {isFetching && !isLoading && (
              <Text type="warning" style={{ marginLeft: 8 }}>
                Refreshing...
              </Text>
            )}
          </Text>
        </Flex>
        <Button type="text" icon={<ReloadOutlined />} onClick={() => refetch()}>
          Refresh
        </Button>
      </Flex>

      {/* Filter bar */}
      <Flex
        wrap
        gap={12}
        style={{ padding: '12px 24px', borderBottom: '1px solid var(--ant-color-border)' }}
      >
        <Input
          placeholder="Filter by User ID..."
          value={filter.userId ?? ''}
          onChange={(e) => handleFilterChange({ userId: e.target.value || undefined })}
          style={{ flex: 1, minWidth: 160 }}
          allowClear
        />

        <Select
          value={filter.actions?.[0] ?? undefined}
          onChange={(val) =>
            handleFilterChange({
              actions: val ? [val as AuditAction] : undefined,
            })
          }
          placeholder="All actions"
          allowClear
          style={{ width: 200 }}
          options={allActions.map((action) => ({
            label: ACTION_LABELS[action],
            value: action,
          }))}
        />

        <Input
          placeholder="Search metadata..."
          value={filter.search ?? ''}
          onChange={(e) => handleFilterChange({ search: e.target.value || undefined })}
          prefix={<SearchOutlined />}
          style={{ flex: 1, minWidth: 160 }}
          allowClear
        />

        <Button onClick={handleClearFilter}>Clear</Button>

        <Button
          type="primary"
          icon={<DownloadOutlined />}
          onClick={() => void handleExport()}
          loading={isExporting}
        >
          Export CSV
        </Button>
      </Flex>

      {/* Error state */}
      {error && (
        <Alert
          type="error"
          message={error}
          closable
          onClose={() => setError(null)}
          style={{ margin: '16px 24px 0' }}
        />
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
        <Table<AuditEntry>
          columns={columns}
          dataSource={entries}
          rowKey="id"
          loading={isLoading && entries.length === 0}
          pagination={false}
          size="small"
          expandable={{
            expandedRowRender: (entry) => (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontSize: 12,
                  maxHeight: 192,
                  overflow: 'auto',
                  margin: 0,
                }}
              >
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            ),
            rowExpandable: (entry) => Object.keys(entry.metadata).length > 0,
          }}
          locale={{
            emptyText: (
              <Flex vertical align="center" gap={8} style={{ paddingBlock: 32 }}>
                <Text type="secondary">
                  {filter.userId ||
                  (filter.actions?.length ?? 0) > 0 ||
                  filter.from ||
                  filter.to ||
                  filter.search
                    ? 'No entries match the current filter.'
                    : 'No audit entries found for this workspace.'}
                </Text>
              </Flex>
            ),
          }}
        />
      </div>

      {/* Load more */}
      {nextCursor && (
        <Flex
          justify="center"
          style={{ padding: 16, borderTop: '1px solid var(--ant-color-border)' }}
        >
          <Button onClick={() => void handleLoadMore()} loading={isLoading}>
            Load more
          </Button>
        </Flex>
      )}
    </Flex>
  );
}
