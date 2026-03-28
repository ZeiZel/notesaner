import type { NotificationType, NotificationChannel, DigestFrequency } from '@prisma/client';

// Re-export Prisma enums for convenience
export { NotificationType, NotificationChannel, DigestFrequency } from '@prisma/client';

// ─── Notification metadata shapes per type ───────────────────────────────────

export interface CommentMentionMetadata {
  noteId: string;
  noteTitle: string;
  commentId: string;
  commentPreview: string;
  mentionedByUserId: string;
  mentionedByName: string;
  workspaceId: string;
  workspaceName: string;
}

export interface NoteSharedMetadata {
  noteId: string;
  noteTitle: string;
  sharedByUserId: string;
  sharedByName: string;
  workspaceId: string;
  workspaceName: string;
}

export interface WorkspaceInviteMetadata {
  workspaceId: string;
  workspaceName: string;
  invitedByUserId: string;
  invitedByName: string;
  role: string;
}

export interface SystemAnnouncementMetadata {
  category?: string;
  actionUrl?: string;
}

export type NotificationMetadata =
  | CommentMentionMetadata
  | NoteSharedMetadata
  | WorkspaceInviteMetadata
  | SystemAnnouncementMetadata;

// ─── Service input types ─────────────────────────────────────────────────────

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: NotificationMetadata;
}

export interface NotificationPreferenceInput {
  type: NotificationType;
  channel: NotificationChannel;
}

export interface UpdateDigestScheduleInput {
  frequency: DigestFrequency;
}

// ─── Response types ──────────────────────────────────────────────────────────

export interface NotificationListResponse {
  data: NotificationDto[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationPreferenceDto {
  type: NotificationType;
  channel: NotificationChannel;
}

export interface DigestScheduleDto {
  frequency: DigestFrequency;
  lastSentAt: string | null;
}

export interface UnreadCountDto {
  count: number;
}

// ─── Digest job data ─────────────────────────────────────────────────────────

export interface DigestJobData {
  frequency: DigestFrequency;
}

export interface DigestJobResult {
  usersProcessed: number;
  emailsSent: number;
  durationMs: number;
}
