import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
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
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  // Enforce strict Content Security Policy in production
  headers: async () => {
    return [
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
    ];
  },
};

export default nextConfig;
