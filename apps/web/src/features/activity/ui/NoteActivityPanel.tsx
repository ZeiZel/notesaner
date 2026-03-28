'use client';

import { useEffect, useRef } from 'react';
import { Spin, Empty, Typography, Flex, Divider } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useActivityStore } from '@/shared/stores/activity-store';
import { ActivityFeedItem } from './ActivityFeedItem';
import type { ActivityLogDto } from '@/shared/api/activity';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NoteActivityPanelProps {
  noteId: string;
  onActivityClick?: (activity: ActivityLogDto) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * NoteActivityPanel displays the activity history for a specific note.
 * Designed for use in the right sidebar properties panel.
 */
export function NoteActivityPanel({ noteId, onActivityClick }: NoteActivityPanelProps) {
  const noteItems = useActivityStore((s) => s.noteItems);
  const isNoteLoading = useActivityStore((s) => s.isNoteLoading);
  const noteHasMore = useActivityStore((s) => s.noteHasMore);
  const noteTotal = useActivityStore((s) => s.noteTotal);
  const fetchNoteActivity = useActivityStore((s) => s.fetchNoteActivity);
  const loadMoreNoteActivity = useActivityStore((s) => s.loadMoreNoteActivity);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Fetch on mount / noteId change
  useEffect(() => {
    if (noteId) {
      void fetchNoteActivity(noteId, true);
    }
  }, [noteId, fetchNoteActivity]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current || !noteId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && noteHasMore && !isNoteLoading) {
          void loadMoreNoteActivity(noteId);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [noteHasMore, isNoteLoading, loadMoreNoteActivity, noteId]);

  return (
    <Flex vertical>
      <Flex align="center" gap={6} style={{ padding: '8px 0' }}>
        <HistoryOutlined style={{ fontSize: 14 }} />
        <Text strong style={{ fontSize: 13 }}>
          Activity
        </Text>
        {noteTotal > 0 && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            ({noteTotal})
          </Text>
        )}
      </Flex>

      <Divider style={{ margin: '4px 0' }} />

      {noteItems.length === 0 && !isNoteLoading && (
        <Empty
          description="No activity for this note"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          style={{ marginTop: 16, marginBottom: 16 }}
        />
      )}

      {noteItems.map((item) => (
        <ActivityFeedItem key={item.id} activity={item} onClick={onActivityClick} />
      ))}

      <div ref={sentinelRef} style={{ height: 1 }} />

      {isNoteLoading && (
        <Flex justify="center" style={{ padding: 8 }}>
          <Spin size="small" />
        </Flex>
      )}
    </Flex>
  );
}
