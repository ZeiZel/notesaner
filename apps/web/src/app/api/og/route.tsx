/**
 * OG Image Generation Endpoint
 *
 * Generates dynamic Open Graph images for published notes and vaults
 * using @vercel/og (ImageResponse from next/og).
 *
 * GET /api/og?title=...&slug=...&path=...
 *
 * Query parameters:
 *   - title (required): The note or vault title
 *   - slug  (optional): The vault's public slug
 *   - path  (optional): The note path within the vault
 *
 * The generated image is 1200x630 pixels (standard OG image dimensions)
 * and is cached by Next.js for performance.
 */

import { ImageResponse } from 'next/og';
import { type NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export const runtime = 'edge';

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const title = searchParams.get('title') ?? 'Untitled Note';
  const slug = searchParams.get('slug') ?? '';
  const notePath = searchParams.get('path') ?? '';

  // Build display path
  const displayPath = notePath
    ? `${slug} / ${decodeURIComponent(notePath).replace(/\.md$/, '').replace(/\//g, ' / ')}`
    : slug;

  // Truncate title if too long
  const maxTitleLength = 80;
  const displayTitle =
    title.length > maxTitleLength ? title.slice(0, maxTitleLength) + '...' : title;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '60px',
        background: 'linear-gradient(135deg, #1a1b2e 0%, #16213e 50%, #0f3460 100%)',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* Top section: decorative accent line */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            width: '80px',
            height: '4px',
            background: 'linear-gradient(90deg, #4dabf7, #748ffc)',
            borderRadius: '2px',
            marginBottom: '32px',
          }}
        />

        {/* Vault path */}
        {displayPath && (
          <div
            style={{
              fontSize: '20px',
              color: '#748ffc',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              marginBottom: '16px',
              opacity: 0.9,
            }}
          >
            {displayPath}
          </div>
        )}

        {/* Title */}
        <div
          style={{
            fontSize: displayTitle.length > 50 ? '42px' : '52px',
            fontWeight: 700,
            color: '#e9ecef',
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            maxWidth: '900px',
          }}
        >
          {displayTitle}
        </div>
      </div>

      {/* Bottom section: branding */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {/* Logo placeholder */}
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #4dabf7, #748ffc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            N
          </div>
          <div
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: '#adb5bd',
              letterSpacing: '-0.01em',
            }}
          >
            Notesaner
          </div>
        </div>

        {/* Decorative dots */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            opacity: 0.3,
          }}
        >
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#4dabf7',
              }}
            />
          ))}
        </div>
      </div>
    </div>,
    {
      width: OG_WIDTH,
      height: OG_HEIGHT,
    },
  );
}
