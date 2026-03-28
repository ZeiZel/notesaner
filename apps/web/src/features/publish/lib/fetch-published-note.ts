/**
 * fetch-published-note.ts
 *
 * Server-side data fetching utilities for published notes and vaults.
 *
 * Uses React `cache()` to deduplicate requests within a single render
 * pass (e.g. when both `generateMetadata` and the page component call
 * the same function).
 *
 * Uses Next.js `fetch` with `next.tags` for on-demand ISR revalidation
 * via `revalidateTag`.
 *
 * This module runs exclusively on the server.
 */

import { cache } from 'react';
import { clientEnv } from '@/shared/config/env';
import { notFound } from 'next/navigation';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Mirrors the backend `PublishedNoteResponse` from `public-vault.service.ts`.
 */
export interface PublishedNoteData {
  id: string;
  path: string;
  title: string;
  html: string;
  updatedAt: string;
  frontmatter: Record<string, unknown>;
}

/**
 * Mirrors the backend `VaultIndexResponse` from `public-vault.service.ts`.
 */
export interface VaultIndexData {
  slug: string;
  name: string;
  description: string | null;
  publishedNoteCount: number;
}

/**
 * Mirrors the backend `PublishedNoteItem` from `public-vault.service.ts`.
 */
export interface PublishedNoteItem {
  id: string;
  path: string;
  title: string;
  updatedAt: string;
}

export interface PaginatedPublishedNotes {
  items: PublishedNoteItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

// ---------------------------------------------------------------------------
// Cache tags
// ---------------------------------------------------------------------------

/**
 * Generate the cache tag used for on-demand ISR revalidation.
 *
 * Tag format:
 *   - `published-note:{slug}:{notePath}` for individual notes
 *   - `published-vault:{slug}` for vault-level data (index, note list)
 */
export function noteTag(slug: string, notePath: string): string {
  return `published-note:${slug}:${notePath}`;
}

export function vaultTag(slug: string): string {
  return `published-vault:${slug}`;
}

// ---------------------------------------------------------------------------
// Internal fetch helper
// ---------------------------------------------------------------------------

const API_BASE = clientEnv.apiUrl;

async function apiFetch<T>(
  path: string,
  tags: string[],
  revalidateSeconds = 300,
): Promise<T | null> {
  const url = `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      next: {
        tags,
        revalidate: revalidateSeconds,
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${url}`);
    }

    return (await response.json()) as T;
  } catch (error) {
    // In development, the backend may not be running.
    // Log and return null to let the page show a not-found state.
    console.error(`[fetch-published-note] Failed to fetch ${url}:`, error);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API (memoized with React.cache)
// ---------------------------------------------------------------------------

/**
 * Fetch a single published note by vault slug and note path.
 *
 * Memoized within a single React render pass so that both
 * `generateMetadata` and the page component share one request.
 *
 * Returns `null` when the note or vault is not found (caller should
 * invoke `notFound()`).
 */
export const getPublishedNote = cache(
  async (slug: string, notePath: string): Promise<PublishedNoteData | null> => {
    const tags = [noteTag(slug, notePath), vaultTag(slug)];
    return apiFetch<PublishedNoteData>(`/p/${slug}/${notePath}`, tags);
  },
);

/**
 * Fetch the public vault index metadata.
 *
 * Memoized within a single React render pass.
 */
export const getVaultIndex = cache(async (slug: string): Promise<VaultIndexData | null> => {
  const tags = [vaultTag(slug)];
  return apiFetch<VaultIndexData>(`/p/${slug}`, tags);
});

/**
 * Fetch the list of published notes for generating static params.
 *
 * This is NOT memoized with React.cache because it is only called
 * from `generateStaticParams`, which runs at build time outside of
 * a render pass.
 */
export async function getAllPublishedNotes(slug: string): Promise<PublishedNoteItem[]> {
  const allItems: PublishedNoteItem[] = [];
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const queryParams = new URLSearchParams({ limit: '100' });
    if (cursor) queryParams.set('cursor', cursor);

    const page = await apiFetch<PaginatedPublishedNotes>(
      `/p/${slug}/notes?${queryParams.toString()}`,
      [vaultTag(slug)],
      600,
    );

    if (!page) break;

    allItems.push(...page.items);
    cursor = page.nextCursor;
    hasMore = page.hasMore;
  }

  return allItems;
}

/**
 * Fetch a published note or call `notFound()` if it doesn't exist.
 *
 * Convenience wrapper for use in page components.
 */
export const getPublishedNoteOrNotFound = cache(
  async (slug: string, notePath: string): Promise<PublishedNoteData> => {
    const note = await getPublishedNote(slug, notePath);
    if (!note) notFound();
    return note;
  },
);
