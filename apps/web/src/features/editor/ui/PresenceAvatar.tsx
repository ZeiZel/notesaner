'use client';

/**
 * PresenceAvatar — individual avatar with name tooltip for presence indicators.
 *
 * Renders either an image avatar or a colored initial circle, with a green
 * online status dot and a tooltip showing the user's display name.
 *
 * Design decisions:
 *   - No useEffect — all visual state is derived from props.
 *   - Tooltip uses native `title` attribute for simplicity; can be upgraded
 *     to Radix Tooltip when the UI library is extended.
 *   - Online status dot is absolutely positioned at bottom-right.
 *   - Colors are deterministic per user (via getPresenceColor).
 */

import { cn } from '@/shared/lib/utils';
import type { PresenceUser } from '@/shared/hooks/usePresence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceAvatarProps {
  /** The presence user to render. */
  user: PresenceUser;
  /** Avatar size in pixels. Defaults to 28. */
  size?: number;
  /** Whether to show the online status dot. Defaults to true. */
  showStatus?: boolean;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceAvatar({
  user,
  size = 28,
  showStatus = true,
  className,
}: PresenceAvatarProps) {
  const initial = user.displayName.charAt(0).toUpperCase();
  const statusDotSize = Math.max(6, Math.round(size * 0.28));
  const fontSize = Math.max(10, Math.round(size * 0.4));

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: size, height: size }}
      title={user.displayName}
      aria-label={`${user.displayName}${user.isOnline ? ' (online)' : ' (away)'}`}
    >
      {/* Avatar circle */}
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt={user.displayName}
          className="rounded-full object-cover ring-2 ring-background"
          style={{ width: size, height: size }}
          loading="lazy"
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-background"
          style={{
            width: size,
            height: size,
            backgroundColor: user.color,
            fontSize: `${fontSize}px`,
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {initial}
        </div>
      )}

      {/* Online status dot */}
      {showStatus && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full ring-2 ring-background',
            user.isOnline ? 'bg-green-500' : 'bg-gray-400',
          )}
          style={{
            width: statusDotSize,
            height: statusDotSize,
          }}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

PresenceAvatar.displayName = 'PresenceAvatar';
