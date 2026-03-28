/**
 * shared/api — HTTP client infrastructure and domain API modules.
 *
 * Core:
 *   - ApiError: structured error class for HTTP failures
 *   - apiClient: typed HTTP client (get, post, put, patch, delete)
 *   - axiosInstance: pre-configured axios with auth interceptors
 *   - getQueryClient / makeQueryClient: TanStack Query client factory
 *
 * Domain modules are re-exported as namespaces to avoid a flat export surface.
 * Import the specific module when you only need one domain:
 *
 *   import { workspacesApi } from '@/shared/api/workspaces';
 *
 * Or use the barrel for core utilities:
 *
 *   import { apiClient, ApiError } from '@/shared/api';
 */

// ---- Core infrastructure ----
export { ApiError } from './api-error';
export { apiClient } from './client';
export { default as axiosInstance } from './axios-instance';
export { getQueryClient, makeQueryClient } from './query-client';

// ---- Domain API modules ----
export { activityApi } from './activity';
export { analyticsApi } from './analytics';
export { domainApi } from './domain';
export { freshnessApi } from './freshness';
export { layoutsApi } from './layouts';
export { linkTypesApi, linkTypeKeys } from './link-types';
export { notificationsApi } from './notifications';
export { searchPublicVault } from './public-search';
export { readerCommentsApi } from './reader-comments';
export { sharingApi } from './sharing';
export { quickCaptureApi } from './quick-capture';
export type { QuickCapturePayload, FolderTreeNode } from './quick-capture';
export { workspacesApi } from './workspaces';
export { workspaceSettingsApi } from './workspace-settings';
export { searchReplaceApi } from './search-replace';
export { sessionsApi, sessionKeys } from './sessions';
export type { SessionDto } from './sessions';
export { preferencesApi } from './preferences';
export type { PreferenceResponse, PreferencesMap, BulkPreferenceEntry } from './preferences';
