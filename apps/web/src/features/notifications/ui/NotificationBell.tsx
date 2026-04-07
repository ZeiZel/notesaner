'use client';

/**
 * NotificationBell -- bell icon button with unread count badge.
 *
 * Renders in the workspace header toolbar. Clicking opens a Popover
 * containing the NotificationPanel. Initial data fetch is triggered
 * when the popover opens (event-handler-driven, not useEffect).
 *
 * Uses Ant Design Badge + Popover. No useEffect for data fetching.
 */

import { Badge, Popover } from 'antd';
import { BellOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useNotificationStore } from '@/shared/stores/notification-store';
import { NotificationPanel } from './NotificationPanel';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationBell() {
  const token = useAuthStore((s) => s.accessToken);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isOpen = useNotificationStore((s) => s.isOpen);
  const setOpen = useNotificationStore((s) => s.setOpen);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  function handleOpenChange(open: boolean) {
    setOpen(open);

    // Fetch notifications when opening the panel (event-driven, not effect-driven)
    if (open && token) {
      void fetchNotifications(token, true);
    }
  }

  function handleClose() {
    setOpen(false);
  }

  // Fetch unread count on first render via open handler is sufficient;
  // the WebSocket will keep it updated in real time after that.
  // If the bell is visible but never clicked, the WebSocket push handles it.

  return (
    <Popover
      open={isOpen}
      onOpenChange={handleOpenChange}
      content={<NotificationPanel onClose={handleClose} />}
      trigger="click"
      placement="bottomRight"
      arrow={false}
      styles={{ root: { width: 400 }, body: { padding: 0 } }}
      destroyOnHidden
    >
      <button
        type="button"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-haspopup="true"
        aria-expanded={isOpen}
        className="flex h-7 w-7 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground sm:h-6 sm:w-6"
      >
        <Badge count={unreadCount} size="small" overflowCount={99} offset={[2, -2]}>
          <BellOutlined style={{ fontSize: 14 }} />
        </Badge>
      </button>
    </Popover>
  );
}
