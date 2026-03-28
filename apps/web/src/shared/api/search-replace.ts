/**
 * search-replace.ts
 *
 * API client for workspace-level search & replace endpoints.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SearchReplaceMode = 'plain' | 'regex';

export interface SearchReplaceFilters {
  folder?: string;
  tagIds?: string[];
  fileExtension?: string;
  updatedAfter?: string;
  updatedBefore?: string;
}

export interface SearchReplacePreviewPayload {
  query: string;
  replacement: string;
  mode?: SearchReplaceMode;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  filters?: SearchReplaceFilters;
  maxMatches?: number;
}

export interface SearchReplaceMatchDto {
  noteId: string;
  noteTitle: string;
  notePath: string;
  matchText: string;
  contextBefore: string;
  contextAfter: string;
  lineNumber: number;
  columnOffset: number;
  replacementPreview: string;
}

export interface SearchReplacePreviewResponse {
  matches: SearchReplaceMatchDto[];
  totalMatches: number;
  notesAffected: number;
  truncated: boolean;
}

export interface MatchReference {
  noteId: string;
  lineNumber: number;
  columnOffset: number;
  matchText: string;
}

export interface SearchReplaceExecutePayload {
  query: string;
  replacement: string;
  mode?: SearchReplaceMode;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  filters?: SearchReplaceFilters;
  matches?: MatchReference[];
  excludeNoteIds?: string[];
}

export interface SearchReplaceExecuteResponse {
  replacedCount: number;
  modifiedNotes: string[];
  jobId?: string;
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const searchReplaceApi = {
  /**
   * POST /api/workspaces/:workspaceId/search/replace/preview
   *
   * Preview matches without modifying files.
   */
  preview: (workspaceId: string, payload: SearchReplacePreviewPayload) =>
    apiClient.post<SearchReplacePreviewResponse>(
      `/api/workspaces/${workspaceId}/search/replace/preview`,
      payload,
    ),

  /**
   * POST /api/workspaces/:workspaceId/search/replace
   *
   * Execute search & replace across notes.
   */
  execute: (workspaceId: string, payload: SearchReplaceExecutePayload) =>
    apiClient.post<SearchReplaceExecuteResponse>(
      `/api/workspaces/${workspaceId}/search/replace`,
      payload,
    ),
};
