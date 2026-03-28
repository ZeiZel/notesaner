'use client';

/**
 * PresenceDot -- small colored dot indicating that users are viewing a note.
 *
 * Used in the file explorer to show at-a-glance which notes have active
 * viewers. Uses Ant Design Badge and Tooltip for consistent UI.
 *
 * Design decisions:
 *   - No useEffect -- viewer count and color are derived from props.
 *   - Ant Design Tooltip for name list.
 *   - Badge dot for the indicator.
 */

import { Badge, Tooltip } from 'antd';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceDotUser {
  userId: string;
  displayName: string;
  color: string;
}

export interface PresenceDotProps {
  /** Users currently viewing this note. */
  viewers: PresenceDotUser[];
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
    <Tooltip title={tooltipText} placement="right" mouseEnterDelay={0.3}>
      <Badge
        color={dotColor}
        className={cn('inline-flex shrink-0', className)}
        dot
        offset={[0, 0]}
        style={{
          width: size,
          height: size,
          minWidth: size,
        }}
      >
        <span className="sr-only" role="status" aria-label={tooltipText} />
      </Badge>
    </Tooltip>
  );
}

PresenceDot.displayName = 'PresenceDot';
