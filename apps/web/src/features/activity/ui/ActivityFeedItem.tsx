'use client';

import { Avatar, Typography, Tag, Flex } from 'antd';
import {
  FileAddOutlined,
  EditOutlined,
  DeleteOutlined,
  SwapOutlined,
  FolderOpenOutlined,
  CommentOutlined,
  ShareAltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { formatRelativeTime } from '@/shared/lib/utils';
import type { ActivityLogDto, ActivityType } from '@/shared/api/activity';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Activity type config
// ---------------------------------------------------------------------------

interface ActivityTypeConfig {
  icon: React.ReactNode;
  color: string;
  label: string;
}

const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  NOTE_CREATED: { icon: <FileAddOutlined />, color: 'green', label: 'created' },
  NOTE_EDITED: { icon: <EditOutlined />, color: 'blue', label: 'edited' },
  NOTE_DELETED: { icon: <DeleteOutlined />, color: 'red', label: 'deleted' },
  NOTE_RENAMED: { icon: <SwapOutlined />, color: 'orange', label: 'renamed' },
  NOTE_MOVED: { icon: <FolderOpenOutlined />, color: 'purple', label: 'moved' },
  NOTE_COMMENTED: { icon: <CommentOutlined />, color: 'cyan', label: 'commented on' },
  NOTE_SHARED: { icon: <ShareAltOutlined />, color: 'geekblue', label: 'shared' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ActivityFeedItemProps {
  activity: ActivityLogDto;
  onClick?: (activity: ActivityLogDto) => void;
}

export function ActivityFeedItem({ activity, onClick }: ActivityFeedItemProps) {
  const config = ACTIVITY_TYPE_CONFIG[activity.type];
  const noteTitle = (activity.metadata?.noteTitle as string) ?? 'Untitled';

  return (
    <Flex
      gap={12}
      align="flex-start"
      style={{
        padding: '12px 16px',
        cursor: onClick ? 'pointer' : 'default',
        borderBottom: '1px solid var(--ant-color-border-secondary, #f0f0f0)',
        transition: 'background-color 0.15s',
      }}
      onClick={() => onClick?.(activity)}
      onMouseEnter={(e) => {
        if (onClick) {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            'var(--ant-color-bg-text-hover, #f5f5f5)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
      }}
    >
      <Avatar
        src={activity.user.avatarUrl}
        icon={!activity.user.avatarUrl ? <UserOutlined /> : undefined}
        size={32}
      />

      <Flex vertical flex={1} gap={2}>
        <Flex gap={4} align="center" wrap="wrap">
          <Text strong style={{ fontSize: 13 }}>
            {activity.user.displayName}
          </Text>
          <Tag icon={config.icon} color={config.color} style={{ margin: 0, fontSize: 11 }}>
            {config.label}
          </Tag>
          <Text style={{ fontSize: 13 }}>{noteTitle}</Text>
        </Flex>

        {activity.metadata?.changeDescription && (
          <Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }} ellipsis={{ rows: 1 }}>
            {activity.metadata.changeDescription as string}
          </Paragraph>
        )}

        <Text type="secondary" style={{ fontSize: 11 }}>
          {formatRelativeTime(activity.createdAt)}
        </Text>
      </Flex>
    </Flex>
  );
}
