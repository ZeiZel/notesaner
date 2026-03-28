/**
 * generate-metadata.ts
 *
 * Generates Next.js Metadata objects for published notes with full
 * SEO optimization:
 *   - OpenGraph tags (og:title, og:description, og:image, og:type)
 *   - Twitter Card (summary_large_image)
 *   - Canonical URLs
 *   - Article metadata (published_time, modified_time)
 *
 * This module runs exclusively on the server and is used by
 * `generateMetadata` in the public note page route.
 */

import type { Metadata } from 'next';
import { clientEnv } from '@/shared/config/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteMetadataInput {
  /** The vault's public slug. */
  slug: string;
  /** The note's path within the vault. */
  notePath: string;
  /** The note title. */
  title: string;
  /** The rendered HTML (used to extract a text excerpt). */
  html: string;
  /** ISO 8601 date of last update. */
  updatedAt: string;
  /** The note's frontmatter (may contain description, image, tags). */
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const APP_URL = clientEnv.appUrl;

/**
 * Extract a plain-text excerpt from HTML content.
 * Strips tags, collapses whitespace, and truncates at ~160 chars on
 * a word boundary.
 */
function extractDescription(html: string, maxLength = 160): string {
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;

  const truncated = plainText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

/**
 * Build the canonical URL for a published note.
 */
function canonicalUrl(slug: string, notePath: string): string {
  return `${APP_URL}/public/${slug}/${notePath}`;
}

/**
 * Build the OG image URL. Uses the dynamic OG image generation endpoint
 * when no custom image is provided in frontmatter.
 */
function ogImageUrl(slug: string, notePath: string, title: string, customImage?: string): string {
  if (customImage && typeof customImage === 'string') {
    // Absolute URL provided in frontmatter
    if (customImage.startsWith('http://') || customImage.startsWith('https://')) {
      return customImage;
    }
  }

  // Use the auto-generated OG image endpoint
  const params = new URLSearchParams({
    title,
    slug,
    path: notePath,
  });
  return `${APP_URL}/api/og?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a complete Next.js Metadata object for a published note page.
 *
 * Prioritizes frontmatter overrides (description, image, tags) and falls
 * back to auto-extracted values from the HTML content.
 */
export function generateNoteMetadata(input: NoteMetadataInput): Metadata {
  const { slug, notePath, title, html, updatedAt, frontmatter } = input;

  // Description: prefer frontmatter, fall back to auto-excerpt
  const description =
    typeof frontmatter.description === 'string' && frontmatter.description.length > 0
      ? frontmatter.description
      : extractDescription(html);

  // Image: prefer frontmatter image, fall back to auto-generated OG
  const customImage = frontmatter.image as string | undefined;
  const imageUrl = ogImageUrl(slug, notePath, title, customImage);

  // Tags / keywords
  const keywords: string[] = [];
  if (Array.isArray(frontmatter.tags)) {
    keywords.push(...frontmatter.tags.filter((t): t is string => typeof t === 'string'));
  }

  const url = canonicalUrl(slug, notePath);

  return {
    title,
    description,
    keywords: keywords.length > 0 ? keywords : undefined,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'article',
      title,
      description,
      url,
      siteName: 'Notesaner',
      locale: 'en_US',
      modifiedTime: updatedAt,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: title,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Generate metadata for the vault index page.
 */
export function generateVaultMetadata(input: {
  slug: string;
  name: string;
  description: string | null;
  noteCount: number;
}): Metadata {
  const { slug, name, description, noteCount } = input;
  const url = `${APP_URL}/public/${slug}`;
  const desc =
    description ??
    `${name} - a public knowledge base with ${noteCount} published notes on Notesaner.`;

  const ogImage = `${APP_URL}/api/og?${new URLSearchParams({ title: name, slug }).toString()}`;

  return {
    title: name,
    description: desc,
    alternates: {
      canonical: url,
    },
    openGraph: {
      type: 'website',
      title: name,
      description: desc,
      url,
      siteName: 'Notesaner',
      locale: 'en_US',
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: name,
          type: 'image/png',
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: name,
      description: desc,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
