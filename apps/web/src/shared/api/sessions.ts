/**
 * sessions.ts
 *
 * API client for user session management endpoints.
 *
 * Wraps the auth sessions API (GET/DELETE /auth/sessions).
 * Used by SessionsSettings to list and revoke active login sessions.
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SessionDto {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Query keys — for TanStack Query cache management
// ---------------------------------------------------------------------------

export const sessionKeys = {
  all: ['sessions'] as const,
  list: () => [...sessionKeys.all, 'list'] as const,
};

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

export const sessionsApi = {
  /**
   * GET /api/auth/sessions
   * Returns all active sessions for the authenticated user.
   */
  getSessions: (): Promise<SessionDto[]> => apiClient.get<SessionDto[]>('/api/auth/sessions'),

  /**
   * DELETE /api/auth/sessions/:sessionId
   * Revokes a specific session.
   */
  revokeSession: (sessionId: string): Promise<void> =>
    apiClient.delete<void>(`/api/auth/sessions/${encodeURIComponent(sessionId)}`),

  /**
   * DELETE /api/auth/sessions
   * Revokes all sessions except the current one.
   */
  revokeAllOtherSessions: (): Promise<void> => apiClient.delete<void>('/api/auth/sessions'),
};
