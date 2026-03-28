'use client';

/**
 * PresenceDot — small colored dot indicating that users are viewing a note.
 *
 * Used in the file explorer to show at-a-glance which notes have active
 * viewers. The dot color reflects the first viewer's presence color.
 * A tooltip shows the count and names of active viewers.
 *
 * Design decisions:
 *   - No useEffect — viewer count and color are derived from props.
 *   - Tooltip uses native `title` for simplicity.
 */

import { cn } from '@/shared/lib/utils';
import type { PresenceUser } from '@/shared/hooks/usePresence';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceDotProps {
  /** Users currently viewing this note. */
  viewers: PresenceUser[];
  /** Dot size in pixels. Defaults to 6. */
  size?: number;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceDot({ viewers, size = 6, className }: PresenceDotProps) {
  if (viewers.length === 0) return null;

  // Use the first viewer's color for the dot
  const dotColor = viewers[0].color;
  const tooltipText =
    viewers.length === 1
      ? `${viewers[0].displayName} is viewing`
      : `${viewers.length} users viewing: ${viewers.map((v) => v.displayName).join(', ')}`;

  return (
    <span
      className={cn('inline-block shrink-0 rounded-full', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: dotColor,
      }}
      title={tooltipText}
      aria-label={tooltipText}
      role="status"
    />
  );
}

PresenceDot.displayName = 'PresenceDot';
