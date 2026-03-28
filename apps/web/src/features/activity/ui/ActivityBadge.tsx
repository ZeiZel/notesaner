'use client';

import { Badge, Tooltip, Button } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useNotificationStore } from '@/shared/stores/notification-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityBadgeProps {
  onClick?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * ActivityBadge shows a clock icon with an unread notification badge.
 * Placed in the sidebar as the entry point to the activity feed page.
 *
 * Leverages the existing notification store's unread count since activity
 * notifications are a subset of all notifications.
 */
export function ActivityBadge({ onClick }: ActivityBadgeProps) {
  const unreadCount = useNotificationStore((s) => s.unreadCount);

  return (
    <Tooltip title="Activity feed" placement="right">
      <Badge count={unreadCount} size="small" offset={[-4, 4]}>
        <Button
          type="text"
          icon={<HistoryOutlined style={{ fontSize: 18 }} />}
          onClick={onClick}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        />
      </Badge>
    </Tooltip>
  );
}
