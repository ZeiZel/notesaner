/**
 * Notification helper utilities.
 *
 * Provides icon resolution, navigation URL generation, and display label
 * mapping for each notification type. Pure functions -- no side effects.
 */

import type { NotificationType } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Notification type display labels
// ---------------------------------------------------------------------------

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  COMMENT_MENTION: 'Mentions',
  NOTE_SHARED: 'Shared notes',
  WORKSPACE_INVITE: 'Workspace invites',
  SYSTEM_ANNOUNCEMENT: 'System announcements',
};

export const NOTIFICATION_TYPE_DESCRIPTIONS: Record<NotificationType, string> = {
  COMMENT_MENTION: 'When someone mentions you in a comment',
  NOTE_SHARED: 'When a note is shared with you',
  WORKSPACE_INVITE: 'When you are invited to a workspace',
  SYSTEM_ANNOUNCEMENT: 'Product updates and system maintenance notices',
};

// ---------------------------------------------------------------------------
// All notification types (ordered for display)
// ---------------------------------------------------------------------------

export const ALL_NOTIFICATION_TYPES: NotificationType[] = [
  'COMMENT_MENTION',
  'NOTE_SHARED',
  'WORKSPACE_INVITE',
  'SYSTEM_ANNOUNCEMENT',
];

// ---------------------------------------------------------------------------
// Navigation URL from notification metadata
// ---------------------------------------------------------------------------

/**
 * Derives a client-side navigation path from notification metadata.
 * Returns `null` if the notification type has no navigable target.
 */
export function getNotificationUrl(
  type: NotificationType,
  metadata: Record<string, unknown>,
): string | null {
  switch (type) {
    case 'COMMENT_MENTION': {
      const noteId = metadata.noteId as string | undefined;
      const commentId = metadata.commentId as string | undefined;
      if (!noteId) return null;
      return commentId ? `/notes/${noteId}#comment-${commentId}` : `/notes/${noteId}`;
    }

    case 'NOTE_SHARED': {
      const noteId = metadata.noteId as string | undefined;
      return noteId ? `/notes/${noteId}` : null;
    }

    case 'WORKSPACE_INVITE': {
      const workspaceId = metadata.workspaceId as string | undefined;
      return workspaceId ? `/workspaces/${workspaceId}` : null;
    }

    case 'SYSTEM_ANNOUNCEMENT': {
      const actionUrl = metadata.actionUrl as string | undefined;
      return actionUrl ?? null;
    }

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Ant Design icon name mapping (for dynamic icon rendering)
// ---------------------------------------------------------------------------

export type NotificationIconName =
  | 'MessageOutlined'
  | 'ShareAltOutlined'
  | 'TeamOutlined'
  | 'NotificationOutlined';

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, NotificationIconName> = {
  COMMENT_MENTION: 'MessageOutlined',
  NOTE_SHARED: 'ShareAltOutlined',
  WORKSPACE_INVITE: 'TeamOutlined',
  SYSTEM_ANNOUNCEMENT: 'NotificationOutlined',
};
