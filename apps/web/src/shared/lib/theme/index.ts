/**
 * Theme system public API
 *
 * Usage:
 *   import { useTheme, ThemeToggle, ThemeSettings } from '@/shared/lib/theme';
 */

export { ThemeProvider, useTheme } from './theme-provider';
export { useThemeStore } from './theme-store';
export { ThemeToggle } from './ThemeToggle';
export { ThemeSettings } from './ThemeSettings';
export {
  BUILT_IN_THEMES,
  themeDark,
  themeLight,
  themeAyuDark,
  themeNord,
  themeSolarizedDark,
  themeDracula,
  THEME_STORAGE_KEY,
  CUSTOM_CSS_STORAGE_KEY,
  COMMUNITY_THEMES_STORAGE_KEY,
} from './themes';
export type { Theme, ThemeColors, ThemeMode, ThemePreference, CommunityTheme } from './themes';

// Theme engine (imperative DOM helpers)
export {
  applyThemeToDocument,
  clearInlineThemeVars,
  applyAccentColorOverride,
  applyFontOverrides,
  injectCustomCss,
  removeCustomCss,
  triggerThemeTransition,
  generateAccentPalette,
  hexToRgb,
  rgbToHex,
  lightenColor,
  darkenColor,
  withAlpha,
  isColorDark,
  ACCENT_COLOR_PRESETS,
  UI_FONT_PRESETS,
} from './theme-engine';
export type { FontOverrides, FontPreset } from './theme-engine';
