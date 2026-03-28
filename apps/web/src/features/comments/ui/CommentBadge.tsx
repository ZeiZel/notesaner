'use client';

/**
 * CommentBadge -- displays the unresolved comment count as a badge.
 *
 * Intended for use in toolbars, tabs, or sidebar headers to give
 * users a quick glance at how many open comment threads exist.
 *
 * Clicking the badge toggles the comment sidebar.
 *
 * No useEffect -- count is derived from the comment store at render time.
 */

import { Badge, Button, Tooltip } from 'antd';
import { CommentOutlined } from '@ant-design/icons';
import { useCommentStore, selectUnresolvedCount } from '@/shared/stores/comment-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentBadgeProps {
  /** Called when the badge is clicked. Defaults to toggling the sidebar. */
  onClick?: () => void;
  /** Additional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentBadge({ onClick, className }: CommentBadgeProps) {
  const threads = useCommentStore((s) => s.threads);
  const toggleSidebar = useCommentStore((s) => s.toggleSidebar);

  const unresolvedCount = selectUnresolvedCount(threads);

  function handleClick() {
    if (onClick) {
      onClick();
    } else {
      toggleSidebar();
    }
  }

  return (
    <Tooltip title={`${unresolvedCount} open comment${unresolvedCount !== 1 ? 's' : ''}`}>
      <Badge count={unresolvedCount} size="small" offset={[-2, 2]}>
        <Button
          type="text"
          size="small"
          icon={<CommentOutlined style={{ fontSize: 16 }} />}
          onClick={handleClick}
          className={className}
          aria-label={`Comments: ${unresolvedCount} unresolved`}
        />
      </Badge>
    </Tooltip>
  );
}

CommentBadge.displayName = 'CommentBadge';
