'use client';

/**
 * PresenceIndicator -- avatar stack showing active viewers of a note.
 *
 * Uses Ant Design Avatar.Group for the overlapping stack with automatic
 * +N overflow. Clicking the stack toggles an expanded popover list.
 *
 * Usage:
 *   - In the editor header: shows who is viewing the current note.
 *   - Can be embedded anywhere presence awareness is needed.
 *
 * Design decisions:
 *   - No useEffect -- all display state is derived from users prop.
 *   - Popover uses local useState (click-to-toggle), not an effect.
 *   - Ant Design Avatar.Group handles the overlap and overflow count.
 */

import { useState } from 'react';
import { Avatar, Badge, Popover, Space, Typography } from 'antd';
import { cn } from '@/shared/lib/utils';
import { PresenceAvatar, type PresenceAvatarUser } from './PresenceAvatar';
import type { PresenceStatus } from '@/shared/stores/presence-store';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceIndicatorProps {
  /** List of present users to display. */
  users: PresenceAvatarUser[];
  /** Maximum number of avatars to show before overflow. Defaults to 5. */
  maxAvatars?: number;
  /** Avatar size in pixels. Defaults to 28. */
  avatarSize?: number;
  /** Additional CSS class names for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: '#52c41a',
  away: '#faad14',
  offline: '#8c8c8c',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceIndicator({
  users,
  maxAvatars = 5,
  avatarSize = 28,
  className,
}: PresenceIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (users.length === 0) return null;

  const onlineCount = users.filter((u) => u.status === 'online').length;
  const awayCount = users.filter((u) => u.status === 'away').length;

  const popoverContent = (
    <div className="min-w-56 max-w-72">
      <div className="mb-2 flex items-center justify-between">
        <Text strong className="text-xs">
          {users.length} viewer{users.length !== 1 ? 's' : ''}
        </Text>
        {onlineCount > 0 && (
          <Text type="secondary" className="text-[10px]">
            {onlineCount} online{awayCount > 0 ? `, ${awayCount} away` : ''}
          </Text>
        )}
      </div>

      <Space direction="vertical" size={8} className="w-full">
        {users.map((user) => (
          <div key={user.userId} className="flex items-center gap-2.5">
            <PresenceAvatar user={user} size={24} showStatus showTooltip={false} />
            <div className="flex min-w-0 flex-1 flex-col">
              <Text className="truncate text-xs font-medium leading-tight">{user.displayName}</Text>
              <div className="flex items-center gap-1">
                <Badge
                  color={STATUS_COLORS[user.status]}
                  text={
                    <Text type="secondary" className="text-[10px] leading-tight">
                      {STATUS_LABELS[user.status]}
                    </Text>
                  }
                />
              </div>
              {user.cursorDescription && (
                <Text type="secondary" className="text-[10px] leading-tight">
                  {user.cursorDescription}
                </Text>
              )}
            </div>
          </div>
        ))}
      </Space>
    </div>
  );

  return (
    <Popover
      content={popoverContent}
      title={null}
      trigger="click"
      open={isExpanded}
      onOpenChange={setIsExpanded}
      placement="bottomRight"
    >
      <button
        type="button"
        className={cn(
          'inline-flex items-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          className,
        )}
        aria-label={`${users.length} user${users.length !== 1 ? 's' : ''} viewing this note`}
        aria-expanded={isExpanded}
        aria-haspopup="true"
      >
        <Avatar.Group
          max={{
            count: maxAvatars,
            style: {
              backgroundColor: 'var(--color-secondary, #e8e8e8)',
              color: 'var(--color-foreground-muted, #666)',
              fontSize: `${Math.max(10, Math.round(avatarSize * 0.36))}px`,
              fontWeight: 600,
              width: avatarSize,
              height: avatarSize,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-background, #fff)',
            },
          }}
          size={avatarSize}
        >
          {users.map((user) => {
            const initial = user.displayName.charAt(0).toUpperCase();
            return user.avatarUrl ? (
              <Avatar
                key={user.userId}
                src={user.avatarUrl}
                alt={user.displayName}
                size={avatarSize}
                style={{
                  border: '2px solid var(--color-background, #fff)',
                }}
              />
            ) : (
              <Avatar
                key={user.userId}
                size={avatarSize}
                style={{
                  backgroundColor: user.color,
                  color: '#1e1e2e',
                  fontSize: `${Math.max(10, Math.round(avatarSize * 0.4))}px`,
                  fontWeight: 600,
                  border: '2px solid var(--color-background, #fff)',
                }}
                alt={user.displayName}
              >
                {initial}
              </Avatar>
            );
          })}
        </Avatar.Group>
      </button>
    </Popover>
  );
}

PresenceIndicator.displayName = 'PresenceIndicator';
