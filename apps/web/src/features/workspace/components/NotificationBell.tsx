'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useNotificationStore } from '@/shared/stores/notification-store';
import { NotificationCenter } from './NotificationCenter';
import type { NotificationDto } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Polling interval for unread count in milliseconds (30 seconds). */
const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationBellProps {
  /** Called when a notification is clicked for navigation. */
  onNotificationClick?: (notification: NotificationDto) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationBell -- bell icon button with unread badge and dropdown panel.
 *
 * Features:
 *   - Displays unread notification count as a badge
 *   - Polls for unread count every 30 seconds
 *   - Toggles the NotificationCenter dropdown on click
 *   - Animates the badge when count changes
 *   - Keyboard accessible
 */
export function NotificationBell({ onNotificationClick, className }: NotificationBellProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const { unreadCount, isOpen, toggleOpen, setOpen, fetchUnreadCount } = useNotificationStore();

  const bellRef = useRef<HTMLButtonElement>(null);

  // Poll for unread count
  useEffect(() => {
    if (!accessToken) return;

    // Initial fetch
    void fetchUnreadCount(accessToken);

    // Set up polling interval
    const intervalId = setInterval(() => {
      void fetchUnreadCount(accessToken);
    }, POLL_INTERVAL_MS);

    return () => clearInterval(intervalId);
  }, [accessToken, fetchUnreadCount]);

  const handleClose = useCallback(() => {
    setOpen(false);
    // Return focus to the bell button when closing
    bellRef.current?.focus();
  }, [setOpen]);

  const handleToggle = useCallback(() => {
    toggleOpen();
  }, [toggleOpen]);

  return (
    <div className={cn('relative', className)}>
      {/* Bell button */}
      <button
        ref={bellRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          'relative inline-flex items-center justify-center rounded-md p-2',
          'text-muted-foreground transition-colors',
          'hover:bg-muted hover:text-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isOpen && 'bg-muted text-foreground',
        )}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <Bell className="h-5 w-5" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4.5 min-w-4.5 items-center justify-center',
              'rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground',
              'animate-in zoom-in-75',
            )}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <NotificationCenter
          onClose={handleClose}
          onNotificationClick={onNotificationClick}
          className="absolute right-0 top-full z-50 mt-2"
        />
      )}
    </div>
  );
}
