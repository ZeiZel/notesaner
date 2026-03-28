'use client';

import { useCallback } from 'react';
import { AtSign, Share2, UserPlus, Megaphone, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { formatRelativeTime } from '@/shared/lib/utils';
import type { NotificationDto, NotificationType } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationItemProps {
  notification: NotificationDto;
  onMarkAsRead: (id: string) => void;
  onClick?: (notification: NotificationDto) => void;
}

// ---------------------------------------------------------------------------
// Notification type config
// ---------------------------------------------------------------------------

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: LucideIcon; label: string; color: string; bgColor: string }
> = {
  COMMENT_MENTION: {
    icon: AtSign,
    label: 'Mention',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900/40',
  },
  NOTE_SHARED: {
    icon: Share2,
    label: 'Shared',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-100 dark:bg-emerald-900/40',
  },
  WORKSPACE_INVITE: {
    icon: UserPlus,
    label: 'Invite',
    color: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-100 dark:bg-violet-900/40',
  },
  SYSTEM_ANNOUNCEMENT: {
    icon: Megaphone,
    label: 'System',
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-100 dark:bg-amber-900/40',
  },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NotificationItem -- renders a single notification in the notification center.
 *
 * Shows an icon by type, title, body, and relative timestamp.
 * Unread notifications have a dot indicator and slightly different background.
 * Clicking marks as read and triggers the optional onClick callback.
 */
export function NotificationItem({ notification, onMarkAsRead, onClick }: NotificationItemProps) {
  const config = TYPE_CONFIG[notification.type];
  const Icon = config.icon;

  const handleClick = useCallback(() => {
    if (!notification.isRead) {
      onMarkAsRead(notification.id);
    }
    onClick?.(notification);
  }, [notification, onMarkAsRead, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick],
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
        'hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
        !notification.isRead && 'bg-primary/5 dark:bg-primary/10',
      )}
      aria-label={`${notification.isRead ? '' : 'Unread: '}${notification.title}`}
    >
      {/* Icon */}
      <div
        className={cn(
          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          config.bgColor,
        )}
      >
        <Icon className={cn('h-4 w-4', config.color)} aria-hidden="true" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-sm leading-tight',
              !notification.isRead ? 'font-semibold text-foreground' : 'text-foreground/80',
            )}
          >
            {notification.title}
          </p>

          {/* Unread indicator */}
          {!notification.isRead && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />
          )}
        </div>

        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground line-clamp-2">
          {notification.body}
        </p>

        <p className="mt-1 text-xs text-muted-foreground/60">
          {formatRelativeTime(notification.createdAt)}
        </p>
      </div>
    </div>
  );
}
