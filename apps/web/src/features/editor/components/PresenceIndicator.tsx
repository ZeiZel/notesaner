'use client';

/**
 * PresenceIndicator — avatar stack showing active viewers of a note.
 *
 * Renders up to `maxAvatars` (default 5) user avatars in a compact
 * overlapping stack. When there are more users than the max, an overflow
 * count badge is shown. Clicking the stack toggles an expanded list popover.
 *
 * Usage:
 *   - In the editor header: shows who is viewing the current note.
 *   - Can be embedded anywhere presence awareness is needed.
 *
 * Design decisions:
 *   - No useEffect — all display state is derived from the users prop.
 *   - Popover uses local useState (click-to-toggle), not an effect.
 *   - Negative margins create the stacked avatar overlap.
 */

import { useState } from 'react';
import { cn } from '@/shared/lib/utils';
import { PresenceAvatar } from './PresenceAvatar';
import type { PresenceUser } from '@/shared/hooks/usePresence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceIndicatorProps {
  /** List of present users to display. */
  users: PresenceUser[];
  /** Maximum number of avatars to show before overflow. Defaults to 5. */
  maxAvatars?: number;
  /** Avatar size in pixels. Defaults to 28. */
  avatarSize?: number;
  /** Additional CSS class names for the container. */
  className?: string;
}

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

  const visibleUsers = users.slice(0, maxAvatars);
  const overflowCount = users.length - maxAvatars;
  const hasOverflow = overflowCount > 0;

  // Overlap offset: ~35% of avatar size
  const overlapOffset = Math.round(avatarSize * 0.35);
  const overflowBadgeSize = avatarSize;

  return (
    <div className={cn('relative inline-flex items-center', className)}>
      {/* Avatar stack */}
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-full"
        aria-label={`${users.length} user${users.length !== 1 ? 's' : ''} viewing this note`}
        aria-expanded={isExpanded}
        aria-haspopup="true"
      >
        <div className="flex items-center" style={{ direction: 'ltr' }}>
          {visibleUsers.map((user, index) => (
            <div
              key={user.userId}
              style={{
                marginLeft: index === 0 ? 0 : -overlapOffset,
                zIndex: visibleUsers.length - index,
              }}
            >
              <PresenceAvatar user={user} size={avatarSize} showStatus={true} />
            </div>
          ))}

          {/* Overflow count badge */}
          {hasOverflow && (
            <div
              className="flex items-center justify-center rounded-full bg-secondary text-foreground-muted font-semibold ring-2 ring-background"
              style={{
                width: overflowBadgeSize,
                height: overflowBadgeSize,
                marginLeft: -overlapOffset,
                zIndex: 0,
                fontSize: `${Math.max(10, Math.round(avatarSize * 0.36))}px`,
              }}
              aria-hidden="true"
            >
              +{overflowCount}
            </div>
          )}
        </div>
      </button>

      {/* Expanded user list popover */}
      {isExpanded && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsExpanded(false)}
            aria-hidden="true"
          />

          {/* Popover */}
          <div
            role="dialog"
            aria-label="Active viewers"
            className="absolute right-0 top-full z-50 mt-2 min-w-56 rounded-lg border border-border bg-background-surface p-3 shadow-lg"
          >
            <div className="mb-2 text-xs font-semibold text-foreground">
              {users.length} active viewer{users.length !== 1 ? 's' : ''}
            </div>

            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.userId} className="flex items-center gap-2.5">
                  <PresenceAvatar user={user} size={24} showStatus={true} />
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground leading-tight">
                      {user.displayName}
                    </span>
                    <span className="text-[10px] text-foreground-muted leading-tight">
                      {user.isOnline ? 'Online' : 'Away'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

PresenceIndicator.displayName = 'PresenceIndicator';
