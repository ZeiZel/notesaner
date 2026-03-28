/**
 * Public vault search API client.
 *
 * No authentication is required — these endpoints are publicly accessible.
 * The base URL is taken from NEXT_PUBLIC_API_URL (defaults to localhost:3001).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface PublicSearchResult {
  /** Note path within the vault (e.g. "folder/note.md"). */
  path: string;
  /** Note title. */
  title: string;
  /**
   * HTML snippet with matching terms wrapped in <mark> tags.
   * Safe to render via dangerouslySetInnerHTML — produced by ts_headline
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
 * @throws Error when the API returns a non-OK status.
 */
export async function searchPublicVault(
  publicSlug: string,
  params: PublicSearchParams,
): Promise<PublicSearchResponse> {
  const qs = new URLSearchParams({ q: params.q });
  if (params.limit !== undefined) qs.set('limit', String(params.limit));
  if (params.page !== undefined) qs.set('page', String(params.page));

  const response = await fetch(
    `${API_BASE_URL}/public/${encodeURIComponent(publicSlug)}/search?${qs.toString()}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      // Use Next.js cache with a short revalidation window matching server TTL.
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // Non-JSON error body
    }
    throw new Error(message);
  }

  return response.json() as Promise<PublicSearchResponse>;
}
