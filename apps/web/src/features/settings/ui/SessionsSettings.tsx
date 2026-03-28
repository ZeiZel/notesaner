'use client';

/**
 * SessionsSettings -- view and manage active login sessions.
 *
 * Displays a list of active sessions with device/browser info parsed from
 * the userAgent string, IP-based location hint, and last-active timestamps.
 *
 * Actions: revoke individual sessions, revoke all other sessions.
 * The current session is visually distinguished and cannot be revoked.
 *
 * Uses TanStack Query for data fetching — no useEffect needed.
 * Uses Ant Design: List, Card, Button, Tag, Modal, Typography, Space.
 */

import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { List, Card, Button, Tag, Typography, Space, App, Tooltip, Empty, Skeleton } from 'antd';
import {
  DesktopOutlined,
  MobileOutlined,
  TabletOutlined,
  GlobalOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { sessionsApi, sessionKeys } from '@/shared/api/sessions';
import type { SessionDto } from '@/shared/api/sessions';

// ---------------------------------------------------------------------------
// User-Agent Parsing (lightweight, no external dependency)
// ---------------------------------------------------------------------------

interface ParsedUserAgent {
  browser: string;
  os: string;
  device: 'desktop' | 'mobile' | 'tablet' | 'unknown';
}

function parseUserAgent(ua: string | null): ParsedUserAgent {
  if (!ua) {
    return { browser: 'Unknown browser', os: 'Unknown OS', device: 'unknown' };
  }

  // Browser detection
  let browser = 'Unknown browser';
  if (/Edg\//i.test(ua)) {
    const match = ua.match(/Edg\/([\d.]+)/);
    browser = `Edge ${match?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/OPR\//i.test(ua) || /Opera/i.test(ua)) {
    const match = ua.match(/OPR\/([\d.]+)/);
    browser = `Opera ${match?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Firefox\//i.test(ua)) {
    const match = ua.match(/Firefox\/([\d.]+)/);
    browser = `Firefox ${match?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) {
    const match = ua.match(/Chrome\/([\d.]+)/);
    browser = `Chrome ${match?.[1]?.split('.')[0] ?? ''}`.trim();
  } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
    const match = ua.match(/Version\/([\d.]+)/);
    browser = `Safari ${match?.[1]?.split('.')[0] ?? ''}`.trim();
  }

  // OS detection
  let os = 'Unknown OS';
  if (/Windows NT 10/i.test(ua)) {
    os = 'Windows 10/11';
  } else if (/Windows NT/i.test(ua)) {
    os = 'Windows';
  } else if (/Mac OS X/i.test(ua)) {
    const match = ua.match(/Mac OS X ([\d_]+)/);
    const version = match?.[1]?.replace(/_/g, '.') ?? '';
    os = `macOS ${version}`.trim();
  } else if (/Android ([\d.]+)/i.test(ua)) {
    const match = ua.match(/Android ([\d.]+)/);
    os = `Android ${match?.[1] ?? ''}`.trim();
  } else if (/iPhone|iPad|iPod/i.test(ua)) {
    const match = ua.match(/OS ([\d_]+)/);
    const version = match?.[1]?.replace(/_/g, '.') ?? '';
    os = `iOS ${version}`.trim();
  } else if (/Linux/i.test(ua)) {
    os = 'Linux';
  } else if (/CrOS/i.test(ua)) {
    os = 'Chrome OS';
  }

  // Device type detection
  let device: ParsedUserAgent['device'] = 'desktop';
  if (/iPad/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) {
    device = 'tablet';
  } else if (/iPhone|iPod|Android.*Mobile|webOS|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    device = 'mobile';
  }

  return { browser, os, device };
}

// ---------------------------------------------------------------------------
// Device icon helper
// ---------------------------------------------------------------------------

function DeviceIcon({ device }: { device: ParsedUserAgent['device'] }) {
  switch (device) {
    case 'mobile':
      return <MobileOutlined style={{ fontSize: 24 }} />;
    case 'tablet':
      return <TabletOutlined style={{ fontSize: 24 }} />;
    case 'desktop':
      return <DesktopOutlined style={{ fontSize: 24 }} />;
    default:
      return <GlobalOutlined style={{ fontSize: 24 }} />;
  }
}

// ---------------------------------------------------------------------------
// Date formatting
// ---------------------------------------------------------------------------

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMs / 3_600_000);
  const diffDays = Math.floor(diffMs / 86_400_000);

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Current session detection
//
// The JWT payload includes a sessionId. We read it from localStorage to
// identify which session belongs to the current browser tab.
// ---------------------------------------------------------------------------

function getCurrentSessionId(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('notesaner-auth');
    if (!raw) return null;

    const persisted = JSON.parse(raw) as {
      state?: { accessToken?: string | null };
    };
    const token = persisted?.state?.accessToken;
    if (!token) return null;

    // Decode the JWT payload (middle segment) without verification.
    // This is safe because we only use it for UI display — the server
    // does the actual authorization.
    const payloadB64 = token.split('.')[1];
    if (!payloadB64) return null;

    const payload = JSON.parse(atob(payloadB64)) as { sessionId?: string };
    return payload.sessionId ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// SessionsSettings component
// ---------------------------------------------------------------------------

export function SessionsSettings() {
  const { message: messageApi, modal } = App.useApp();
  const queryClient = useQueryClient();

  const currentSessionId = useMemo(() => getCurrentSessionId(), []);

  // Fetch sessions via TanStack Query -- no useEffect
  const {
    data: sessions = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: sessionKeys.list(),
    queryFn: sessionsApi.getSessions,
    staleTime: 60 * 1000, // 1 minute
  });

  // Revoke a single session
  const revokeMutation = useMutation({
    mutationFn: sessionsApi.revokeSession,
    onSuccess: () => {
      messageApi.success('Session revoked successfully.');
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
    onError: () => {
      messageApi.error('Failed to revoke session. Please try again.');
    },
  });

  // Revoke all other sessions
  const revokeAllMutation = useMutation({
    mutationFn: sessionsApi.revokeAllOtherSessions,
    onSuccess: () => {
      messageApi.success('All other sessions have been revoked.');
      void queryClient.invalidateQueries({ queryKey: sessionKeys.all });
    },
    onError: () => {
      messageApi.error('Failed to revoke sessions. Please try again.');
    },
  });

  function handleRevokeSession(session: SessionDto) {
    const parsed = parseUserAgent(session.userAgent);
    modal.confirm({
      title: 'Revoke session',
      icon: <ExclamationCircleFilled />,
      content: `This will sign out the ${parsed.browser} session on ${parsed.os}. The user will need to log in again.`,
      okText: 'Revoke',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => revokeMutation.mutateAsync(session.id),
    });
  }

  function handleRevokeAllOtherSessions() {
    const otherCount = sessions.filter((s) => s.id !== currentSessionId).length;
    if (otherCount === 0) {
      messageApi.info('No other sessions to revoke.');
      return;
    }

    modal.confirm({
      title: 'Revoke all other sessions',
      icon: <ExclamationCircleFilled />,
      content: `This will sign out ${otherCount} other session${otherCount > 1 ? 's' : ''}. Only your current session will remain active.`,
      okText: 'Revoke all',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => revokeAllMutation.mutateAsync(),
    });
  }

  // Sort: current session first, then by createdAt descending
  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      if (a.id === currentSessionId) return -1;
      if (b.id === currentSessionId) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [sessions, currentSessionId]);

  const otherSessionCount = sessions.filter((s) => s.id !== currentSessionId).length;

  if (isLoading) {
    return (
      <Box className="max-w-2xl">
        <Skeleton active paragraph={{ rows: 6 }} />
      </Box>
    );
  }

  if (isError) {
    return (
      <Box className="max-w-2xl">
        <Empty description="Failed to load sessions" image={Empty.PRESENTED_IMAGE_SIMPLE}>
          <Button type="primary" onClick={() => refetch()}>
            Retry
          </Button>
        </Empty>
      </Box>
    );
  }

  return (
    <Box className="max-w-2xl">
      {/* Description and bulk action */}
      <Box className="mb-4">
        <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
          These are the devices that are currently logged in to your account. Revoke any sessions
          that you do not recognize.
        </Typography.Paragraph>

        {otherSessionCount > 0 && (
          <Button
            danger
            type="default"
            icon={<DeleteOutlined />}
            loading={revokeAllMutation.isPending}
            onClick={handleRevokeAllOtherSessions}
          >
            Revoke all other sessions
          </Button>
        )}
      </Box>

      {/* Sessions list */}
      {sortedSessions.length === 0 ? (
        <Empty description="No active sessions" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      ) : (
        <List
          dataSource={sortedSessions}
          rowKey="id"
          split={false}
          renderItem={(session) => {
            const isCurrent = session.id === currentSessionId;
            const parsed = parseUserAgent(session.userAgent);
            const isRevoking = revokeMutation.isPending && revokeMutation.variables === session.id;

            return (
              <List.Item style={{ padding: '6px 0' }}>
                <Card
                  size="small"
                  style={{
                    width: '100%',
                    borderColor: isCurrent ? 'var(--ant-color-primary)' : undefined,
                    borderWidth: isCurrent ? 2 : 1,
                  }}
                  styles={{
                    body: { padding: '12px 16px' },
                  }}
                >
                  <Box className="flex items-start gap-4">
                    {/* Device icon */}
                    <Box
                      className="flex items-center justify-center shrink-0 rounded-lg"
                      style={{
                        width: 48,
                        height: 48,
                        backgroundColor: isCurrent
                          ? 'var(--ant-color-primary-bg)'
                          : 'var(--ant-color-fill-quaternary)',
                        color: isCurrent
                          ? 'var(--ant-color-primary)'
                          : 'var(--ant-color-text-secondary)',
                      }}
                    >
                      <DeviceIcon device={parsed.device} />
                    </Box>

                    {/* Session details */}
                    <Box className="flex-1 min-w-0">
                      <Box className="flex items-center gap-2 mb-1">
                        <Typography.Text strong style={{ fontSize: 14 }}>
                          {parsed.browser}
                        </Typography.Text>
                        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                          on {parsed.os}
                        </Typography.Text>
                        {isCurrent && (
                          <Tag
                            icon={<CheckCircleOutlined />}
                            color="success"
                            style={{ marginLeft: 4, marginRight: 0 }}
                          >
                            This device
                          </Tag>
                        )}
                      </Box>

                      <Space size="middle" wrap>
                        {session.ipAddress && (
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            <GlobalOutlined style={{ marginRight: 4 }} />
                            {session.ipAddress}
                          </Typography.Text>
                        )}

                        <Tooltip title={`Signed in: ${formatFullDate(session.createdAt)}`}>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            <ClockCircleOutlined style={{ marginRight: 4 }} />
                            {formatRelativeTime(session.createdAt)}
                          </Typography.Text>
                        </Tooltip>
                      </Space>
                    </Box>

                    {/* Revoke action */}
                    {!isCurrent && (
                      <Box className="shrink-0">
                        <Button
                          danger
                          size="small"
                          type="text"
                          icon={<DeleteOutlined />}
                          loading={isRevoking}
                          onClick={() => handleRevokeSession(session)}
                        >
                          Revoke
                        </Button>
                      </Box>
                    )}
                  </Box>
                </Card>
              </List.Item>
            );
          }}
        />
      )}
    </Box>
  );
}
