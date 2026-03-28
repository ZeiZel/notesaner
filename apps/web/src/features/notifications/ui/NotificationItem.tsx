'use client';

/**
 * NotificationItem -- a single notification row in the notification panel.
 *
 * Displays: type icon, title, body preview, relative timestamp, unread dot.
 * Clicking navigates to the related resource and marks the notification as read.
 * A hover-visible "mark as read" button is available for keyboard and mouse users.
 *
 * Styled with Ant Design Typography + custom Tailwind for layout.
 * No useEffect -- all interactions are event-handler-driven.
 */

import { Typography, Tooltip } from 'antd';
import {
  MessageOutlined,
  ShareAltOutlined,
  TeamOutlined,
  NotificationOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { formatRelativeTime } from '@/shared/lib/utils';
import type { NotificationDto, NotificationType } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Icon mapping
// ---------------------------------------------------------------------------

const ICON_MAP: Record<NotificationType, React.ReactNode> = {
  COMMENT_MENTION: <MessageOutlined style={{ fontSize: 16 }} />,
  NOTE_SHARED: <ShareAltOutlined style={{ fontSize: 16 }} />,
  WORKSPACE_INVITE: <TeamOutlined style={{ fontSize: 16 }} />,
  SYSTEM_ANNOUNCEMENT: <NotificationOutlined style={{ fontSize: 16 }} />,
};

const ICON_COLORS: Record<NotificationType, string> = {
  COMMENT_MENTION: '#1677ff',
  NOTE_SHARED: '#52c41a',
  WORKSPACE_INVITE: '#722ed1',
  SYSTEM_ANNOUNCEMENT: '#faad14',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: NotificationDto;
  onRead: (id: string) => void;
  onClick: (notification: NotificationDto) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const { id, type, title, body, isRead, createdAt } = notification;
  const relativeTime = formatRelativeTime(createdAt);

  function handleClick() {
    onClick(notification);
  }

  function handleMarkAsRead(e: React.MouseEvent) {
    e.stopPropagation();
    if (!isRead) {
      onRead(id);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(notification);
    }
  }

  return (
    <Box
      as="button"
      type="button"
      role="button"
      tabIndex={0}
      aria-label={`${isRead ? '' : 'Unread: '}${title}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="group flex w-full cursor-pointer items-start gap-3 border-b px-4 py-3 text-left transition-colors hover:bg-[var(--ns-color-background-surface)]"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: isRead
          ? 'transparent'
          : 'var(--ns-color-primary-bg, rgba(22, 119, 255, 0.04))',
      }}
    >
      {/* Unread indicator */}
      <Box className="flex flex-col items-center pt-1" style={{ minWidth: 8 }}>
        {!isRead && (
          <Box
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: '#1677ff' }}
            aria-hidden="true"
          />
        )}
      </Box>

      {/* Type icon */}
      <Box
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `${ICON_COLORS[type]}14` }}
      >
        <span style={{ color: ICON_COLORS[type] }}>{ICON_MAP[type]}</span>
      </Box>

      {/* Content */}
      <Box className="min-w-0 flex-1">
        <Box className="flex items-center justify-between gap-2">
          <Typography.Text
            strong={!isRead}
            ellipsis
            style={{ fontSize: 13, maxWidth: '70%', display: 'block' }}
          >
            {title}
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0 }}
          >
            {relativeTime}
          </Typography.Text>
        </Box>

        {body && (
          <Typography.Text
            type="secondary"
            ellipsis
            style={{ fontSize: 12, display: 'block', marginTop: 2 }}
          >
            {body}
          </Typography.Text>
        )}
      </Box>

      {/* Mark as read button (visible on hover / focus-within) */}
      {!isRead && (
        <Tooltip title="Mark as read">
          <Box
            as="button"
            type="button"
            aria-label="Mark as read"
            onClick={handleMarkAsRead}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-[var(--ns-color-background-surface)]"
          >
            <CheckOutlined style={{ fontSize: 12, color: 'var(--ns-color-text-secondary)' }} />
          </Box>
        </Tooltip>
      )}
    </Box>
  );
}
