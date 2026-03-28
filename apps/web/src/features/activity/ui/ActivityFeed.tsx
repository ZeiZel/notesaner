'use client';

import { useEffect, useCallback, useRef } from 'react';
import { Spin, Empty, Typography, Flex, Divider } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';
import { useActivityStore } from '@/shared/stores/activity-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { ActivityFeedItem } from './ActivityFeedItem';
import { ActivityFilters } from './ActivityFilters';
import type { ActivityLogDto } from '@/shared/api/activity';

const { Title } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  onActivityClick?: (activity: ActivityLogDto) => void;
  members?: Array<{ value: string; label: string }>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFeed({ onActivityClick, members }: ActivityFeedProps) {
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const items = useActivityStore((s) => s.items);
  const isLoading = useActivityStore((s) => s.isLoading);
  const hasMore = useActivityStore((s) => s.hasMore);
  const total = useActivityStore((s) => s.total);
  const fetchWorkspaceActivity = useActivityStore((s) => s.fetchWorkspaceActivity);
  const loadMore = useActivityStore((s) => s.loadMore);

  const sentinelRef = useRef<HTMLDivElement>(null);

  // Initial fetch
  useEffect(() => {
    if (workspaceId) {
      void fetchWorkspaceActivity(workspaceId, true);
    }
  }, [workspaceId, fetchWorkspaceActivity]);

  // Infinite scroll via IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current || !workspaceId) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasMore && !isLoading) {
          void loadMore(workspaceId);
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinelRef.current);

    return () => observer.disconnect();
  }, [hasMore, isLoading, loadMore, workspaceId]);

  const handleFiltersChanged = useCallback(() => {
    if (workspaceId) {
      void fetchWorkspaceActivity(workspaceId, true);
    }
  }, [workspaceId, fetchWorkspaceActivity]);

  return (
    <Flex vertical style={{ height: '100%' }}>
      {/* Header */}
      <Flex align="center" gap={8} style={{ padding: '16px 16px 8px' }}>
        <HistoryOutlined style={{ fontSize: 18 }} />
        <Title level={5} style={{ margin: 0 }}>
          Activity
        </Title>
        {total > 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            ({total})
          </Typography.Text>
        )}
      </Flex>

      <Divider style={{ margin: '0 0 4px' }} />

      {/* Filters */}
      <ActivityFilters members={members} onFiltersChanged={handleFiltersChanged} />

      <Divider style={{ margin: '4px 0' }} />

      {/* Feed */}
      <Flex vertical style={{ flex: 1, overflowY: 'auto' }}>
        {items.length === 0 && !isLoading && (
          <Empty
            description="No activity yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 48 }}
          />
        )}

        {items.map((item) => (
          <ActivityFeedItem key={item.id} activity={item} onClick={onActivityClick} />
        ))}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {isLoading && (
          <Flex justify="center" style={{ padding: 16 }}>
            <Spin size="small" />
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}
