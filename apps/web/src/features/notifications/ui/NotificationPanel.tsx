'use client';

/**
 * NotificationPanel -- the popover content for the notification bell.
 *
 * Features:
 *   - Header with title and "Mark all as read" button
 *   - Type filter segmented control
 *   - Scrollable notification list with infinite scroll via IntersectionObserver
 *   - Empty state when no notifications
 *   - Loading spinner for initial fetch and load-more
 *
 * All data flows through the notification Zustand store.
 * No useEffect for data fetching -- initial fetch is triggered by the
 * parent (NotificationBell) when the popover opens. Infinite scroll uses
 * a ref callback with IntersectionObserver (valid DOM integration use).
 */

import { useCallback, useRef, useEffect } from 'react';
import { Button, Segmented, Spin, Typography } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useNotificationStore } from '@/shared/stores/notification-store';
import type { NotificationType } from '@/shared/api/notifications';
import { NotificationItem } from './NotificationItem';
import { NotificationEmptyState } from './NotificationEmptyState';
import { getNotificationUrl } from '../lib/notification-helpers';

// ---------------------------------------------------------------------------
// Filter options
// ---------------------------------------------------------------------------

interface FilterOption {
  label: string;
  value: string;
}

const FILTER_OPTIONS: FilterOption[] = [
  { label: 'All', value: 'all' },
  { label: 'Mentions', value: 'COMMENT_MENTION' },
  { label: 'Shared', value: 'NOTE_SHARED' },
  { label: 'Invites', value: 'WORKSPACE_INVITE' },
  { label: 'System', value: 'SYSTEM_ANNOUNCEMENT' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface NotificationPanelProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const token = useAuthStore((s) => s.accessToken);
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const hasMore = useNotificationStore((s) => s.hasMore);
  const filterType = useNotificationStore((s) => s.filterType);
  const setFilterType = useNotificationStore((s) => s.setFilterType);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const loadMore = useNotificationStore((s) => s.loadMore);

  // ---------------------------------------------------------------------------
  // Infinite scroll via IntersectionObserver
  // Valid useEffect: DOM API integration (IntersectionObserver) that cannot
  // be expressed as a state derivation or event handler.
  // ---------------------------------------------------------------------------

  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sentinelRef.current || !hasMore || isLoading || !token) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !isLoading && token) {
          void loadMore(token);
        }
      },
      { threshold: 0.5 },
    );

    observer.observe(sentinelRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMore, isLoading, token, loadMore]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleFilterChange(value: string | number) {
    const stringValue = String(value);
    const type = stringValue === 'all' ? null : (stringValue as NotificationType);
    setFilterType(type);
    if (token) {
      void fetchNotifications(token, true);
    }
  }

  function handleMarkAllAsRead() {
    if (token) {
      void markAllAsRead(token);
    }
  }

  const handleNotificationRead = useCallback(
    (id: string) => {
      if (token) {
        void markAsRead(token, id);
      }
    },
    [token, markAsRead],
  );

  const handleNotificationClick = useCallback(
    (notification: (typeof notifications)[0]) => {
      // Mark as read on click
      if (!notification.isRead && token) {
        void markAsRead(token, notification.id);
      }

      // Navigate to the relevant resource
      const url = getNotificationUrl(notification.type, notification.metadata);
      if (url) {
        // Use native navigation (Next.js router is not available in feature layer).
        // In production, this should be replaced with router.push from the widget layer.
        window.location.href = url;
        onClose();
      }
    },
    [token, markAsRead, onClose],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const isEmpty = notifications.length === 0 && !isLoading;

  return (
    <Box
      className="flex flex-col"
      style={{
        width: 400,
        maxHeight: 520,
        backgroundColor: 'var(--ns-color-background)',
      }}
    >
      {/* Header */}
      <Box
        className="flex items-center justify-between border-b px-4 py-3"
        style={{ borderColor: 'var(--ns-color-border)' }}
      >
        <Box className="flex items-center gap-2">
          <Typography.Text strong style={{ fontSize: 15 }}>
            Notifications
          </Typography.Text>
          {unreadCount > 0 && (
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 12,
                backgroundColor: 'var(--ns-color-primary-bg, rgba(22, 119, 255, 0.08))',
                color: '#1677ff',
                padding: '1px 8px',
                borderRadius: 10,
              }}
            >
              {unreadCount} unread
            </Typography.Text>
          )}
        </Box>

        {unreadCount > 0 && (
          <Button type="text" size="small" icon={<CheckOutlined />} onClick={handleMarkAllAsRead}>
            Mark all read
          </Button>
        )}
      </Box>

      {/* Type filter */}
      <Box className="border-b px-4 py-2" style={{ borderColor: 'var(--ns-color-border)' }}>
        <Segmented
          block
          size="small"
          value={filterType ?? 'all'}
          options={FILTER_OPTIONS}
          onChange={handleFilterChange}
        />
      </Box>

      {/* Notification list */}
      <Box className="flex-1 overflow-y-auto" style={{ minHeight: 200 }}>
        {isEmpty && <NotificationEmptyState />}

        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={handleNotificationRead}
            onClick={handleNotificationClick}
          />
        ))}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <Box ref={sentinelRef} className="flex items-center justify-center py-4">
            <Spin size="small" />
          </Box>
        )}

        {/* Loading state (initial fetch) */}
        {isLoading && notifications.length === 0 && (
          <Box className="flex items-center justify-center py-8">
            <Spin />
          </Box>
        )}
      </Box>
    </Box>
  );
}
