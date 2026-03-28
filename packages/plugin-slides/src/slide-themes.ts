/**
 * Built-in presentation themes for the Notesaner Slides plugin.
 *
 * Each theme is a CSS-in-JS object containing:
 * - `id`          — Stable identifier (used in frontmatter and store)
 * - `label`       — Human-readable name for the theme picker UI
 * - `description` — Short description shown in the theme picker
 * - `vars`        — CSS custom property values applied to the slide container
 *
 * The slide presenter injects these custom properties as inline CSS variables
 * on the root presentation element. All theming is done via variables so the
 * slide markdown renderer only needs to reference `var(--slide-*)` tokens.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** CSS custom properties for a single theme. */
export interface ThemeVars {
  /** Slide background color */
  '--slide-bg': string;
  /** Primary text color */
  '--slide-text': string;
  /** Heading text color */
  '--slide-heading': string;
  /** Accent / highlight color (links, code, borders) */
  '--slide-accent': string;
  /** Inline code background */
  '--slide-code-bg': string;
  /** Inline code text color */
  '--slide-code-text': string;
  /** Blockquote border and text color */
  '--slide-quote': string;
  /** Table header background */
  '--slide-table-header-bg': string;
  /** Table header text */
  '--slide-table-header-text': string;
  /** Table row alternating background */
  '--slide-table-alt-row': string;
  /** Base font family */
  '--slide-font-body': string;
  /** Heading font family */
  '--slide-font-heading': string;
  /** Base font size (rem) */
  '--slide-font-size': string;
  /** Slide border radius */
  '--slide-radius': string;
  /** Speaker notes background */
  '--slide-notes-bg': string;
  /** Speaker notes text */
  '--slide-notes-text': string;
  /** Slide number / indicator color */
  '--slide-indicator': string;
}

/** A fully-defined slide theme. */
export interface SlideTheme {
  /** Stable identifier (lower-case, no spaces). */
  id: string;
  /** Human-readable label for the theme picker. */
  label: string;
  /** Short description shown in the picker tooltip. */
  description: string;
  /** CSS variable values injected onto the presentation root. */
  vars: ThemeVars;
}

// ---------------------------------------------------------------------------
// Theme definitions
// ---------------------------------------------------------------------------

/**
 * Default — clean white slide with indigo accents.
 * Good all-purpose theme for most presentations.
 */
const DEFAULT_THEME: SlideTheme = {
  id: 'default',
  label: 'Default',
  description: 'Clean white background with indigo accents.',
  vars: {
    '--slide-bg': '#ffffff',
    '--slide-text': '#1e293b',
    '--slide-heading': '#0f172a',
    '--slide-accent': '#6366f1',
    '--slide-code-bg': '#f1f5f9',
    '--slide-code-text': '#0f172a',
    '--slide-quote': '#6366f1',
    '--slide-table-header-bg': '#f1f5f9',
    '--slide-table-header-text': '#0f172a',
    '--slide-table-alt-row': '#f8fafc',
    '--slide-font-body': "'Inter', 'Segoe UI', system-ui, sans-serif",
    '--slide-font-heading': "'Inter', 'Segoe UI', system-ui, sans-serif",
    '--slide-font-size': '1.15rem',
    '--slide-radius': '0.5rem',
    '--slide-notes-bg': '#f8fafc',
    '--slide-notes-text': '#475569',
    '--slide-indicator': '#94a3b8',
  },
};

/**
 * Dark — deep slate background with cyan accents.
 * Great for technical talks and developer conferences.
 */
const DARK_THEME: SlideTheme = {
  id: 'dark',
  label: 'Dark',
  description: 'Deep slate background with cyan accents.',
  vars: {
    '--slide-bg': '#0f172a',
    '--slide-text': '#e2e8f0',
    '--slide-heading': '#f8fafc',
    '--slide-accent': '#22d3ee',
    '--slide-code-bg': '#1e293b',
    '--slide-code-text': '#7dd3fc',
    '--slide-quote': '#22d3ee',
    '--slide-table-header-bg': '#1e293b',
    '--slide-table-header-text': '#e2e8f0',
    '--slide-table-alt-row': '#162032',
    '--slide-font-body': "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
    '--slide-font-heading': "'Inter', 'Segoe UI', system-ui, sans-serif",
    '--slide-font-size': '1.1rem',
    '--slide-radius': '0.375rem',
    '--slide-notes-bg': '#1e293b',
    '--slide-notes-text': '#94a3b8',
    '--slide-indicator': '#475569',
  },
};

/**
 * Light — warm off-white with amber accents.
 * Soft and readable for business or educational content.
 */
const LIGHT_THEME: SlideTheme = {
  id: 'light',
  label: 'Light',
  description: 'Warm off-white background with amber accents.',
  vars: {
    '--slide-bg': '#fffbf5',
    '--slide-text': '#292524',
    '--slide-heading': '#1c1917',
    '--slide-accent': '#f59e0b',
    '--slide-code-bg': '#fef3c7',
    '--slide-code-text': '#78350f',
    '--slide-quote': '#d97706',
    '--slide-table-header-bg': '#fef3c7',
    '--slide-table-header-text': '#292524',
    '--slide-table-alt-row': '#fffdf7',
    '--slide-font-body': "'Georgia', 'Charter', serif",
    '--slide-font-heading': "'Merriweather', 'Georgia', serif",
    '--slide-font-size': '1.15rem',
    '--slide-radius': '0.25rem',
    '--slide-notes-bg': '#fef9f0',
    '--slide-notes-text': '#78716c',
    '--slide-indicator': '#d6d3d1',
  },
};

/**
 * Academic — neutral grey with teal accents.
 * Structured and professional for academic or research presentations.
 */
const ACADEMIC_THEME: SlideTheme = {
  id: 'academic',
  label: 'Academic',
  description: 'Neutral grey palette suited for academic presentations.',
  vars: {
    '--slide-bg': '#f9fafb',
    '--slide-text': '#111827',
    '--slide-heading': '#030712',
    '--slide-accent': '#0d9488',
    '--slide-code-bg': '#e5e7eb',
    '--slide-code-text': '#111827',
    '--slide-quote': '#0d9488',
    '--slide-table-header-bg': '#e5e7eb',
    '--slide-table-header-text': '#111827',
    '--slide-table-alt-row': '#f3f4f6',
    '--slide-font-body': "'Source Sans Pro', 'Arial', sans-serif",
    '--slide-font-heading': "'Source Serif Pro', 'Georgia', serif",
    '--slide-font-size': '1.1rem',
    '--slide-radius': '0.25rem',
    '--slide-notes-bg': '#f3f4f6',
    '--slide-notes-text': '#6b7280',
    '--slide-indicator': '#9ca3af',
  },
};

/**
 * Minimal — pure white with maximum whitespace, no visual chrome.
 * For content-first presentations or design portfolios.
 */
const MINIMAL_THEME: SlideTheme = {
  id: 'minimal',
  label: 'Minimal',
  description: 'Pure white with generous whitespace and no visual chrome.',
  vars: {
    '--slide-bg': '#ffffff',
    '--slide-text': '#171717',
    '--slide-heading': '#000000',
    '--slide-accent': '#000000',
    '--slide-code-bg': '#f5f5f5',
    '--slide-code-text': '#171717',
    '--slide-quote': '#737373',
    '--slide-table-header-bg': '#f5f5f5',
    '--slide-table-header-text': '#171717',
    '--slide-table-alt-row': '#fafafa',
    '--slide-font-body': "'Helvetica Neue', 'Helvetica', Arial, sans-serif",
    '--slide-font-heading': "'Helvetica Neue', 'Helvetica', Arial, sans-serif",
    '--slide-font-size': '1.2rem',
    '--slide-radius': '0',
    '--slide-notes-bg': '#fafafa',
    '--slide-notes-text': '#525252',
    '--slide-indicator': '#d4d4d4',
  },
};

/**
 * Neon — vibrant dark background with neon pink and green accents.
 * Eye-catching for demos, hackathon pitches, or creative content.
 */
const NEON_THEME: SlideTheme = {
  id: 'neon',
  label: 'Neon',
  description: 'Dark background with neon pink and green accents.',
  vars: {
    '--slide-bg': '#09090b',
    '--slide-text': '#fafafa',
    '--slide-heading': '#ffffff',
    '--slide-accent': '#f0abfc',
    '--slide-code-bg': '#18181b',
    '--slide-code-text': '#4ade80',
    '--slide-quote': '#f0abfc',
    '--slide-table-header-bg': '#18181b',
    '--slide-table-header-text': '#fafafa',
    '--slide-table-alt-row': '#121212',
    '--slide-font-body': "'IBM Plex Mono', 'Fira Code', monospace",
    '--slide-font-heading': "'IBM Plex Sans', system-ui, sans-serif",
    '--slide-font-size': '1.1rem',
    '--slide-radius': '0.5rem',
    '--slide-notes-bg': '#18181b',
    '--slide-notes-text': '#a1a1aa',
    '--slide-indicator': '#3f3f46',
  },
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

/** All built-in themes, in display order. */
export const BUILT_IN_THEMES: ReadonlyArray<SlideTheme> = [
  DEFAULT_THEME,
  DARK_THEME,
  LIGHT_THEME,
  ACADEMIC_THEME,
  MINIMAL_THEME,
  NEON_THEME,
];

/** The default theme id used when none is specified. */
export const DEFAULT_THEME_ID = DEFAULT_THEME.id;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Looks up a theme by its id. Falls back to the default theme when the id is
 * not found.
 *
 * @param id  Theme id string (e.g. "dark", "academic").
 */
export function getTheme(id: string): SlideTheme {
  return BUILT_IN_THEMES.find((t) => t.id === id) ?? DEFAULT_THEME;
}

/**
 * Converts a theme's `vars` object into an inline-style-compatible string of
 * CSS custom property declarations.
 *
 * Example output:
 * `--slide-bg: #ffffff; --slide-text: #1e293b; ...`
 *
 * @param theme  A SlideTheme whose vars will be stringified.
 */
export function themeVarsToStyle(theme: SlideTheme): string {
  return Object.entries(theme.vars)
    .map(([key, value]) => `${key}: ${value}`)
    .join('; ');
}

/**
 * Converts a theme's `vars` object into a plain React `style` prop record.
 *
 * @param theme  A SlideTheme whose vars will be converted.
 */
export function themeVarsToReactStyle(theme: SlideTheme): Record<string, string> {
  return Object.fromEntries(Object.entries(theme.vars)) as Record<string, string>;
}
