/**
 * Tests for PWA manifest and service worker configuration.
 *
 * Covers:
 *   - manifest.json: required fields, valid values, icon definitions
 *   - sw.js: isStaticAsset helper logic (inlined for testing)
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const publicDir = resolve(__dirname, '../../../../public');

function readManifest(): Record<string, unknown> {
  const raw = readFileSync(resolve(publicDir, 'manifest.json'), 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

// Inline the isStaticAsset logic to test it without loading the full SW file
// (service workers cannot be imported as ES modules in test environments).
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/images/') ||
    pathname.startsWith('/icons/') ||
    /\.(css|js|woff2?|ttf|otf|eot|png|jpg|jpeg|gif|svg|ico|webp|avif)$/.test(pathname)
  );
}

// ---------------------------------------------------------------------------
// manifest.json
// ---------------------------------------------------------------------------

describe('PWA manifest.json', () => {
  it('is valid JSON', () => {
    expect(() => readManifest()).not.toThrow();
  });

  it('has the correct app name and short_name', () => {
    const manifest = readManifest();
    expect(manifest.name).toBe('Notesaner');
    expect(manifest.short_name).toBe('Notesaner');
  });

  it('has display set to standalone', () => {
    const manifest = readManifest();
    expect(manifest.display).toBe('standalone');
  });

  it('has start_url set to /', () => {
    const manifest = readManifest();
    expect(manifest.start_url).toBe('/');
  });

  it('has theme_color defined', () => {
    const manifest = readManifest();
    expect(manifest.theme_color).toBeDefined();
    expect(typeof manifest.theme_color).toBe('string');
  });

  it('has background_color defined', () => {
    const manifest = readManifest();
    expect(manifest.background_color).toBeDefined();
    expect(typeof manifest.background_color).toBe('string');
  });

  it('has at least two icons (192 and 512)', () => {
    const manifest = readManifest();
    const icons = manifest.icons as Array<{ src: string; sizes: string; type: string }>;
    expect(Array.isArray(icons)).toBe(true);
    expect(icons.length).toBeGreaterThanOrEqual(2);

    const sizes = icons.map((i) => i.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('all icons have src, sizes, and type', () => {
    const manifest = readManifest();
    const icons = manifest.icons as Array<Record<string, string>>;
    for (const icon of icons) {
      expect(icon.src).toBeTruthy();
      expect(icon.sizes).toBeTruthy();
      expect(icon.type).toBeTruthy();
    }
  });

  it('has scope defined', () => {
    const manifest = readManifest();
    expect(manifest.scope).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// isStaticAsset (service worker helper)
// ---------------------------------------------------------------------------

describe('isStaticAsset', () => {
  it('matches Next.js static chunk paths', () => {
    expect(isStaticAsset('/_next/static/chunks/main.js')).toBe(true);
    expect(isStaticAsset('/_next/static/css/styles.css')).toBe(true);
  });

  it('matches font paths', () => {
    expect(isStaticAsset('/fonts/inter.woff2')).toBe(true);
    expect(isStaticAsset('/fonts/jetbrains-mono.ttf')).toBe(true);
  });

  it('matches image paths', () => {
    expect(isStaticAsset('/images/logo.png')).toBe(true);
    expect(isStaticAsset('/images/screenshot.webp')).toBe(true);
  });

  it('matches icon paths', () => {
    expect(isStaticAsset('/icons/icon-192x192.png')).toBe(true);
    expect(isStaticAsset('/icons/icon-512x512.png')).toBe(true);
  });

  it('matches files by extension', () => {
    expect(isStaticAsset('/some/path/style.css')).toBe(true);
    expect(isStaticAsset('/some/path/bundle.js')).toBe(true);
    expect(isStaticAsset('/some/path/image.svg')).toBe(true);
    expect(isStaticAsset('/some/path/favicon.ico')).toBe(true);
    expect(isStaticAsset('/some/path/photo.avif')).toBe(true);
  });

  it('does not match API routes', () => {
    expect(isStaticAsset('/api/notes')).toBe(false);
    expect(isStaticAsset('/api/workspaces')).toBe(false);
  });

  it('does not match page navigation routes', () => {
    expect(isStaticAsset('/')).toBe(false);
    expect(isStaticAsset('/workspaces')).toBe(false);
    expect(isStaticAsset('/offline')).toBe(false);
  });
});
