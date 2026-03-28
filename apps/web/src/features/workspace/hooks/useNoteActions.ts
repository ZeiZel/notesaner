/**
 * useNoteActions hook.
 *
 * Provides note-level operations: duplicate, copy-to-folder, and move-to-folder.
 *
 * Design:
 *   - All operations call the backend API and invalidate relevant TanStack Query caches.
 *   - No useEffect: all mutations are triggered via explicit event handlers.
 *   - Optimistic naming: duplicate appends " (copy)" suffix to the note title.
 *   - Folder picker integration: caller provides the target folder path.
 */

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import type { NoteDto, CreateNoteDto, UpdateNoteDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchNoteContent(
  token: string,
  workspaceId: string,
  noteId: string,
): Promise<string> {
  const result = await apiClient.get<{ content: string }>(
    `/api/workspaces/${workspaceId}/notes/${noteId}/content`,
    { token },
  );
  return result.content;
}

async function createNote(
  token: string,
  workspaceId: string,
  dto: CreateNoteDto,
): Promise<NoteDto> {
  return apiClient.post<NoteDto>(`/api/workspaces/${workspaceId}/notes`, dto, { token });
}

async function updateNote(
  token: string,
  workspaceId: string,
  noteId: string,
  dto: UpdateNoteDto,
): Promise<NoteDto> {
  return apiClient.patch<NoteDto>(`/api/workspaces/${workspaceId}/notes/${noteId}`, dto, { token });
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteActionCallbacks {
  /** Called when a note operation succeeds. Receives the resulting note. */
  onSuccess?: (note: NoteDto) => void;
  /** Called when a note operation fails. */
  onError?: (error: unknown) => void;
}

export interface UseNoteActionsResult {
  /** Duplicate a note in the same folder with " (copy)" suffix. */
  duplicateNote: (note: NoteDto) => void;
  /** Copy a note to a different folder (original is preserved). */
  copyToFolder: (note: NoteDto, targetFolderPath: string) => void;
  /** Move a note to a different folder (original path is updated). */
  moveToFolder: (note: NoteDto, targetFolderPath: string) => void;
  /** Whether any note action is currently in progress. */
  isPending: boolean;
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

function getFolderPath(notePath: string): string {
  const lastSlash = notePath.lastIndexOf('/');
  return lastSlash === -1 ? '' : notePath.slice(0, lastSlash);
}

function getFileName(notePath: string): string {
  const lastSlash = notePath.lastIndexOf('/');
  return lastSlash === -1 ? notePath : notePath.slice(lastSlash + 1);
}

function getFileNameWithoutExt(fileName: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx === -1 ? fileName : fileName.slice(0, dotIdx);
}

function getFileExt(fileName: string): string {
  const dotIdx = fileName.lastIndexOf('.');
  return dotIdx === -1 ? '' : fileName.slice(dotIdx);
}

function buildCopyPath(originalPath: string): string {
  const folder = getFolderPath(originalPath);
  const fileName = getFileName(originalPath);
  const nameWithoutExt = getFileNameWithoutExt(fileName);
  const ext = getFileExt(fileName);
  const copyName = `${nameWithoutExt} (copy)${ext}`;
  return folder ? `${folder}/${copyName}` : copyName;
}

function buildTargetPath(originalPath: string, targetFolderPath: string): string {
  const fileName = getFileName(originalPath);
  const normalizedFolder = targetFolderPath.replace(/\/+$/, '');
  return normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNoteActions(
  workspaceId: string,
  callbacks?: NoteActionCallbacks,
): UseNoteActionsResult {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const invalidateNotes = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['notes', workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ['file-tree', workspaceId] });
  }, [queryClient, workspaceId]);

  // -- Duplicate mutation --

  const duplicateMutation = useMutation({
    mutationFn: async (note: NoteDto) => {
      if (!accessToken) throw new Error('Not authenticated');

      // 1. Fetch original content
      const content = await fetchNoteContent(accessToken, workspaceId, note.id);

      // 2. Build copy path and title
      const copyPath = buildCopyPath(note.path);
      const copyTitle = `${note.title} (copy)`;

      // 3. Create the duplicate
      const tags = Array.isArray(note.frontmatter?.tags)
        ? (note.frontmatter.tags as unknown[]).map(String)
        : [];

      return createNote(accessToken, workspaceId, {
        path: copyPath,
        title: copyTitle,
        content,
        tags,
      });
    },
    onSuccess: (newNote) => {
      invalidateNotes();
      callbacks?.onSuccess?.(newNote);
    },
    onError: (error) => {
      callbacks?.onError?.(error);
    },
  });

  // -- Copy-to-folder mutation --

  const copyToFolderMutation = useMutation({
    mutationFn: async ({ note, targetFolderPath }: { note: NoteDto; targetFolderPath: string }) => {
      if (!accessToken) throw new Error('Not authenticated');

      const content = await fetchNoteContent(accessToken, workspaceId, note.id);
      const targetPath = buildTargetPath(note.path, targetFolderPath);

      const tags = Array.isArray(note.frontmatter?.tags)
        ? (note.frontmatter.tags as unknown[]).map(String)
        : [];

      return createNote(accessToken, workspaceId, {
        path: targetPath,
        title: note.title,
        content,
        tags,
      });
    },
    onSuccess: (newNote) => {
      invalidateNotes();
      callbacks?.onSuccess?.(newNote);
    },
    onError: (error) => {
      callbacks?.onError?.(error);
    },
  });

  // -- Move-to-folder mutation --

  const moveToFolderMutation = useMutation({
    mutationFn: async ({ note, targetFolderPath }: { note: NoteDto; targetFolderPath: string }) => {
      if (!accessToken) throw new Error('Not authenticated');

      const targetPath = buildTargetPath(note.path, targetFolderPath);

      return updateNote(accessToken, workspaceId, note.id, {
        path: targetPath,
      });
    },
    onSuccess: (updatedNote) => {
      invalidateNotes();
      callbacks?.onSuccess?.(updatedNote);
    },
    onError: (error) => {
      callbacks?.onError?.(error);
    },
  });

  // -- Public API --

  const duplicateNote = useCallback(
    (note: NoteDto) => {
      duplicateMutation.mutate(note);
    },
    [duplicateMutation],
  );

  const copyToFolder = useCallback(
    (note: NoteDto, targetFolderPath: string) => {
      copyToFolderMutation.mutate({ note, targetFolderPath });
    },
    [copyToFolderMutation],
  );

  const moveToFolder = useCallback(
    (note: NoteDto, targetFolderPath: string) => {
      moveToFolderMutation.mutate({ note, targetFolderPath });
    },
    [moveToFolderMutation],
  );

  const isPending =
    duplicateMutation.isPending || copyToFolderMutation.isPending || moveToFolderMutation.isPending;

  return {
    duplicateNote,
    copyToFolder,
    moveToFolder,
    isPending,
  };
}
