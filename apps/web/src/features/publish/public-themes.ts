/**
 * public-themes.ts
 *
 * Theme definitions and utility functions for public vault pages.
 *
 * Built-in themes:
 *   - light          : Clean white/grey tones for maximum readability
 *   - dark           : Deep grey background for comfortable night reading
 *   - sepia          : Warm beige/amber — classic book feel
 *   - high-contrast  : WCAG AA/AAA compliant black/white + yellow accents
 *
 * Font family presets map to CSS font stacks. A 'custom' preset accepts
 * any string the user provides.
 *
 * All CSS custom properties are prefixed with --pub- to avoid collisions
 * with the main app --ns- namespace.
 */

// ---------------------------------------------------------------------------
// Type definitions
// ---------------------------------------------------------------------------

/** The four built-in public-vault theme identifiers. */
export type PublicThemeId = 'light' | 'dark' | 'sepia' | 'high-contrast';

/** Font family preset identifiers. */
export type PublicFontFamily = 'system-ui' | 'serif' | 'monospace' | 'custom';

/** Complete CSS custom property map for a public-vault theme. */
export interface PublicThemeColors {
  // Page chrome
  'pub-color-bg': string;
  'pub-color-bg-surface': string;
  'pub-color-bg-sidebar': string;
  'pub-color-bg-code': string;
  'pub-color-bg-blockquote': string;

  // Text
  'pub-color-fg': string;
  'pub-color-fg-muted': string;
  'pub-color-fg-heading': string;
  'pub-color-fg-code': string;
  'pub-color-fg-blockquote': string;

  // Primary accent (links, active items)
  'pub-color-accent': string;
  'pub-color-accent-hover': string;
  'pub-color-accent-visited': string;

  // Borders & dividers
  'pub-color-border': string;
  'pub-color-border-subtle': string;

  // Semantic callout backgrounds
  'pub-color-note-bg': string;
  'pub-color-warning-bg': string;
  'pub-color-tip-bg': string;
  'pub-color-caution-bg': string;

  // Table
  'pub-color-table-header-bg': string;
  'pub-color-table-stripe': string;

  // Selection highlight
  'pub-color-selection-bg': string;
  'pub-color-selection-fg': string;

  // Scrollbar (optional — may be ignored on some browsers)
  'pub-color-scrollbar-thumb': string;
  'pub-color-scrollbar-track': string;
}

/** A complete public-vault theme definition. */
export interface PublicTheme {
  /** Unique identifier. Also applied as the data-pub-theme attribute on <html>. */
  id: PublicThemeId;
  /** Human-readable display name. */
  name: string;
  /** Brief description shown in the settings panel. */
  description: string;
  /** Whether the theme is a dark colour scheme (controls color-scheme property). */
  isDark: boolean;
  /** Full colour token map. */
  colors: PublicThemeColors;
}

/** Font family preset definition. */
export interface PublicFontPreset {
  /** Preset identifier. */
  id: PublicFontFamily;
  /** Human-readable label. */
  label: string;
  /** CSS font-family stack (empty string for 'custom'). */
  stack: string;
  /** Sample text to render in the font selector. */
  sample: string;
}

// ---------------------------------------------------------------------------
// Built-in themes
// ---------------------------------------------------------------------------

export const publicThemeLight: PublicTheme = {
  id: 'light',
  name: 'Light',
  description: 'Clean white and grey tones for daytime reading.',
  isDark: false,
  colors: {
    'pub-color-bg': '#ffffff',
    'pub-color-bg-surface': '#f8f9fa',
    'pub-color-bg-sidebar': '#f1f3f5',
    'pub-color-bg-code': '#f1f3f5',
    'pub-color-bg-blockquote': '#f8f9fa',

    'pub-color-fg': '#212529',
    'pub-color-fg-muted': '#6c757d',
    'pub-color-fg-heading': '#0d0f10',
    'pub-color-fg-code': '#d63384',
    'pub-color-fg-blockquote': '#495057',

    'pub-color-accent': '#1971c2',
    'pub-color-accent-hover': '#1864ab',
    'pub-color-accent-visited': '#6741d9',

    'pub-color-border': '#dee2e6',
    'pub-color-border-subtle': '#e9ecef',

    'pub-color-note-bg': '#e7f5ff',
    'pub-color-warning-bg': '#fff9db',
    'pub-color-tip-bg': '#ebfbee',
    'pub-color-caution-bg': '#fff5f5',

    'pub-color-table-header-bg': '#f1f3f5',
    'pub-color-table-stripe': '#f8f9fa',

    'pub-color-selection-bg': '#1971c2',
    'pub-color-selection-fg': '#ffffff',

    'pub-color-scrollbar-thumb': '#adb5bd',
    'pub-color-scrollbar-track': '#f1f3f5',
  },
};

export const publicThemeDark: PublicTheme = {
  id: 'dark',
  name: 'Dark',
  description: 'Deep grey backgrounds for comfortable night-time reading.',
  isDark: true,
  colors: {
    'pub-color-bg': '#1a1b1e',
    'pub-color-bg-surface': '#25262b',
    'pub-color-bg-sidebar': '#1d1e23',
    'pub-color-bg-code': '#2c2e33',
    'pub-color-bg-blockquote': '#25262b',

    'pub-color-fg': '#c1c2c5',
    'pub-color-fg-muted': '#5c5f66',
    'pub-color-fg-heading': '#e9ecef',
    'pub-color-fg-code': '#f8a4c0',
    'pub-color-fg-blockquote': '#909296',

    'pub-color-accent': '#4dabf7',
    'pub-color-accent-hover': '#74c0fc',
    'pub-color-accent-visited': '#da77f2',

    'pub-color-border': '#373a40',
    'pub-color-border-subtle': '#2c2e33',

    'pub-color-note-bg': '#1c3045',
    'pub-color-warning-bg': '#3b2f0f',
    'pub-color-tip-bg': '#1a3326',
    'pub-color-caution-bg': '#3b1a1a',

    'pub-color-table-header-bg': '#2c2e33',
    'pub-color-table-stripe': '#25262b',

    'pub-color-selection-bg': '#1971c2',
    'pub-color-selection-fg': '#ffffff',

    'pub-color-scrollbar-thumb': '#5c5f66',
    'pub-color-scrollbar-track': '#25262b',
  },
};

export const publicThemeSepia: PublicTheme = {
  id: 'sepia',
  name: 'Sepia',
  description: 'Warm amber tones reminiscent of printed paper.',
  isDark: false,
  colors: {
    'pub-color-bg': '#f4ede0',
    'pub-color-bg-surface': '#ede5d5',
    'pub-color-bg-sidebar': '#e8dfd0',
    'pub-color-bg-code': '#e8dfd0',
    'pub-color-bg-blockquote': '#ede5d5',

    'pub-color-fg': '#3d2b1f',
    'pub-color-fg-muted': '#7a5e48',
    'pub-color-fg-heading': '#2a1a10',
    'pub-color-fg-code': '#8b3a20',
    'pub-color-fg-blockquote': '#5c4233',

    'pub-color-accent': '#6b3a20',
    'pub-color-accent-hover': '#5a2e14',
    'pub-color-accent-visited': '#8b4513',

    'pub-color-border': '#c9b49a',
    'pub-color-border-subtle': '#d8c9b5',

    'pub-color-note-bg': '#dfeae8',
    'pub-color-warning-bg': '#f5e9cc',
    'pub-color-tip-bg': '#dff0e1',
    'pub-color-caution-bg': '#f5ddd8',

    'pub-color-table-header-bg': '#e0d5c4',
    'pub-color-table-stripe': '#ede5d5',

    'pub-color-selection-bg': '#6b3a20',
    'pub-color-selection-fg': '#f4ede0',

    'pub-color-scrollbar-thumb': '#a08060',
    'pub-color-scrollbar-track': '#e8dfd0',
  },
};

export const publicThemeHighContrast: PublicTheme = {
  id: 'high-contrast',
  name: 'High Contrast',
  description: 'WCAG AA/AAA compliant black, white, and yellow accents.',
  isDark: true,
  colors: {
    'pub-color-bg': '#000000',
    'pub-color-bg-surface': '#0a0a0a',
    'pub-color-bg-sidebar': '#050505',
    'pub-color-bg-code': '#111111',
    'pub-color-bg-blockquote': '#0a0a0a',

    'pub-color-fg': '#ffffff',
    'pub-color-fg-muted': '#d0d0d0',
    'pub-color-fg-heading': '#ffffff',
    'pub-color-fg-code': '#ffffff',
    'pub-color-fg-blockquote': '#e0e0e0',

    'pub-color-accent': '#ffff00',
    'pub-color-accent-hover': '#ffff66',
    'pub-color-accent-visited': '#ff88ff',

    'pub-color-border': '#ffffff',
    'pub-color-border-subtle': '#555555',

    'pub-color-note-bg': '#001a33',
    'pub-color-warning-bg': '#332000',
    'pub-color-tip-bg': '#003300',
    'pub-color-caution-bg': '#330000',

    'pub-color-table-header-bg': '#1a1a1a',
    'pub-color-table-stripe': '#0d0d0d',

    'pub-color-selection-bg': '#ffff00',
    'pub-color-selection-fg': '#000000',

    'pub-color-scrollbar-thumb': '#ffffff',
    'pub-color-scrollbar-track': '#1a1a1a',
  },
};

/** Registry of all built-in public-vault themes, in display order. */
export const PUBLIC_BUILT_IN_THEMES: readonly PublicTheme[] = [
  publicThemeLight,
  publicThemeDark,
  publicThemeSepia,
  publicThemeHighContrast,
] as const;

// ---------------------------------------------------------------------------
// Font presets
// ---------------------------------------------------------------------------

export const PUBLIC_FONT_PRESETS: readonly PublicFontPreset[] = [
  {
    id: 'system-ui',
    label: 'System UI',
    stack: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    sample: 'Aa — System default',
  },
  {
    id: 'serif',
    label: 'Serif',
    stack: '"Georgia", "Times New Roman", "Palatino Linotype", Times, serif',
    sample: 'Aa — Serif',
  },
  {
    id: 'monospace',
    label: 'Monospace',
    stack: '"Menlo", "Monaco", "Consolas", "Liberation Mono", "Courier New", monospace',
    sample: 'Aa — Monospace',
  },
  {
    id: 'custom',
    label: 'Custom',
    stack: '',
    sample: 'Aa — Your font',
  },
] as const;

// ---------------------------------------------------------------------------
// CSS generation utilities
// ---------------------------------------------------------------------------

/** Default font size bounds (px). */
export const FONT_SIZE_MIN = 12;
export const FONT_SIZE_MAX = 24;
export const FONT_SIZE_DEFAULT = 16;

/** Default max content width bounds (px). */
export const MAX_WIDTH_MIN = 480;
export const MAX_WIDTH_MAX = 1440;
export const MAX_WIDTH_DEFAULT = 740;

/**
 * Generate the CSS custom property declarations string for a theme.
 * The output is suitable for injection into a <style> tag as the :root block.
 *
 * @example
 * generateThemeCssVars(publicThemeLight)
 * // returns ":root { --pub-color-bg: #ffffff; ... }"
 */
export function generateThemeCssVars(theme: PublicTheme): string {
  const entries = Object.entries(theme.colors)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n');
  return `:root {\n${entries}\n}`;
}

/**
 * Generate the CSS that sets the content typography (font family, size,
 * and max content width). These are injected as additional CSS variables
 * alongside the colour variables.
 */
export function generateTypographyCssVars(options: {
  fontFamily: PublicFontFamily;
  customFontFamily?: string;
  fontSize: number;
  maxWidth: number;
}): string {
  const { fontFamily, customFontFamily, fontSize, maxWidth } = options;

  const clampedFontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, fontSize));
  const clampedMaxWidth = Math.min(MAX_WIDTH_MAX, Math.max(MAX_WIDTH_MIN, maxWidth));

  const preset = PUBLIC_FONT_PRESETS.find((p) => p.id === fontFamily);
  let stack: string;

  if (fontFamily === 'custom') {
    stack = customFontFamily
      ? `${customFontFamily}, system-ui, sans-serif`
      : 'system-ui, sans-serif';
  } else {
    stack = preset?.stack ?? 'system-ui, sans-serif';
  }

  return `:root {
  --pub-font-family: ${stack};
  --pub-font-size-base: ${clampedFontSize}px;
  --pub-content-max-width: ${clampedMaxWidth}px;
}`;
}

// ---------------------------------------------------------------------------
// Custom CSS sanitization
// ---------------------------------------------------------------------------

/**
 * CSS property patterns that are blocked to prevent:
 *   - JavaScript injection via expression() (IE legacy, still worth blocking)
 *   - Pointer-events bypass and visibility tricks used in overlay attacks
 *   - Import of external resources (could load malicious scripts/fonts)
 */
const CSS_BLOCKLIST: RegExp[] = [
  /expression\s*\(/i, // IE CSS expression injection
  /javascript\s*:/i, // javascript: URI
  /vbscript\s*:/i, // vbscript: URI
  /-moz-binding/i, // Firefox XBL binding injection
  /behavior\s*:/i, // IE behavior property
  /\burl\s*\(\s*["']?\s*(?!data:image\/|data:font\/|#)[^)]*["']?\s*\)/i, // non-image/font url() refs
];

/**
 * Sanitize user-provided custom CSS by stripping lines that match known
 * injection patterns.
 *
 * This is a defence-in-depth measure. The primary protection is Content
 * Security Policy (CSP) on the public pages; this sanitizer provides an
 * additional layer.
 *
 * Returns the sanitized CSS string.
 */
export function sanitizeCustomCss(css: string): string {
  if (!css || typeof css !== 'string') return '';

  const lines = css.split('\n');
  const cleaned = lines.filter((line) => {
    return !CSS_BLOCKLIST.some((pattern) => pattern.test(line));
  });

  return cleaned.join('\n');
}

/**
 * Check whether a custom CSS string contains blocked patterns.
 * Returns an array of warning messages (empty if clean).
 */
export function detectBlockedCssPatterns(css: string): string[] {
  if (!css || typeof css !== 'string') return [];

  const warnings: string[] = [];
  const patternLabels: [RegExp, string][] = [
    [/expression\s*\(/i, 'CSS expression() is not allowed'],
    [/javascript\s*:/i, 'javascript: URIs are not allowed'],
    [/vbscript\s*:/i, 'vbscript: URIs are not allowed'],
    [/-moz-binding/i, '-moz-binding is not allowed'],
    [/behavior\s*:/i, 'CSS behavior property is not allowed'],
    [
      /\burl\s*\(\s*["']?\s*(?!data:image\/|data:font\/|#)[^)]*["']?\s*\)/i,
      'External url() references are not allowed (only data:image/, data:font/, or fragment #... URIs)',
    ],
  ];

  const lines = css.split('\n');
  for (const line of lines) {
    for (const [pattern, label] of patternLabels) {
      if (pattern.test(line)) {
        if (!warnings.includes(label)) {
          warnings.push(label);
        }
      }
    }
  }

  return warnings;
}

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/**
 * Look up a built-in theme by ID.
 * Returns undefined if no match is found.
 */
export function findPublicThemeById(id: string): PublicTheme | undefined {
  return PUBLIC_BUILT_IN_THEMES.find((t) => t.id === id);
}

/**
 * Return the CSS class name to apply to <html> for a given theme.
 * This is the data-pub-theme attribute value.
 */
export function getPublicThemeClass(themeId: PublicThemeId): string {
  return `pub-theme-${themeId}`;
}
