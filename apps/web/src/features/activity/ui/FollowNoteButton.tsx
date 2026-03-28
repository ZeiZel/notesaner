'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button, Tooltip, message } from 'antd';
import { BellOutlined, BellFilled } from '@ant-design/icons';
import { activityApi } from '@/shared/api/activity';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FollowNoteButtonProps {
  noteId: string;
  /** Compact mode for note header. Defaults to false (full button). */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * FollowNoteButton toggles follow/unfollow on a note.
 * When following, the user receives notifications for activity on the note.
 */
export function FollowNoteButton({ noteId, compact = false }: FollowNoteButtonProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch initial follow status
  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const status = await activityApi.getFollowStatus(noteId);
        if (!cancelled) {
          setIsFollowing(status.following);
        }
      } catch {
        // Silently fail - non-critical
      }
    }

    void fetchStatus();

    return () => {
      cancelled = true;
    };
  }, [noteId]);

  const handleToggle = useCallback(async () => {
    setIsLoading(true);

    try {
      if (isFollowing) {
        await activityApi.unfollowNote(noteId);
        setIsFollowing(false);
        message.success('Unfollowed note');
      } else {
        await activityApi.followNote(noteId);
        setIsFollowing(true);
        message.success('Following note');
      }
    } catch {
      message.error(isFollowing ? 'Failed to unfollow' : 'Failed to follow');
    } finally {
      setIsLoading(false);
    }
  }, [noteId, isFollowing]);

  const icon = isFollowing ? <BellFilled /> : <BellOutlined />;
  const tooltipText = isFollowing ? 'Unfollow note' : 'Follow note';

  if (compact) {
    return (
      <Tooltip title={tooltipText}>
        <Button
          type="text"
          size="small"
          icon={icon}
          loading={isLoading}
          onClick={handleToggle}
          style={{
            color: isFollowing ? 'var(--ant-color-primary)' : 'var(--ant-color-text-secondary)',
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={tooltipText}>
      <Button
        type={isFollowing ? 'primary' : 'default'}
        ghost={isFollowing}
        icon={icon}
        loading={isLoading}
        onClick={handleToggle}
        size="small"
      >
        {isFollowing ? 'Following' : 'Follow'}
      </Button>
    </Tooltip>
  );
}
