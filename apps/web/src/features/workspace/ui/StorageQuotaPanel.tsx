'use client';

/**
 * StorageQuotaPanel — workspace settings panel showing storage usage and quota.
 *
 * Displays:
 *   - Visual progress bar: usage vs. quota with color coding (green/yellow/red)
 *   - Breakdown: notes, attachments, versions counts
 *   - Total storage used in human-readable format
 *   - Quota limits and percentages
 *   - Warning state when usage exceeds 80%
 *   - Last recalculation timestamp
 *
 * Design decisions:
 *   - Data fetched via TanStack Query (useStorageQuota hook)
 *   - No useEffect — relies on query lifecycle
 *   - Ant Design components (Progress, Card, Statistic, Typography)
 *   - Refresh button triggers refetch, not a mutation
 */

import { Card, Progress, Statistic, Typography, Button, Tooltip, Flex, Tag } from 'antd';
import {
  CloudOutlined,
  FileTextOutlined,
  PaperClipOutlined,
  HistoryOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import axiosInstance from '@/shared/api/axios-instance';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StorageStatsResponse {
  workspaceId: string;
  used: {
    totalStorageBytes: string;
    noteCount: number;
    attachmentCount: number;
    versionCount: number;
  };
  limits: {
    maxStorageBytes: string;
    maxNotes: number;
    maxFileSizeBytes: string;
  };
  quota: {
    storageUsedPercent: number;
    noteUsedPercent: number;
    isStorageWarning: boolean;
    isNoteWarning: boolean;
    isStorageExceeded: boolean;
    isNoteExceeded: boolean;
  };
  lastRecalculatedAt: string | null;
}

export interface StorageQuotaPanelProps {
  /** Optional additional class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a byte count string to a human-readable format.
 */
function formatBytes(bytesStr: string): string {
  const bytes = BigInt(bytesStr);
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Number(bytes);
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

/**
 * Determine the color of the progress bar based on usage percentage.
 */
function getProgressColor(percent: number): string {
  if (percent >= 90) return '#ff4d4f'; // red
  if (percent >= 80) return '#faad14'; // yellow/warning
  return '#52c41a'; // green
}

/**
 * Format a relative date string for "last recalculated at".
 */
function formatRecalculatedAt(isoString: string | null): string {
  if (!isoString) return 'Never';

  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ---------------------------------------------------------------------------
// Query hook
// ---------------------------------------------------------------------------

const storageQuotaKeys = {
  all: ['storageQuota'] as const,
  detail: (workspaceId: string) => [...storageQuotaKeys.all, workspaceId] as const,
};

function useStorageQuota(workspaceId: string | null) {
  const token = useAuthStore((s) => s.accessToken);

  return useQuery<StorageStatsResponse>({
    queryKey: storageQuotaKeys.detail(workspaceId ?? ''),
    queryFn: async () => {
      const response = await axiosInstance.get<StorageStatsResponse>(
        `/workspaces/${workspaceId}/storage`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      return response.data;
    },
    enabled: Boolean(token && workspaceId),
    staleTime: 60_000, // 1 minute
    refetchOnWindowFocus: true,
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function StorageQuotaPanel({ className }: StorageQuotaPanelProps) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const { data, isLoading, refetch, isFetching } = useStorageQuota(workspaceId);

  if (!workspaceId) return null;

  return (
    <Card
      title={
        <Flex align="center" gap={8}>
          <CloudOutlined />
          <span>Storage Usage</span>
        </Flex>
      }
      extra={
        <Tooltip title="Refresh storage statistics">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined spin={isFetching} />}
            onClick={() => void refetch()}
            loading={isFetching}
          />
        </Tooltip>
      }
      loading={isLoading}
      className={className}
    >
      {data && (
        <Flex vertical gap={24}>
          {/* Storage progress bar */}
          <Flex vertical gap={8}>
            <Flex justify="space-between" align="center">
              <Text strong>Total Storage</Text>
              <Text type="secondary">
                {formatBytes(data.used.totalStorageBytes)} /{' '}
                {formatBytes(data.limits.maxStorageBytes)}
              </Text>
            </Flex>
            <Progress
              percent={data.quota.storageUsedPercent}
              strokeColor={getProgressColor(data.quota.storageUsedPercent)}
              status={data.quota.isStorageExceeded ? 'exception' : 'normal'}
              format={(percent) => `${percent}%`}
            />
            {data.quota.isStorageWarning && !data.quota.isStorageExceeded && (
              <Flex align="center" gap={4}>
                <WarningOutlined style={{ color: '#faad14', fontSize: 14 }} />
                <Text type="warning" style={{ fontSize: 12 }}>
                  Storage usage is above 80%. Consider cleaning up old versions or attachments.
                </Text>
              </Flex>
            )}
            {data.quota.isStorageExceeded && (
              <Flex align="center" gap={4}>
                <WarningOutlined style={{ color: '#ff4d4f', fontSize: 14 }} />
                <Text type="danger" style={{ fontSize: 12 }}>
                  Storage quota exceeded! New uploads will be rejected until space is freed.
                </Text>
              </Flex>
            )}
          </Flex>

          {/* Notes progress bar */}
          <Flex vertical gap={8}>
            <Flex justify="space-between" align="center">
              <Text strong>Notes</Text>
              <Text type="secondary">
                {data.used.noteCount.toLocaleString()} / {data.limits.maxNotes.toLocaleString()}
              </Text>
            </Flex>
            <Progress
              percent={data.quota.noteUsedPercent}
              strokeColor={getProgressColor(data.quota.noteUsedPercent)}
              status={data.quota.isNoteExceeded ? 'exception' : 'normal'}
              format={(percent) => `${percent}%`}
            />
            {data.quota.isNoteWarning && !data.quota.isNoteExceeded && (
              <Flex align="center" gap={4}>
                <WarningOutlined style={{ color: '#faad14', fontSize: 14 }} />
                <Text type="warning" style={{ fontSize: 12 }}>
                  Note count is above 80% of limit.
                </Text>
              </Flex>
            )}
          </Flex>

          {/* Breakdown statistics */}
          <Flex wrap="wrap" gap={16}>
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  <FileTextOutlined style={{ fontSize: 12 }} />
                  <span>Notes</span>
                </Flex>
              }
              value={data.used.noteCount}
              valueStyle={{ fontSize: 20 }}
            />
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  <PaperClipOutlined style={{ fontSize: 12 }} />
                  <span>Attachments</span>
                </Flex>
              }
              value={data.used.attachmentCount}
              valueStyle={{ fontSize: 20 }}
            />
            <Statistic
              title={
                <Flex align="center" gap={4}>
                  <HistoryOutlined style={{ fontSize: 12 }} />
                  <span>Versions</span>
                </Flex>
              }
              value={data.used.versionCount}
              valueStyle={{ fontSize: 20 }}
            />
          </Flex>

          {/* Max file size + last recalculation */}
          <Flex justify="space-between" align="center">
            <Flex align="center" gap={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Max file size:
              </Text>
              <Tag>{formatBytes(data.limits.maxFileSizeBytes)}</Tag>
            </Flex>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Last calculated: {formatRecalculatedAt(data.lastRecalculatedAt)}
            </Text>
          </Flex>
        </Flex>
      )}
    </Card>
  );
}

StorageQuotaPanel.displayName = 'StorageQuotaPanel';
