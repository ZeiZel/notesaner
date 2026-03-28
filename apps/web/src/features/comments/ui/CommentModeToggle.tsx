'use client';

/**
 * CommentModeToggle -- button to show/hide comment highlights in the editor.
 *
 * Toggles the `highlightsVisible` flag in the comment store.
 * When highlights are hidden, the comment marks in the TipTap editor
 * get a `.ns-comment-mark--hidden` class that makes them transparent.
 *
 * No useEffect -- reads directly from the comment store.
 */

import { Button, Tooltip } from 'antd';
import { EyeOutlined, EyeInvisibleOutlined } from '@ant-design/icons';
import { useCommentStore } from '@/shared/stores/comment-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CommentModeToggleProps {
  /** Additional CSS class name. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentModeToggle({ className }: CommentModeToggleProps) {
  const highlightsVisible = useCommentStore((s) => s.highlightsVisible);
  const toggleHighlights = useCommentStore((s) => s.toggleHighlights);

  return (
    <Tooltip title={highlightsVisible ? 'Hide comment highlights' : 'Show comment highlights'}>
      <Button
        type={highlightsVisible ? 'default' : 'text'}
        size="small"
        icon={
          highlightsVisible ? (
            <EyeOutlined style={{ fontSize: 14 }} />
          ) : (
            <EyeInvisibleOutlined style={{ fontSize: 14 }} />
          )
        }
        onClick={toggleHighlights}
        className={className}
        aria-label={highlightsVisible ? 'Hide comment highlights' : 'Show comment highlights'}
        aria-pressed={highlightsVisible}
      />
    </Tooltip>
  );
}

CommentModeToggle.displayName = 'CommentModeToggle';
