/**
 * Notesaner Design Tokens — TypeScript Constants
 *
 * These are the raw token values for use in:
 *   - JavaScript/TypeScript runtime logic (not CSS)
 *   - Theme provider color derivation (darken, lighten)
 *   - Canvas rendering (graph view, Excalidraw integration)
 *   - Server-side rendering (email templates, PDF export)
 *
 * For CSS styling, always use the CSS custom properties from tokens.css.
 * These constants are the single source of truth that tokens.css is derived from.
 */

// ---------------------------------------------------------------------------
// Color Palette — Catppuccin Mocha (Dark Theme)
// ---------------------------------------------------------------------------

export const catppuccinMocha = {
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
  text: '#cdd6f4',
  subtext1: '#bac2de',
  subtext0: '#a6adc8',
  overlay2: '#9399b2',
  overlay1: '#7f849c',
  overlay0: '#6c7086',
  surface2: '#585b70',
  surface1: '#45475a',
  surface0: '#313244',
  base: '#1e1e2e',
  mantle: '#181825',
  crust: '#11111b',
} as const;

// ---------------------------------------------------------------------------
// Color Palette — Catppuccin Latte (Light Theme)
// ---------------------------------------------------------------------------

export const catppuccinLatte = {
  rosewater: '#dc8a78',
  flamingo: '#dd7878',
  pink: '#ea76cb',
  mauve: '#8839ef',
  red: '#d20f39',
  maroon: '#e64553',
  peach: '#fe640b',
  yellow: '#df8e1d',
  green: '#40a02b',
  teal: '#179299',
  sky: '#04a5e5',
  sapphire: '#209fb5',
  blue: '#1e66f5',
  lavender: '#7287fd',
  text: '#4c4f69',
  subtext1: '#5c5f77',
  subtext0: '#6c6f85',
  overlay2: '#7c7f93',
  overlay1: '#8c8fa1',
  overlay0: '#9ca0b0',
  surface2: '#acb0be',
  surface1: '#bcc0cc',
  surface0: '#ccd0da',
  base: '#eff1f5',
  mantle: '#e6e9ef',
  crust: '#dce0e8',
} as const;

// ---------------------------------------------------------------------------
// Semantic Color Tokens
// ---------------------------------------------------------------------------

export type ThemeMode = 'dark' | 'light';

export interface SemanticColors {
  background: string;
  backgroundSurface: string;
  backgroundElevated: string;
  backgroundOverlay: string;
  backgroundInput: string;

  foreground: string;
  foregroundSecondary: string;
  foregroundMuted: string;
  foregroundInverse: string;

  primary: string;
  primaryHover: string;
  primaryActive: string;
  primaryForeground: string;

  secondary: string;
  secondaryHover: string;
  secondaryForeground: string;

  accent: string;
  accentHover: string;
  accentForeground: string;

  muted: string;
  mutedForeground: string;

  destructive: string;
  destructiveHover: string;
  destructiveForeground: string;

  success: string;
  warning: string;
  error: string;
  info: string;

  border: string;
  input: string;
  ring: string;

  card: string;
  cardForeground: string;

  popover: string;
  popoverForeground: string;

  sidebarBackground: string;
  sidebarForeground: string;
  sidebarBorder: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
}

export const semanticColors: Record<ThemeMode, SemanticColors> = {
  dark: {
    background: '#1e1e2e',
    backgroundSurface: '#252537',
    backgroundElevated: '#2d2d44',
    backgroundOverlay: '#36365a',
    backgroundInput: '#1a1a2e',

    foreground: '#cdd6f4',
    foregroundSecondary: '#a6adc8',
    foregroundMuted: '#6c7086',
    foregroundInverse: '#1e1e2e',

    primary: '#cba6f7',
    primaryHover: '#b98ef5',
    primaryActive: '#a876f3',
    primaryForeground: '#1e1e2e',

    secondary: '#45475a',
    secondaryHover: '#525466',
    secondaryForeground: '#cdd6f4',

    accent: '#f5c2e7',
    accentHover: '#f0b0dd',
    accentForeground: '#1e1e2e',

    muted: '#45475a',
    mutedForeground: '#a6adc8',

    destructive: '#f38ba8',
    destructiveHover: '#f07090',
    destructiveForeground: '#1e1e2e',

    success: '#a6e3a1',
    warning: '#fab387',
    error: '#f38ba8',
    info: '#89dceb',

    border: '#45475a',
    input: '#45475a',
    ring: '#cba6f7',

    card: '#313244',
    cardForeground: '#cdd6f4',

    popover: '#313244',
    popoverForeground: '#cdd6f4',

    sidebarBackground: '#181825',
    sidebarForeground: '#cdd6f4',
    sidebarBorder: '#313244',
    sidebarAccent: '#45475a',
    sidebarAccentForeground: '#cdd6f4',
  },

  light: {
    background: '#eff1f5',
    backgroundSurface: '#e6e9ef',
    backgroundElevated: '#ffffff',
    backgroundOverlay: '#ffffff',
    backgroundInput: '#ffffff',

    foreground: '#4c4f69',
    foregroundSecondary: '#5c5f77',
    foregroundMuted: '#6c6f85',
    foregroundInverse: '#ffffff',

    primary: '#8839ef',
    primaryHover: '#7528e0',
    primaryActive: '#6520c7',
    primaryForeground: '#ffffff',

    secondary: '#e6e9ef',
    secondaryHover: '#dce0e8',
    secondaryForeground: '#4c4f69',

    accent: '#ea76cb',
    accentHover: '#e560c0',
    accentForeground: '#ffffff',

    muted: '#e6e9ef',
    mutedForeground: '#6c6f85',

    destructive: '#d20f39',
    destructiveHover: '#b80d32',
    destructiveForeground: '#ffffff',

    success: '#40a02b',
    warning: '#fe640b',
    error: '#d20f39',
    info: '#04a5e5',

    border: '#ccd0da',
    input: '#ccd0da',
    ring: '#8839ef',

    card: '#ffffff',
    cardForeground: '#4c4f69',

    popover: '#ffffff',
    popoverForeground: '#4c4f69',

    sidebarBackground: '#dce0e8',
    sidebarForeground: '#4c4f69',
    sidebarBorder: '#ccd0da',
    sidebarAccent: '#e6e9ef',
    sidebarAccentForeground: '#4c4f69',
  },
} as const;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const fontFamily = {
  sans: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
  mono: "'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  serif: "'Lora', 'Georgia', 'Times New Roman', serif",
} as const;

export const fontSize = {
  '2xs': 11,
  xs: 12,
  sm: 13,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 36,
  '5xl': 48,
} as const;

export const fontWeight = {
  thin: 100,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
} as const;

export const lineHeight = {
  none: 1,
  tight: 1.25,
  snug: 1.375,
  normal: 1.5,
  relaxed: 1.625,
  loose: 1.75,
} as const;

export const letterSpacing = {
  tighter: '-0.05em',
  tight: '-0.025em',
  normal: '0em',
  wide: '0.025em',
  wider: '0.05em',
  widest: '0.1em',
} as const;

// ---------------------------------------------------------------------------
// Spacing (4px grid)
// ---------------------------------------------------------------------------

export const spacing = {
  0: 0,
  px: 1,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
  40: 160,
  48: 192,
  64: 256,
} as const;

// ---------------------------------------------------------------------------
// Border Radius
// ---------------------------------------------------------------------------

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 24,
  full: 9999,
} as const;

// ---------------------------------------------------------------------------
// Shadows
// ---------------------------------------------------------------------------

export const shadow = {
  dark: {
    none: 'none',
    xs: '0 1px 2px rgba(0,0,0,0.3)',
    sm: '0 1px 3px rgba(0,0,0,0.4)',
    md: '0 4px 12px rgba(0,0,0,0.5)',
    lg: '0 8px 24px rgba(0,0,0,0.6)',
    xl: '0 12px 36px rgba(0,0,0,0.65)',
    floating: '0 16px 48px rgba(0,0,0,0.7)',
    inset: 'inset 0 1px 3px rgba(0,0,0,0.3)',
    ring: '0 0 0 3px rgba(203,166,247,0.4)',
    ringError: '0 0 0 3px rgba(243,139,168,0.4)',
  },
  light: {
    none: 'none',
    xs: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 12px rgba(0,0,0,0.12)',
    lg: '0 8px 24px rgba(0,0,0,0.15)',
    xl: '0 12px 36px rgba(0,0,0,0.18)',
    floating: '0 16px 48px rgba(0,0,0,0.2)',
    inset: 'inset 0 1px 3px rgba(0,0,0,0.06)',
    ring: '0 0 0 3px rgba(136,57,239,0.3)',
    ringError: '0 0 0 3px rgba(210,15,57,0.3)',
  },
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

export const duration = {
  instant: 0,
  fast: 100,
  normal: 150,
  moderate: 200,
  slow: 300,
  slower: 500,
} as const;

export const easing = {
  linear: 'linear',
  in: 'cubic-bezier(0.4, 0, 1, 1)',
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  bounce: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
} as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const layout = {
  ribbonWidth: 48,
  sidebarWidth: 260,
  sidebarMin: 180,
  sidebarMax: 480,
  rightSidebarWidth: 280,
  statusbarHeight: 24,
  tabbarHeight: 38,
  toolbarHeight: 44,
  maxWidthProse: '65ch',
  maxWidthContent: 960,
  maxWidthWide: 1280,
} as const;

export const breakpoint = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export const zIndex = {
  base: 0,
  dropdown: 50,
  sticky: 100,
  overlay: 200,
  modal: 300,
  popover: 400,
  tooltip: 500,
  toast: 600,
  spotlight: 700,
  max: 9999,
} as const;

// ---------------------------------------------------------------------------
// Collaborative Cursor Colors
// 14 distinct Catppuccin colors for multi-user cursors / graph nodes / tags
// ---------------------------------------------------------------------------

export const cursorColors = [
  catppuccinMocha.rosewater,
  catppuccinMocha.flamingo,
  catppuccinMocha.pink,
  catppuccinMocha.mauve,
  catppuccinMocha.red,
  catppuccinMocha.maroon,
  catppuccinMocha.peach,
  catppuccinMocha.yellow,
  catppuccinMocha.green,
  catppuccinMocha.teal,
  catppuccinMocha.sky,
  catppuccinMocha.sapphire,
  catppuccinMocha.blue,
  catppuccinMocha.lavender,
] as const;

/**
 * Returns a deterministic cursor color for a given user index.
 * Cycles through the 14 Catppuccin colors.
 */
export function getCursorColor(userIndex: number): string {
  return cursorColors[userIndex % cursorColors.length];
}
