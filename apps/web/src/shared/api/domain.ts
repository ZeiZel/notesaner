import { apiClient } from './client';
import type { DomainStatusDto } from '@/features/publish/domain-store';

/**
 * domainApi — client for the custom domain endpoints on the Notesaner backend.
 *
 * All calls require a valid JWT access token.
 */
export const domainApi = {
  /**
   * GET /api/workspaces/:workspaceId/domain
   * Returns the current custom domain configuration and verification status.
   */
  getConfig: (token: string, workspaceId: string) =>
    apiClient.get<DomainStatusDto>(`/api/workspaces/${workspaceId}/domain`, { token }),

  /**
   * POST /api/workspaces/:workspaceId/domain
   * Set (or replace) the custom domain for the workspace's public vault.
   * Returns a new DomainStatusDto with a fresh verification token.
   */
  setDomain: (token: string, workspaceId: string, domain: string) =>
    apiClient.post<DomainStatusDto>(`/api/workspaces/${workspaceId}/domain`, { domain }, { token }),

  /**
   * POST /api/workspaces/:workspaceId/domain/verify
   * Trigger a DNS TXT-record verification attempt.
   * Returns updated DomainStatusDto with status "verified" or "failed".
   */
  verify: (token: string, workspaceId: string) =>
    apiClient.post<DomainStatusDto>(`/api/workspaces/${workspaceId}/domain/verify`, {}, { token }),

  /**
   * DELETE /api/workspaces/:workspaceId/domain
   * Remove the custom domain from the workspace.
   * Returns void (204 No Content).
   */
  removeDomain: (token: string, workspaceId: string) =>
    apiClient.delete<void>(`/api/workspaces/${workspaceId}/domain`, { token }),
};
