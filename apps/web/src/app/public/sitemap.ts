/**
 * Sitemap generation for published public vaults and notes.
 *
 * Generates a sitemap.xml at /public/sitemap.xml that includes:
 *   - All public vault index pages
 *   - All published notes within those vaults
 *
 * Uses Next.js App Router sitemap convention.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap
 */

import type { MetadataRoute } from 'next';
import { clientEnv } from '@/shared/config/env';

const APP_URL = clientEnv.appUrl;
const _API_BASE = clientEnv.apiUrl;

interface VaultSitemapEntry {
  slug: string;
  notes: Array<{
    path: string;
    updatedAt: string;
  }>;
}

/**
 * Fetch vault sitemap data from the backend.
 *
 * In a production setup, this would call a dedicated sitemap endpoint
 * on the backend that returns all public vaults and their published notes.
 * For now, we call the existing public vault endpoints.
 */
async function fetchVaultSitemapData(): Promise<VaultSitemapEntry[]> {
  try {
    // The backend does not currently have a dedicated sitemap endpoint.
    // This is a best-effort approach using existing APIs.
    // In production, add a GET /api/sitemap/published endpoint on the
    // backend that returns all vault slugs and note paths in one call.
    //
    // For now, return an empty array. The sitemap will be populated
    // when the dedicated backend endpoint is implemented.
    //
    // Individual note pages are still discoverable via:
    //   1. Links within the vault navigation
    //   2. On-demand ISR (dynamicParams = true) generating pages
    //   3. The vault index page linking to notes
    return [];
  } catch (error) {
    console.error('[sitemap] Failed to fetch vault data:', error);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const vaults = await fetchVaultSitemapData();

  const entries: MetadataRoute.Sitemap = [];

  for (const vault of vaults) {
    // Vault index page
    entries.push({
      url: `${APP_URL}/public/${vault.slug}`,
      lastModified: new Date().toISOString(),
      changeFrequency: 'daily',
      priority: 0.8,
    });

    // Individual published notes
    for (const note of vault.notes) {
      const notePath = note.path.replace(/\.md$/, '');
      entries.push({
        url: `${APP_URL}/public/${vault.slug}/${notePath}`,
        lastModified: note.updatedAt,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  }

  return entries;
}
