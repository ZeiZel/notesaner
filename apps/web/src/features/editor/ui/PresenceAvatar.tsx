'use client';

/**
 * PresenceAvatar -- individual avatar with rich tooltip for presence indicators.
 *
 * Uses Ant Design Avatar, Badge, and Tooltip for a polished UI.
 * Shows: avatar image or colored initial, online/away/offline status badge,
 * tooltip with name and optional cursor position description.
 *
 * Design decisions:
 *   - No useEffect -- all visual state is derived from props.
 *   - Uses Ant Design Avatar (no raw HTML for the circle).
 *   - Badge for online/away/offline status dot.
 *   - Tooltip for name + cursor position description.
 */

import { Avatar, Badge, Tooltip } from 'antd';
import { cn } from '@/shared/lib/utils';
import type { PresenceStatus } from '@/shared/stores/presence-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceAvatarUser {
  /** Unique user ID. */
  userId: string;
  /** Display name shown in the tooltip. */
  displayName: string;
  /** URL to the user's avatar image. Null if no avatar is set. */
  avatarUrl: string | null;
  /** Deterministic presence color. */
  color: string;
  /** Presence status: online, away, or offline. */
  status: PresenceStatus;
  /** Cursor position description (e.g. "Line 42, Col 8"). Null if unknown. */
  cursorDescription?: string | null;
}

export interface PresenceAvatarProps {
  /** The user to render. */
  user: PresenceAvatarUser;
  /** Avatar size in pixels. Defaults to 28. */
  size?: number;
  /** Whether to show the status badge. Defaults to true. */
  showStatus?: boolean;
  /** Whether to show the tooltip. Defaults to true. */
  showTooltip?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<PresenceStatus, string> = {
  online: '#52c41a',
  away: '#faad14',
  offline: '#8c8c8c',
};

const STATUS_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  away: 'Away',
  offline: 'Offline',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceAvatar({
  user,
  size = 28,
  showStatus = true,
  showTooltip = true,
  className,
}: PresenceAvatarProps) {
  const initial = user.displayName.charAt(0).toUpperCase();
  const statusColor = STATUS_COLORS[user.status];

  const tooltipContent = (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium">{user.displayName}</span>
      <span className="text-[10px] opacity-75">{STATUS_LABELS[user.status]}</span>
      {user.cursorDescription && (
        <span className="text-[10px] opacity-60">{user.cursorDescription}</span>
      )}
    </div>
  );

  const avatar = showStatus ? (
    <Badge
      dot
      offset={[-2, size - 4]}
      color={statusColor}
      className={cn('inline-flex shrink-0', className)}
    >
      {user.avatarUrl ? (
        <Avatar
          src={user.avatarUrl}
          alt={user.displayName}
          size={size}
          style={{
            border: '2px solid var(--color-background, #fff)',
          }}
        />
      ) : (
        <Avatar
          size={size}
          style={{
            backgroundColor: user.color,
            color: '#1e1e2e',
            fontSize: `${Math.max(10, Math.round(size * 0.4))}px`,
            fontWeight: 600,
            border: '2px solid var(--color-background, #fff)',
          }}
          alt={user.displayName}
        >
          {initial}
        </Avatar>
      )}
    </Badge>
  ) : (
    <span className={cn('inline-flex shrink-0', className)}>
      {user.avatarUrl ? (
        <Avatar
          src={user.avatarUrl}
          alt={user.displayName}
          size={size}
          style={{
            border: '2px solid var(--color-background, #fff)',
          }}
        />
      ) : (
        <Avatar
          size={size}
          style={{
            backgroundColor: user.color,
            color: '#1e1e2e',
            fontSize: `${Math.max(10, Math.round(size * 0.4))}px`,
            fontWeight: 600,
            border: '2px solid var(--color-background, #fff)',
          }}
          alt={user.displayName}
        >
          {initial}
        </Avatar>
      )}
    </span>
  );

  if (!showTooltip) return avatar;

  return (
    <Tooltip title={tooltipContent} placement="bottom" mouseEnterDelay={0.3}>
      {avatar}
    </Tooltip>
  );
}

PresenceAvatar.displayName = 'PresenceAvatar';
