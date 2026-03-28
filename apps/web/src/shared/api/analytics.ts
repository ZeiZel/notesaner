/**
 * Analytics API client
 *
 * Typed wrappers around the analytics endpoints:
 * - GET /workspaces/:id/analytics      — full summary
 * - GET /workspaces/:id/analytics/daily — daily chart data
 * - GET /workspaces/:id/analytics/top-notes — top notes ranking
 */

import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DateRange = '7d' | '30d' | '90d' | 'all';

export interface DailyStatPoint {
  /** ISO date string YYYY-MM-DD. */
  date: string;
  views: number;
  uniqueVisitors: number;
}

export interface TopNoteItem {
  noteId: string;
  title: string;
  path: string;
  totalViews: number;
  uniqueVisitors: number;
}

export interface ReferrerItem {
  referrer: string;
  count: number;
}

export interface AnalyticsSummary {
  totalViews: number;
  uniqueVisitors: number;
  topReferrers: ReferrerItem[];
  dailyStats: DailyStatPoint[];
  topNotes: TopNoteItem[];
}

export interface AnalyticsQueryParams {
  dateRange?: DateRange;
  noteId?: string;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const analyticsApi = {
  /**
   * GET /workspaces/:workspaceId/analytics
   *
   * Returns the full analytics summary for the workspace.
   */
  getSummary: (
    token: string,
    workspaceId: string,
    params: AnalyticsQueryParams = {},
  ): Promise<AnalyticsSummary> => {
    const qs = buildQueryString(params);
    return apiClient.get<AnalyticsSummary>(`/api/workspaces/${workspaceId}/analytics${qs}`, {
      token,
    });
  },

  /**
   * GET /workspaces/:workspaceId/analytics/daily
   *
   * Returns daily stat data points for chart rendering.
   */
  getDailyStats: (
    token: string,
    workspaceId: string,
    params: AnalyticsQueryParams = {},
  ): Promise<DailyStatPoint[]> => {
    const qs = buildQueryString(params);
    return apiClient.get<DailyStatPoint[]>(`/api/workspaces/${workspaceId}/analytics/daily${qs}`, {
      token,
    });
  },

  /**
   * GET /workspaces/:workspaceId/analytics/top-notes
   *
   * Returns the top notes by page views in the given date range.
   */
  getTopNotes: (
    token: string,
    workspaceId: string,
    params: AnalyticsQueryParams = {},
  ): Promise<TopNoteItem[]> => {
    const qs = buildQueryString(params);
    return apiClient.get<TopNoteItem[]>(`/api/workspaces/${workspaceId}/analytics/top-notes${qs}`, {
      token,
    });
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildQueryString(params: AnalyticsQueryParams): string {
  const entries: [string, string][] = [];

  if (params.dateRange) entries.push(['dateRange', params.dateRange]);
  if (params.noteId) entries.push(['noteId', params.noteId]);

  if (entries.length === 0) return '';

  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
}
