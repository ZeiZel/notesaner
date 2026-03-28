/**
 * Public vault search API client.
 *
 * No authentication is required -- these endpoints are publicly accessible.
 * Uses the shared axios instance for consistent error handling and logging.
 */

import axiosInstance from './axios-instance';

export interface PublicSearchResult {
  /** Note path within the vault (e.g. "folder/note.md"). */
  path: string;
  /** Note title. */
  title: string;
  /**
   * HTML snippet with matching terms wrapped in <mark> tags.
   * Safe to render via dangerouslySetInnerHTML -- produced by ts_headline
   * which only ever highlights the title text, not arbitrary user content.
   */
  snippet: string;
  /** Relevance rank from PostgreSQL ts_rank_cd. Higher is more relevant. */
  rank: number;
  /** ISO 8601 last-updated timestamp. */
  updatedAt: string;
}

export interface PublicSearchResponse {
  data: PublicSearchResult[];
  pagination: {
    total: number;
    limit: number;
    page: number;
    hasMore: boolean;
  };
}

export interface PublicSearchParams {
  q: string;
  limit?: number;
  page?: number;
}

/**
 * Execute a full-text search against the public vault's published notes.
 *
 * @param publicSlug - The vault's public URL slug.
 * @param params - Search query and pagination options.
 * @throws ApiError when the API returns a non-OK status.
 */
export async function searchPublicVault(
  publicSlug: string,
  params: PublicSearchParams,
): Promise<PublicSearchResponse> {
  const searchParams: Record<string, string> = { q: params.q };
  if (params.limit !== undefined) searchParams['limit'] = String(params.limit);
  if (params.page !== undefined) searchParams['page'] = String(params.page);

  const response = await axiosInstance.get<PublicSearchResponse>(
    `/public/${encodeURIComponent(publicSlug)}/search`,
    { params: searchParams },
  );

  return response.data;
}
