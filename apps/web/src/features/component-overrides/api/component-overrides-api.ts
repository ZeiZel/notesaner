/**
 * API client for the component-overrides feature.
 *
 * Endpoints:
 *   GET    /api/workspaces/:id/component-overrides/registry
 *   GET    /api/workspaces/:id/component-overrides
 *   GET    /api/workspaces/:id/component-overrides/:componentId
 *   POST   /api/workspaces/:id/component-overrides
 *   PATCH  /api/workspaces/:id/component-overrides/:componentId
 *   POST   /api/workspaces/:id/component-overrides/:componentId/compile
 *   POST   /api/workspaces/:id/component-overrides/:componentId/revert
 *   GET    /api/workspaces/:id/component-overrides/:componentId/audit
 *   POST   /api/workspaces/:id/component-overrides/:componentId/delete
 */

import { apiClient } from '@/shared/api/client';
import type {
  ComponentOverride,
  OverrideAuditEntry,
  OverridableComponentMeta,
} from '@notesaner/component-sdk';

const base = (workspaceId: string) => `/api/workspaces/${workspaceId}/component-overrides`;

export const componentOverridesApi = {
  getRegistry: (token: string, workspaceId: string): Promise<OverridableComponentMeta[]> =>
    apiClient.get(`${base(workspaceId)}/registry`, { token }),

  list: (token: string, workspaceId: string): Promise<ComponentOverride[]> =>
    apiClient.get(base(workspaceId), { token }),

  getOne: (token: string, workspaceId: string, componentId: string): Promise<ComponentOverride> =>
    apiClient.get(`${base(workspaceId)}/${encodeURIComponent(componentId)}`, { token }),

  create: (
    token: string,
    workspaceId: string,
    payload: { componentId: string; sourceCode: string },
  ): Promise<ComponentOverride> => apiClient.post(base(workspaceId), payload, { token }),

  update: (
    token: string,
    workspaceId: string,
    componentId: string,
    payload: { sourceCode: string },
  ): Promise<ComponentOverride> =>
    apiClient.patch(`${base(workspaceId)}/${encodeURIComponent(componentId)}`, payload, { token }),

  compile: (token: string, workspaceId: string, componentId: string): Promise<ComponentOverride> =>
    apiClient.post(
      `${base(workspaceId)}/${encodeURIComponent(componentId)}/compile`,
      {},
      { token },
    ),

  revert: (token: string, workspaceId: string, componentId: string): Promise<ComponentOverride> =>
    apiClient.post(`${base(workspaceId)}/${encodeURIComponent(componentId)}/revert`, {}, { token }),

  getAuditLog: (
    token: string,
    workspaceId: string,
    componentId: string,
  ): Promise<OverrideAuditEntry[]> =>
    apiClient.get(`${base(workspaceId)}/${encodeURIComponent(componentId)}/audit`, { token }),

  delete: (token: string, workspaceId: string, componentId: string): Promise<void> =>
    apiClient.post(`${base(workspaceId)}/${encodeURIComponent(componentId)}/delete`, {}, { token }),
};
