/**
 * On-demand ISR revalidation endpoint.
 *
 * Called by the backend (NestJS publish module) when a note is
 * published, unpublished, or updated. Invalidates the Next.js cache
 * for the affected pages using revalidateTag.
 *
 * POST /api/revalidate
 * Body: { slug: string; notePath?: string; secret: string }
 *
 * Security: Requires a shared secret token (REVALIDATION_SECRET env var)
 * to prevent unauthorized cache invalidation.
 */

import { revalidateTag } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';

interface RevalidateBody {
  /** The public vault slug. */
  slug: string;
  /** Optional note path. When omitted, the entire vault is revalidated. */
  notePath?: string;
  /** Shared secret for authentication. */
  secret: string;
}

export async function POST(request: NextRequest) {
  let body: RevalidateBody;

  try {
    body = (await request.json()) as RevalidateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { slug, notePath, secret } = body;

  // Validate shared secret
  const expectedSecret = process.env.REVALIDATION_SECRET;
  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Invalid secret' }, { status: 401 });
  }

  if (!slug || typeof slug !== 'string') {
    return NextResponse.json({ error: 'Missing required field: slug' }, { status: 400 });
  }

  const revalidatedTags: string[] = [];

  try {
    // Always revalidate the vault-level tag (index, note list, sitemap)
    const vaultCacheTag = `published-vault:${slug}`;
    revalidateTag(vaultCacheTag);
    revalidatedTags.push(vaultCacheTag);

    // If a specific note path is provided, also revalidate that note
    if (notePath && typeof notePath === 'string') {
      const noteCacheTag = `published-note:${slug}:${notePath}`;
      revalidateTag(noteCacheTag);
      revalidatedTags.push(noteCacheTag);
    }

    return NextResponse.json({
      revalidated: true,
      tags: revalidatedTags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[revalidate] Error revalidating tags:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}
