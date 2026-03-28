/**
 * Tests for public-themes.ts
 *
 * Covers:
 *   - Theme structure validation (required color keys present, valid CSS values)
 *   - CSS variable generation (generateThemeCssVars, generateTypographyCssVars)
 *   - Font family preset resolution
 *   - Font size and max-width clamping
 *   - Custom CSS sanitization (sanitizeCustomCss, detectBlockedCssPatterns)
 *   - Lookup helpers (findPublicThemeById, getPublicThemeClass)
 */

import { describe, it, expect } from 'vitest';
import {
  PUBLIC_BUILT_IN_THEMES,
  PUBLIC_FONT_PRESETS,
  publicThemeLight,
  publicThemeDark,
  publicThemeSepia,
  publicThemeHighContrast,
  generateThemeCssVars,
  generateTypographyCssVars,
  sanitizeCustomCss,
  detectBlockedCssPatterns,
  findPublicThemeById,
  getPublicThemeClass,
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  MAX_WIDTH_MIN,
  MAX_WIDTH_MAX,
  MAX_WIDTH_DEFAULT,
  type PublicThemeColors,
} from '../public-themes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * The full set of required color keys from the PublicThemeColors interface.
 * We derive this at test time from the light theme which we trust as canonical.
 */
const REQUIRED_COLOR_KEYS: (keyof PublicThemeColors)[] = Object.keys(
  publicThemeLight.colors,
) as (keyof PublicThemeColors)[];

// ---------------------------------------------------------------------------
// Theme structure validation
// ---------------------------------------------------------------------------

describe('PUBLIC_BUILT_IN_THEMES', () => {
  it('contains exactly four themes', () => {
    expect(PUBLIC_BUILT_IN_THEMES).toHaveLength(4);
  });

  it('contains the four expected theme IDs in order', () => {
    const ids = PUBLIC_BUILT_IN_THEMES.map((t) => t.id);
    expect(ids).toEqual(['light', 'dark', 'sepia', 'high-contrast']);
  });

  it('each theme has a non-empty name and description', () => {
    for (const theme of PUBLIC_BUILT_IN_THEMES) {
      expect(theme.name.length).toBeGreaterThan(0);
      expect(theme.description.length).toBeGreaterThan(0);
    }
  });

  it('each theme has all required color keys', () => {
    for (const theme of PUBLIC_BUILT_IN_THEMES) {
      for (const key of REQUIRED_COLOR_KEYS) {
        expect(
          Object.prototype.hasOwnProperty.call(theme.colors, key),
          `Theme "${theme.id}" is missing color key "${key}"`,
        ).toBe(true);
      }
    }
  });

  it('each theme color value is a non-empty string', () => {
    for (const theme of PUBLIC_BUILT_IN_THEMES) {
      for (const [key, value] of Object.entries(theme.colors)) {
        expect(typeof value, `${theme.id}.${key} should be string`).toBe('string');
        expect(value.length, `${theme.id}.${key} should be non-empty`).toBeGreaterThan(0);
      }
    }
  });
});

describe('Theme isDark flags', () => {
  it('light theme is not dark', () => {
    expect(publicThemeLight.isDark).toBe(false);
  });

  it('dark theme is dark', () => {
    expect(publicThemeDark.isDark).toBe(true);
  });

  it('sepia theme is not dark', () => {
    expect(publicThemeSepia.isDark).toBe(false);
  });

  it('high-contrast theme is dark', () => {
    expect(publicThemeHighContrast.isDark).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// generateThemeCssVars
// ---------------------------------------------------------------------------

describe('generateThemeCssVars', () => {
  it('generates a :root block containing all color variable declarations', () => {
    const css = generateThemeCssVars(publicThemeLight);
    expect(css).toContain(':root {');
    expect(css).toContain('--pub-color-bg:');
    expect(css).toContain('--pub-color-fg:');
    expect(css).toContain('--pub-color-accent:');
    expect(css).toContain('}');
  });

  it('includes the correct value for pub-color-bg in the light theme', () => {
    const css = generateThemeCssVars(publicThemeLight);
    expect(css).toContain(`--pub-color-bg: ${publicThemeLight.colors['pub-color-bg']};`);
  });

  it('uses the correct value for pub-color-bg in the dark theme', () => {
    const css = generateThemeCssVars(publicThemeDark);
    expect(css).toContain(`--pub-color-bg: ${publicThemeDark.colors['pub-color-bg']};`);
  });

  it('generates exactly as many variable declarations as there are color keys', () => {
    const css = generateThemeCssVars(publicThemeLight);
    const declarationCount = (css.match(/--pub-/g) ?? []).length;
    expect(declarationCount).toBe(REQUIRED_COLOR_KEYS.length);
  });

  it('generates a valid CSS block that starts with :root and ends with }', () => {
    const css = generateThemeCssVars(publicThemeSepia);
    expect(css.trimStart()).toMatch(/^:root\s*\{/);
    expect(css.trimEnd()).toMatch(/\}\s*$/);
  });
});

// ---------------------------------------------------------------------------
// generateTypographyCssVars
// ---------------------------------------------------------------------------

describe('generateTypographyCssVars', () => {
  it('generates a :root block with --pub-font-family, --pub-font-size-base, --pub-content-max-width', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'system-ui',
      fontSize: 16,
      maxWidth: 740,
    });
    expect(css).toContain('--pub-font-family:');
    expect(css).toContain('--pub-font-size-base: 16px;');
    expect(css).toContain('--pub-content-max-width: 740px;');
  });

  it('uses the serif font stack for the serif preset', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'serif',
      fontSize: 16,
      maxWidth: 740,
    });
    expect(css).toContain('Georgia');
  });

  it('uses the monospace font stack for the monospace preset', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'monospace',
      fontSize: 16,
      maxWidth: 740,
    });
    expect(css).toContain('monospace');
  });

  it('uses the custom font family when fontFamily is custom and customFontFamily is provided', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'custom',
      customFontFamily: 'Lora',
      fontSize: 16,
      maxWidth: 740,
    });
    expect(css).toContain('Lora');
  });

  it('falls back to system-ui when fontFamily is custom but customFontFamily is empty', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'custom',
      customFontFamily: '',
      fontSize: 16,
      maxWidth: 740,
    });
    expect(css).toContain('system-ui');
  });

  it('clamps font size to FONT_SIZE_MIN when input is below minimum', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'system-ui',
      fontSize: 1,
      maxWidth: 740,
    });
    expect(css).toContain(`--pub-font-size-base: ${FONT_SIZE_MIN}px;`);
  });

  it('clamps font size to FONT_SIZE_MAX when input exceeds maximum', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'system-ui',
      fontSize: 9999,
      maxWidth: 740,
    });
    expect(css).toContain(`--pub-font-size-base: ${FONT_SIZE_MAX}px;`);
  });

  it('clamps max-width to MAX_WIDTH_MIN when input is below minimum', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'system-ui',
      fontSize: 16,
      maxWidth: 10,
    });
    expect(css).toContain(`--pub-content-max-width: ${MAX_WIDTH_MIN}px;`);
  });

  it('clamps max-width to MAX_WIDTH_MAX when input exceeds maximum', () => {
    const css = generateTypographyCssVars({
      fontFamily: 'system-ui',
      fontSize: 16,
      maxWidth: 999999,
    });
    expect(css).toContain(`--pub-content-max-width: ${MAX_WIDTH_MAX}px;`);
  });
});

// ---------------------------------------------------------------------------
// Font presets
// ---------------------------------------------------------------------------

describe('PUBLIC_FONT_PRESETS', () => {
  it('contains exactly four presets', () => {
    expect(PUBLIC_FONT_PRESETS).toHaveLength(4);
  });

  it('includes system-ui, serif, monospace, and custom', () => {
    const ids = PUBLIC_FONT_PRESETS.map((p) => p.id);
    expect(ids).toContain('system-ui');
    expect(ids).toContain('serif');
    expect(ids).toContain('monospace');
    expect(ids).toContain('custom');
  });

  it('each preset has a non-empty label and sample', () => {
    for (const preset of PUBLIC_FONT_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.sample.length).toBeGreaterThan(0);
    }
  });

  it('custom preset has an empty stack (intentionally deferred to runtime)', () => {
    const customPreset = PUBLIC_FONT_PRESETS.find((p) => p.id === 'custom');
    expect(customPreset?.stack).toBe('');
  });
});

// ---------------------------------------------------------------------------
// Constant bounds
// ---------------------------------------------------------------------------

describe('Constants', () => {
  it('FONT_SIZE_MIN is 12', () => {
    expect(FONT_SIZE_MIN).toBe(12);
  });

  it('FONT_SIZE_MAX is 24', () => {
    expect(FONT_SIZE_MAX).toBe(24);
  });

  it('FONT_SIZE_DEFAULT is within [FONT_SIZE_MIN, FONT_SIZE_MAX]', () => {
    expect(FONT_SIZE_DEFAULT).toBeGreaterThanOrEqual(FONT_SIZE_MIN);
    expect(FONT_SIZE_DEFAULT).toBeLessThanOrEqual(FONT_SIZE_MAX);
  });

  it('MAX_WIDTH_MIN is 480', () => {
    expect(MAX_WIDTH_MIN).toBe(480);
  });

  it('MAX_WIDTH_MAX is 1440', () => {
    expect(MAX_WIDTH_MAX).toBe(1440);
  });

  it('MAX_WIDTH_DEFAULT is within [MAX_WIDTH_MIN, MAX_WIDTH_MAX]', () => {
    expect(MAX_WIDTH_DEFAULT).toBeGreaterThanOrEqual(MAX_WIDTH_MIN);
    expect(MAX_WIDTH_DEFAULT).toBeLessThanOrEqual(MAX_WIDTH_MAX);
  });
});

// ---------------------------------------------------------------------------
// sanitizeCustomCss
// ---------------------------------------------------------------------------

describe('sanitizeCustomCss', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeCustomCss('')).toBe('');
  });

  it('returns empty string for null/undefined-like falsy values', () => {
    // TypeScript callers should pass strings; guard against runtime misuse.
    expect(sanitizeCustomCss(undefined as unknown as string)).toBe('');
    expect(sanitizeCustomCss(null as unknown as string)).toBe('');
  });

  it('passes through safe CSS unchanged', () => {
    const safe = `.pub-content { color: red; }`;
    expect(sanitizeCustomCss(safe)).toBe(safe);
  });

  it('removes lines containing expression()', () => {
    const input = `body { background: expression(alert(1)); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('expression(');
  });

  it('removes lines containing javascript: URIs', () => {
    const input = `a { background: url(javascript:alert(1)); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('javascript:');
  });

  it('removes lines containing vbscript: URIs', () => {
    const input = `a { behavior: url(vbscript:something); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('vbscript:');
  });

  it('removes lines containing -moz-binding', () => {
    const input = `div { -moz-binding: url("http://evil.com/binding.xml#xss"); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('-moz-binding');
  });

  it('removes lines containing behavior:', () => {
    const input = `div { behavior: url("malicious.htc"); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('behavior:');
  });

  it('preserves data:image/ url() references', () => {
    const input = `.logo { background: url(data:image/png;base64,abc123); }`;
    expect(sanitizeCustomCss(input)).toContain('data:image/png');
  });

  it('preserves data:font/ url() references', () => {
    const input = `@font-face { src: url(data:font/woff2;base64,abc); }`;
    expect(sanitizeCustomCss(input)).toContain('data:font/woff2');
  });

  it('removes external url() references (http/https)', () => {
    const input = `.foo { background: url(https://evil.com/img.png); }`;
    const result = sanitizeCustomCss(input);
    expect(result).not.toContain('https://evil.com');
  });

  it('preserves fragment (hash) url() references', () => {
    const input = `svg { fill: url(#gradient); }`;
    expect(sanitizeCustomCss(input)).toContain('url(#gradient)');
  });

  it('only removes the offending lines, not the entire CSS', () => {
    const input = [
      `.safe { color: red; }`,
      `body { behavior: url("bad.htc"); }`,
      `.also-safe { margin: 0; }`,
    ].join('\n');

    const result = sanitizeCustomCss(input);
    expect(result).toContain('.safe');
    expect(result).toContain('.also-safe');
    expect(result).not.toContain('behavior:');
  });
});

// ---------------------------------------------------------------------------
// detectBlockedCssPatterns
// ---------------------------------------------------------------------------

describe('detectBlockedCssPatterns', () => {
  it('returns empty array for empty input', () => {
    expect(detectBlockedCssPatterns('')).toEqual([]);
  });

  it('returns empty array for safe CSS', () => {
    const safe = `h1 { font-size: 2rem; color: var(--pub-color-fg-heading); }`;
    expect(detectBlockedCssPatterns(safe)).toEqual([]);
  });

  it('returns a warning for expression()', () => {
    const warnings = detectBlockedCssPatterns(`div { background: expression(1+1); }`);
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.toLowerCase().includes('expression'))).toBe(true);
  });

  it('returns a warning for javascript: URI', () => {
    const warnings = detectBlockedCssPatterns(`a { href: javascript:void(0); }`);
    expect(warnings.some((w) => w.toLowerCase().includes('javascript'))).toBe(true);
  });

  it('returns a warning for vbscript: URI', () => {
    const warnings = detectBlockedCssPatterns(`div { src: vbscript:run; }`);
    expect(warnings.some((w) => w.toLowerCase().includes('vbscript'))).toBe(true);
  });

  it('returns a warning for external url()', () => {
    const warnings = detectBlockedCssPatterns(`div { background: url(http://evil.com/x); }`);
    expect(warnings.some((w) => w.toLowerCase().includes('url'))).toBe(true);
  });

  it('does not duplicate the same warning when the pattern appears multiple times', () => {
    const input = [`a { background: expression(1); }`, `b { background: expression(2); }`].join(
      '\n',
    );
    const warnings = detectBlockedCssPatterns(input);
    const expressionWarnings = warnings.filter((w) => w.toLowerCase().includes('expression'));
    expect(expressionWarnings).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// findPublicThemeById
// ---------------------------------------------------------------------------

describe('findPublicThemeById', () => {
  it('returns the light theme by ID', () => {
    const theme = findPublicThemeById('light');
    expect(theme).toBeDefined();
    expect(theme?.id).toBe('light');
  });

  it('returns the dark theme by ID', () => {
    expect(findPublicThemeById('dark')?.id).toBe('dark');
  });

  it('returns the sepia theme by ID', () => {
    expect(findPublicThemeById('sepia')?.id).toBe('sepia');
  });

  it('returns the high-contrast theme by ID', () => {
    expect(findPublicThemeById('high-contrast')?.id).toBe('high-contrast');
  });

  it('returns undefined for an unknown theme ID', () => {
    expect(findPublicThemeById('nonexistent')).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// getPublicThemeClass
// ---------------------------------------------------------------------------

describe('getPublicThemeClass', () => {
  it('returns the correct class name for light', () => {
    expect(getPublicThemeClass('light')).toBe('pub-theme-light');
  });

  it('returns the correct class name for dark', () => {
    expect(getPublicThemeClass('dark')).toBe('pub-theme-dark');
  });

  it('returns the correct class name for sepia', () => {
    expect(getPublicThemeClass('sepia')).toBe('pub-theme-sepia');
  });

  it('returns the correct class name for high-contrast', () => {
    expect(getPublicThemeClass('high-contrast')).toBe('pub-theme-high-contrast');
  });
});
