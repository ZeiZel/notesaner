/**
 * antd-theme.ts — Ant Design theme configuration mapped to Notesaner design tokens.
 *
 * Maps the Catppuccin-based design token palette (from tokens.css) to the Ant Design
 * token system. Supports both light and dark modes via antd theme algorithms.
 *
 * This configuration is consumed by the AntdProvider wrapper which selects
 * the appropriate algorithm based on the active theme from the theme store.
 *
 * Token reference: https://ant.design/docs/react/customize-theme#seedtoken
 */

import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

// ---------------------------------------------------------------------------
// Catppuccin Mocha (Dark) palette constants
// Sourced from packages/ui/src/styles/tokens.css :root
// ---------------------------------------------------------------------------

const MOCHA = {
  base: '#1e1e2e',
  surface0: '#313244',
  surface1: '#45475a',
  surface2: '#585b70',
  mantle: '#181825',
  crust: '#11111b',
  text: '#cdd6f4',
  subtext0: '#a6adc8',
  subtext1: '#bac2de',
  overlay0: '#6c7086',
  mauve: '#cba6f7',
  mauveHover: '#b98ef5',
  pink: '#f5c2e7',
  red: '#f38ba8',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  blue: '#89b4fa',
  lavender: '#b4befe',
} as const;

// ---------------------------------------------------------------------------
// Catppuccin Latte (Light) palette constants
// Sourced from packages/ui/src/styles/tokens.css [data-theme="light"]
// ---------------------------------------------------------------------------

const LATTE = {
  base: '#eff1f5',
  surface0: '#ccd0da',
  surface1: '#bcc0cc',
  surface2: '#acb0be',
  mantle: '#e6e9ef',
  crust: '#dce0e8',
  text: '#4c4f69',
  subtext0: '#6c6f85',
  subtext1: '#5c5f77',
  overlay0: '#9ca0b0',
  mauve: '#8839ef',
  mauveHover: '#7528e0',
  pink: '#ea76cb',
  red: '#d20f39',
  peach: '#fe640b',
  yellow: '#df8e1d',
  green: '#40a02b',
  teal: '#179299',
  sky: '#04a5e5',
  blue: '#1e66f5',
  lavender: '#7287fd',
} as const;

// ---------------------------------------------------------------------------
// Shared tokens (theme-invariant)
// ---------------------------------------------------------------------------

const SHARED_TOKEN = {
  // Font family — matches --ns-font-sans from tokens.css
  fontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
  fontFamilyCode: "'JetBrains Mono Variable', 'JetBrains Mono', 'Fira Code', 'Consolas', monospace",

  // Font sizes — match --ns-text-* from tokens.css
  fontSize: 14, // --ns-text-base
  fontSizeSM: 12, // --ns-text-xs
  fontSizeLG: 16, // --ns-text-md
  fontSizeXL: 20, // --ns-text-xl
  fontSizeHeading1: 30, // --ns-text-3xl
  fontSizeHeading2: 24, // --ns-text-2xl
  fontSizeHeading3: 20, // --ns-text-xl
  fontSizeHeading4: 18, // --ns-text-lg
  fontSizeHeading5: 16, // --ns-text-md

  // Border radius — matches --ns-radius-* from tokens.css
  borderRadius: 8, // --ns-radius-md (default for buttons, inputs)
  borderRadiusSM: 4, // --ns-radius-sm (badges, chips)
  borderRadiusLG: 12, // --ns-radius-lg (cards, modals)
  borderRadiusXS: 2, // Tiny elements

  // Line height
  lineHeight: 1.5, // --ns-leading-normal

  // Motion — matches --ns-duration-* from tokens.css
  motionDurationFast: '100ms', // --ns-duration-fast
  motionDurationMid: '150ms', // --ns-duration-normal
  motionDurationSlow: '300ms', // --ns-duration-slow

  // Sizing
  controlHeight: 36,
  controlHeightSM: 28,
  controlHeightLG: 44,

  // Spacing base (4px grid matching --ns-space-*)
  marginXS: 8, // --ns-space-2
  marginSM: 12, // --ns-space-3
  margin: 16, // --ns-space-4
  marginMD: 20, // --ns-space-5
  marginLG: 24, // --ns-space-6
  marginXL: 32, // --ns-space-8

  paddingXS: 8, // --ns-space-2
  paddingSM: 12, // --ns-space-3
  padding: 16, // --ns-space-4
  paddingMD: 20, // --ns-space-5
  paddingLG: 24, // --ns-space-6
  paddingXL: 32, // --ns-space-8
} as const;

// ---------------------------------------------------------------------------
// Dark theme token overrides
// ---------------------------------------------------------------------------

const DARK_TOKEN = {
  ...SHARED_TOKEN,

  // Primary color — Catppuccin Mocha Mauve (matches --ns-color-primary)
  colorPrimary: MOCHA.mauve,
  colorPrimaryHover: MOCHA.mauveHover,

  // Background colors
  colorBgContainer: MOCHA.surface0, // Card/container backgrounds
  colorBgElevated: '#2d2d44', // Popovers, dropdowns (--ns-color-background-elevated)
  colorBgLayout: MOCHA.base, // Page background
  colorBgSpotlight: MOCHA.surface1, // Spotlight/highlight bg
  colorBgMask: 'rgba(0, 0, 0, 0.6)', // Modal overlay

  // Text colors
  colorText: MOCHA.text, // Primary text (--ns-color-foreground)
  colorTextSecondary: MOCHA.subtext0, // Secondary text
  colorTextTertiary: MOCHA.overlay0, // Muted/disabled text
  colorTextQuaternary: '#585b70', // Faintest text

  // Border colors
  colorBorder: MOCHA.surface1, // Default borders (--ns-color-border)
  colorBorderSecondary: 'rgba(255, 255, 255, 0.08)', // Subtle borders

  // Semantic colors (mapped from --ns-color-* status tokens)
  colorSuccess: MOCHA.green,
  colorWarning: MOCHA.peach,
  colorError: MOCHA.red,
  colorInfo: MOCHA.sky,

  // Link colors
  colorLink: MOCHA.mauve,
  colorLinkHover: MOCHA.mauveHover,
  colorLinkActive: '#a876f3', // --ns-color-primary-active

  // Fill colors
  colorFill: 'rgba(255, 255, 255, 0.09)', // --ns-color-background-active
  colorFillSecondary: 'rgba(255, 255, 255, 0.05)', // --ns-color-background-hover
  colorFillTertiary: 'rgba(255, 255, 255, 0.04)',
  colorFillQuaternary: 'rgba(255, 255, 255, 0.02)',

  // Split line
  colorSplit: 'rgba(255, 255, 255, 0.08)',
} as const;

// ---------------------------------------------------------------------------
// Light theme token overrides
// ---------------------------------------------------------------------------

const LIGHT_TOKEN = {
  ...SHARED_TOKEN,

  // Primary color — Catppuccin Latte Mauve (matches --ns-color-primary for light)
  colorPrimary: LATTE.mauve,
  colorPrimaryHover: LATTE.mauveHover,

  // Background colors
  colorBgContainer: '#ffffff', // Card/container backgrounds
  colorBgElevated: '#ffffff', // Popovers, dropdowns
  colorBgLayout: LATTE.base, // Page background
  colorBgSpotlight: LATTE.mantle,
  colorBgMask: 'rgba(0, 0, 0, 0.45)',

  // Text colors
  colorText: LATTE.text,
  colorTextSecondary: LATTE.subtext1,
  colorTextTertiary: LATTE.subtext0,
  colorTextQuaternary: LATTE.overlay0,

  // Border colors
  colorBorder: LATTE.surface0, // --ns-color-border for light
  colorBorderSecondary: 'rgba(0, 0, 0, 0.06)',

  // Semantic colors
  colorSuccess: LATTE.green,
  colorWarning: LATTE.peach,
  colorError: LATTE.red,
  colorInfo: LATTE.sky,

  // Link colors
  colorLink: LATTE.mauve,
  colorLinkHover: LATTE.mauveHover,
  colorLinkActive: '#6520c7', // --ns-color-primary-active for light

  // Fill colors
  colorFill: 'rgba(0, 0, 0, 0.08)',
  colorFillSecondary: 'rgba(0, 0, 0, 0.04)',
  colorFillTertiary: 'rgba(0, 0, 0, 0.03)',
  colorFillQuaternary: 'rgba(0, 0, 0, 0.02)',

  // Split line
  colorSplit: 'rgba(0, 0, 0, 0.06)',
} as const;

// ---------------------------------------------------------------------------
// Theme config factories
// ---------------------------------------------------------------------------

/**
 * Returns the Ant Design ThemeConfig for dark mode (Catppuccin Mocha).
 */
export function getAntdDarkTheme(): ThemeConfig {
  return {
    algorithm: theme.darkAlgorithm,
    token: DARK_TOKEN,
    cssVar: { prefix: 'ns' },
  };
}

/**
 * Returns the Ant Design ThemeConfig for light mode (Catppuccin Latte).
 */
export function getAntdLightTheme(): ThemeConfig {
  return {
    algorithm: theme.defaultAlgorithm,
    token: LIGHT_TOKEN,
    cssVar: { prefix: 'ns' },
  };
}

/**
 * Returns the appropriate Ant Design ThemeConfig based on the current theme mode.
 *
 * @param isDark - Whether the active theme is dark mode
 */
export function getAntdTheme(isDark: boolean): ThemeConfig {
  return isDark ? getAntdDarkTheme() : getAntdLightTheme();
}
