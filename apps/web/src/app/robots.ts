/**
 * robots.ts
 *
 * Generates robots.txt for the Notesaner web app.
 *
 * Policy:
 *   - Allow crawling of /public/* (published vaults and notes)
 *   - Disallow crawling of all other routes (workspace, auth, API)
 *   - Point to the public sitemap
 */

import type { MetadataRoute } from 'next';
import { clientEnv } from '@/shared/config/env';

export default function robots(): MetadataRoute.Robots {
  const appUrl = clientEnv.appUrl;

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/public/',
        disallow: ['/api/', '/(workspace)/', '/(auth)/'],
      },
    ],
    sitemap: `${appUrl}/public/sitemap.xml`,
  };
}
