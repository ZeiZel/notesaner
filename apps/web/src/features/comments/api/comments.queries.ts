/**
 * comments.queries.ts
 *
 * TanStack Query hooks for comment operations.
 *
 * Uses query-key factory pattern consistent with the rest of the codebase.
 * Mutations invalidate the comment list query on success.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import {
  commentsApi,
  type CommentDto,
  type CreateCommentPayload,
  type CreateReplyPayload,
  type UpdateCommentPayload,
} from './comments';

// ---------------------------------------------------------------------------
// Query key factory
// ---------------------------------------------------------------------------

export const commentKeys = {
  all: ['comments'] as const,
  lists: () => [...commentKeys.all, 'list'] as const,
  list: (noteId: string) => [...commentKeys.lists(), noteId] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetches all comment threads for a note.
 * Returns root comments with nested replies, sorted by document position.
 */
export function useNoteComments(noteId: string | null) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  return useQuery<CommentDto[]>({
    queryKey: commentKeys.list(noteId ?? ''),
    queryFn: () => {
      if (!token || !workspaceId || !noteId) {
        return Promise.reject(new Error('Missing auth or workspace context'));
      }
      return commentsApi.list(token, workspaceId, noteId);
    },
    enabled: Boolean(token && workspaceId && noteId),
    staleTime: 30_000,
  });
}

/**
 * Creates a new root comment anchored to a text position.
 * Invalidates the comment list on success.
 */
export function useCreateComment(noteId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const queryClient = useQueryClient();

  return useMutation<CommentDto, Error, CreateCommentPayload>({
    mutationFn: (payload) => {
      if (!token || !workspaceId) {
        return Promise.reject(new Error('Missing auth or workspace context'));
      }
      return commentsApi.create(token, workspaceId, noteId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(noteId) });
    },
  });
}

/**
 * Replies to an existing root comment.
 * Invalidates the comment list on success.
 */
export function useReplyToComment(noteId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation<CommentDto, Error, { commentId: string; payload: CreateReplyPayload }>({
    mutationFn: ({ commentId, payload }) => {
      if (!token) {
        return Promise.reject(new Error('Missing auth context'));
      }
      return commentsApi.reply(token, commentId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(noteId) });
    },
  });
}

/**
 * Edits an existing comment's content.
 * Invalidates the comment list on success.
 */
export function useUpdateComment(noteId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation<CommentDto, Error, { commentId: string; payload: UpdateCommentPayload }>({
    mutationFn: ({ commentId, payload }) => {
      if (!token) {
        return Promise.reject(new Error('Missing auth context'));
      }
      return commentsApi.update(token, commentId, payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(noteId) });
    },
  });
}

/**
 * Deletes a comment.
 * Invalidates the comment list on success.
 */
export function useDeleteComment(noteId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: (commentId) => {
      if (!token) {
        return Promise.reject(new Error('Missing auth context'));
      }
      return commentsApi.delete(token, commentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(noteId) });
    },
  });
}

/**
 * Toggles the resolved state of a root comment thread.
 * Invalidates the comment list on success.
 */
export function useResolveComment(noteId: string) {
  const token = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  return useMutation<CommentDto, Error, string>({
    mutationFn: (commentId) => {
      if (!token) {
        return Promise.reject(new Error('Missing auth context'));
      }
      return commentsApi.resolve(token, commentId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: commentKeys.list(noteId) });
    },
  });
}
