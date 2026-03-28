/**
 * notes.ts
 *
 * API client for note CRUD operations.
 */

import { apiClient } from './client';
import type { NoteDto, UpdateNoteDto, CreateNoteDto } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const notesApi = {
  /**
   * GET /api/workspaces/:workspaceId/notes/:noteId
   */
  async get(token: string, workspaceId: string, noteId: string): Promise<NoteDto> {
    return apiClient.get<NoteDto>(`/api/workspaces/${workspaceId}/notes/${noteId}`, { token });
  },

  /**
   * POST /api/workspaces/:workspaceId/notes
   */
  async create(token: string, workspaceId: string, dto: CreateNoteDto): Promise<NoteDto> {
    return apiClient.post<NoteDto>(`/api/workspaces/${workspaceId}/notes`, dto, { token });
  },

  /**
   * PATCH /api/workspaces/:workspaceId/notes/:noteId
   */
  async update(
    token: string,
    workspaceId: string,
    noteId: string,
    dto: UpdateNoteDto,
  ): Promise<NoteDto> {
    return apiClient.patch<NoteDto>(`/api/workspaces/${workspaceId}/notes/${noteId}`, dto, {
      token,
    });
  },

  /**
   * DELETE /api/workspaces/:workspaceId/notes/:noteId
   */
  async delete(token: string, workspaceId: string, noteId: string): Promise<void> {
    await apiClient.delete(`/api/workspaces/${workspaceId}/notes/${noteId}`, { token });
  },
};
