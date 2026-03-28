'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Check, CheckCheck, Filter, Loader2, X } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useNotificationStore } from '@/shared/stores/notification-store';
import { NotificationItem } from './NotificationItem';
import type { NotificationDto, NotificationType } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationCenterProps {
  /** Called when the panel should close (e.g. clicking outside). */
  onClose: () => void;
  /** Called when a notification is clicked for navigation. */
  onNotificationClick?: (notification: NotificationDto) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Filter buttons
// ---------------------------------------------------------------------------

const FILTER_OPTIONS: Array<{ label: string; value: NotificationType | null }> = [
  { label: 'All', value: null },
  { label: 'Mentions', value: 'COMMENT_MENTION' },
  { label: 'Shared', value: 'NOTE_SHARED' },
  { label: 'Invites', value: 'WORKSPACE_INVITE' },
  { label: 'System', value: 'SYSTEM_ANNOUNCEMENT' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationCenter -- dropdown panel showing the user's notifications.
 *
 * Features:
 *   - Paginated notification list with infinite scroll
 *   - Type-based filtering (all, mentions, shared, invites, system)
 *   - Mark individual or all notifications as read
 *   - Empty state for no notifications
 *   - Keyboard accessible (Escape to close, Tab through items)
 *   - Click outside to close
 */
export function NotificationCenter({
  onClose,
  onNotificationClick,
  className,
}: NotificationCenterProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const {
    notifications,
    unreadCount,
    isLoading,
    hasMore,
    filterType,
    setFilterType,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    loadMore,
  } = useNotificationStore();

  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fetch on mount and when filter changes
  useEffect(() => {
    if (accessToken) {
      void fetchNotifications(accessToken, true);
    }
  }, [accessToken, fetchNotifications, filterType]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Delay to avoid immediate close from the trigger click
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Infinite scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !accessToken) return;

    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight - scrollTop - clientHeight < 100 && hasMore && !isLoading) {
      void loadMore(accessToken);
    }
  }, [accessToken, hasMore, isLoading, loadMore]);

  const handleMarkAsRead = useCallback(
    (notificationId: string) => {
      if (accessToken) {
        void markAsRead(accessToken, notificationId);
      }
    },
    [accessToken, markAsRead],
  );

  const handleMarkAllAsRead = useCallback(() => {
    if (accessToken) {
      void markAllAsRead(accessToken);
    }
  }, [accessToken, markAllAsRead]);

  return (
    <div
      ref={panelRef}
      className={cn(
        'flex w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border bg-popover shadow-lg',
        'animate-in fade-in-0 zoom-in-95 slide-in-from-top-2',
        className,
      )}
      role="dialog"
      aria-label="Notification center"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-foreground">Notifications</h2>
          {unreadCount > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Mark all as read"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Mark all read</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="Close notifications"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b px-3 py-2">
        <Filter className="mr-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value ?? 'all'}
            type="button"
            onClick={() => setFilterType(option.value)}
            className={cn(
              'shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
              filterType === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Notification list */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="max-h-[420px] min-h-[200px] overflow-y-auto"
      >
        {notifications.length === 0 && !isLoading ? (
          <EmptyState filterType={filterType} />
        ) : (
          <div className="divide-y">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
                onClick={onNotificationClick}
              />
            ))}
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* End of list */}
        {!hasMore && notifications.length > 0 && !isLoading && (
          <div className="flex items-center justify-center py-4">
            <p className="text-xs text-muted-foreground">No more notifications</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-center border-t px-4 py-2">
        <a
          href="/settings/notifications"
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Notification preferences
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function EmptyState({ filterType }: { filterType: NotificationType | null }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Check className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mt-3 text-sm font-medium text-foreground">All caught up</p>
      <p className="mt-1 text-xs text-muted-foreground text-center">
        {filterType
          ? `No ${filterType.toLowerCase().replace('_', ' ')} notifications`
          : 'You have no notifications yet'}
      </p>
    </div>
  );
}
