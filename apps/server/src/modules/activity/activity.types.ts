import type { ActivityType } from '@prisma/client';

// Re-export Prisma enum for convenience
export { ActivityType } from '@prisma/client';

// ---- Metadata shapes per activity type ----

export interface NoteCreatedMetadata {
  noteTitle: string;
  notePath: string;
}

export interface NoteEditedMetadata {
  noteTitle: string;
  notePath: string;
  /** Optional summary of what changed (e.g. word count delta). */
  changeDescription?: string;
}

export interface NoteDeletedMetadata {
  noteTitle: string;
  notePath: string;
}

export interface NoteRenamedMetadata {
  noteTitle: string;
  oldTitle: string;
  newTitle: string;
  notePath: string;
}

export interface NoteMovedMetadata {
  noteTitle: string;
  oldPath: string;
  newPath: string;
}

export interface NoteCommentedMetadata {
  noteTitle: string;
  notePath: string;
  commentId: string;
  commentPreview: string;
}

export interface NoteSharedMetadata {
  noteTitle: string;
  notePath: string;
  sharedWithUserId?: string;
  sharedWithName?: string;
  permission: string;
}

export type ActivityMetadata =
  | NoteCreatedMetadata
  | NoteEditedMetadata
  | NoteDeletedMetadata
  | NoteRenamedMetadata
  | NoteMovedMetadata
  | NoteCommentedMetadata
  | NoteSharedMetadata;

// ---- Service input types ----

export interface CreateActivityInput {
  workspaceId: string;
  userId: string;
  noteId?: string;
  type: ActivityType;
  metadata?: ActivityMetadata;
}

// ---- Response types ----

export interface ActivityUserDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ActivityLogDto {
  id: string;
  workspaceId: string;
  userId: string;
  user: ActivityUserDto;
  noteId: string | null;
  type: ActivityType;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface ActivityListResponse {
  data: ActivityLogDto[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}

export interface NoteFollowDto {
  noteId: string;
  userId: string;
  createdAt: string;
}

// ---- Job data ----

export interface ActivityCleanupJobData {
  /** Maximum age in days for activity logs before they are deleted. */
  maxAgeDays: number;
}

export interface ActivityCleanupJobResult {
  deletedCount: number;
  durationMs: number;
}
