'use client';

/**
 * WorkspacePresencePanel -- shows online/away/offline status for all
 * workspace members within the member list.
 *
 * This component is designed to be composed into the MembersList or
 * rendered as a standalone panel in the sidebar.
 *
 * Design decisions:
 *   - No useEffect -- all state is derived from the presence store.
 *   - Uses Ant Design Avatar, Badge, Typography for consistent UI.
 *   - Groups users by status: online first, then away, then offline.
 */

import { Avatar, Badge, Typography, Empty } from 'antd';
import { cn } from '@/shared/lib/utils';
import {
  usePresenceStore,
  selectPresenceUsers,
  type PresenceStatus,
} from '@/shared/stores/presence-store';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspacePresencePanelProps {
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_ORDER: Record<PresenceStatus, number> = {
  online: 0,
  away: 1,
  offline: 2,
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkspacePresencePanel({ className }: WorkspacePresencePanelProps) {
  const users = usePresenceStore(selectPresenceUsers);
  const isConnected = usePresenceStore((state) => state.isConnected);

  // Sort by status: online first, then away, then offline
  const sortedUsers = [...users].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);

  const onlineCount = users.filter((u) => u.status === 'online').length;

  if (!isConnected) {
    return (
      <div className={cn('p-4', className)}>
        <Empty description="Presence unavailable" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  if (sortedUsers.length === 0) {
    return (
      <div className={cn('p-4', className)}>
        <Empty description="No other users online" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <Text strong className="text-xs uppercase tracking-wider text-foreground-muted">
          Presence
        </Text>
        <Badge
          status="success"
          text={
            <Text type="secondary" className="text-[10px]">
              {onlineCount} online
            </Text>
          }
        />
      </div>

      {/* User list */}
      <div className="space-y-0.5">
        {sortedUsers.map((user) => {
          const initial = user.displayName.charAt(0).toUpperCase();

          return (
            <div
              key={user.userId}
              className="flex items-center gap-2.5 rounded-md px-3 py-1.5 transition-colors hover:bg-background-hover"
            >
              <Badge
                dot
                color={
                  user.status === 'online'
                    ? '#52c41a'
                    : user.status === 'away'
                      ? '#faad14'
                      : '#8c8c8c'
                }
                offset={[-2, 22]}
              >
                {user.avatarUrl ? (
                  <Avatar src={user.avatarUrl} alt={user.displayName} size={24} />
                ) : (
                  <Avatar
                    size={24}
                    style={{
                      backgroundColor: user.color,
                      color: '#1e1e2e',
                      fontSize: '11px',
                      fontWeight: 600,
                    }}
                    alt={user.displayName}
                  >
                    {initial}
                  </Avatar>
                )}
              </Badge>

              <div className="flex min-w-0 flex-1 flex-col">
                <Text className="truncate text-xs font-medium leading-tight">
                  {user.displayName}
                </Text>
                <Text type="secondary" className="text-[10px] leading-tight">
                  {STATUS_LABELS[user.status]}
                  {user.activeNoteId && user.status !== 'offline' && <> &middot; Editing</>}
                </Text>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

WorkspacePresencePanel.displayName = 'WorkspacePresencePanel';
