import type { NextConfig } from 'next';

/**
 * CDN asset prefix -- set via NEXT_PUBLIC_ASSET_PREFIX environment variable.
 * When configured, all static assets (_next/static/*) are served from the CDN.
 * Example: https://cdn.notesaner.io
 *
 * Leave unset for local development (assets served from localhost).
 */
const assetPrefix = process.env['NEXT_PUBLIC_ASSET_PREFIX'] ?? '';

const nextConfig: NextConfig = {
  output: 'standalone',

  // ── CDN Asset Prefix ────────────────────────────────────────────────────
  // When set, Next.js prepends this to all static asset URLs.
  // This enables serving JS/CSS/images from a CDN origin.
  ...(assetPrefix ? { assetPrefix } : {}),

  transpilePackages: [
    '@notesaner/ui',
    '@notesaner/contracts',
    '@notesaner/constants',
    '@notesaner/utils',
    '@notesaner/editor-core',
    '@notesaner/sync-engine',
    '@notesaner/markdown',
    '@notesaner/plugin-sdk',
  ],
  experimental: {
    // Enable React 19 features
    ppr: false,
  },

  // ── Image Optimization ─────────────────────────────────────────────────
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
    // Serve modern image formats for smaller file sizes
    formats: ['image/avif', 'image/webp'],
    // Responsive image breakpoints matching common device widths
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Cache optimized images for 60 seconds before revalidating (ISR-like).
    // CDN or reverse proxy should cache these with longer TTLs.
    minimumCacheTTL: 60,
    // Allow configurable image loader for CDN-hosted images
    ...(assetPrefix
      ? {
          loader: 'default',
          path: `${assetPrefix}/_next/image`,
        }
      : {}),
  },

  // ── Security and Cache Headers ─────────────────────────────────────────
  headers: async () => {
    return [
      // Global security headers
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
      // Immutable caching for hashed build assets (JS, CSS chunks)
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Short cache for Next.js data fetches (ISR/SSR pages)
      {
        source: '/_next/data/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, stale-while-revalidate=60',
          },
        ],
      },
      // Moderate cache for static images and fonts in /public
      {
        source: '/fonts/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/images/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, stale-while-revalidate=3600',
          },
        ],
      },
      // Favicon and manifest -- moderate cache
      {
        source: '/(favicon.ico|site.webmanifest|robots.txt)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
