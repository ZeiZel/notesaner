/**
 * theme-engine.ts — Engine to apply CSS custom properties and manage runtime theming.
 *
 * Centralizes all DOM manipulation for theme application:
 *   - Applies theme color tokens as --ns-* CSS custom properties on :root
 *   - Manages accent color overrides (recalculates primary/accent palette)
 *   - Applies font family and font size overrides
 *   - Manages the custom CSS <style> element injection
 *   - Handles theme transition animations
 *
 * This module is purely imperative (no React). The ThemeProvider orchestrates
 * calls to these functions based on reactive state changes.
 */

import type { Theme } from './themes';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CSS_VAR_PREFIX = '--ns-';
const CUSTOM_CSS_STYLE_ID = 'notesaner-custom-css';
const FONT_OVERRIDE_STYLE_ID = 'notesaner-font-override';
const ACCENT_OVERRIDE_STYLE_ID = 'notesaner-accent-override';
const TRANSITION_DURATION_MS = 200;

// ---------------------------------------------------------------------------
// Color utilities
// ---------------------------------------------------------------------------

/**
 * Parse a hex color to RGB components.
 * Supports #RGB, #RRGGBB, and #RRGGBBAA formats.
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length >= 6) {
    r = parseInt(cleaned.slice(0, 2), 16);
    g = parseInt(cleaned.slice(2, 4), 16);
    b = parseInt(cleaned.slice(4, 6), 16);
  } else {
    return null;
  }

  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return { r, g, b };
}

/**
 * Convert RGB components to a hex color string.
 */
export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return '#' + [clamp(r), clamp(g), clamp(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}

/**
 * Lighten a hex color by the given amount (0-1).
 */
export function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * amount,
    rgb.g + (255 - rgb.g) * amount,
    rgb.b + (255 - rgb.b) * amount,
  );
}

/**
 * Darken a hex color by the given amount (0-1).
 */
export function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return rgbToHex(rgb.r * (1 - amount), rgb.g * (1 - amount), rgb.b * (1 - amount));
}

/**
 * Create a color with alpha transparency as an rgba() value.
 */
export function withAlpha(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Determine whether a color is perceptually dark (for choosing foreground text).
 * Uses relative luminance formula from WCAG 2.0.
 */
export function isColorDark(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return true;
  // Relative luminance
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance < 0.5;
}

// ---------------------------------------------------------------------------
// Accent color palette generation
// ---------------------------------------------------------------------------

/**
 * Generate a full set of accent-related CSS custom properties from a single
 * base accent color. Produces hover, active, muted, and foreground variants.
 */
export function generateAccentPalette(accentHex: string, isDark: boolean): Record<string, string> {
  const foreground = isColorDark(accentHex) ? '#ffffff' : '#1e1e2e';

  return {
    [`${CSS_VAR_PREFIX}color-primary`]: accentHex,
    [`${CSS_VAR_PREFIX}color-primary-hover`]: isDark
      ? lightenColor(accentHex, 0.1)
      : darkenColor(accentHex, 0.1),
    [`${CSS_VAR_PREFIX}color-primary-active`]: isDark
      ? lightenColor(accentHex, 0.2)
      : darkenColor(accentHex, 0.2),
    [`${CSS_VAR_PREFIX}color-primary-muted`]: withAlpha(accentHex, 0.15),
    [`${CSS_VAR_PREFIX}color-primary-foreground`]: foreground,
    [`${CSS_VAR_PREFIX}color-ring`]: accentHex,
    [`${CSS_VAR_PREFIX}color-sidebar-ring`]: accentHex,
  };
}

// ---------------------------------------------------------------------------
// DOM manipulation: theme application
// ---------------------------------------------------------------------------

/**
 * Apply a Theme's color tokens as inline CSS custom properties on <html>.
 * Also sets `data-theme` and `color-scheme` for native element styling.
 */
export function applyThemeToDocument(theme: Theme): void {
  const html = document.documentElement;

  html.setAttribute('data-theme', theme.id);
  html.style.colorScheme = theme.isDark ? 'dark' : 'light';

  for (const [key, value] of Object.entries(theme.colors)) {
    html.style.setProperty(`${CSS_VAR_PREFIX}${key}`, value);
  }
}

/**
 * Remove all inline --ns-color-* properties from <html>.
 * Called when switching from a community/custom theme back to a built-in
 * theme so the CSS file rules take precedence.
 */
export function clearInlineThemeVars(): void {
  const html = document.documentElement;
  const propsToRemove: string[] = [];
  for (let i = 0; i < html.style.length; i++) {
    const prop = html.style.item(i);
    if (prop.startsWith(`${CSS_VAR_PREFIX}color-`)) {
      propsToRemove.push(prop);
    }
  }
  for (const prop of propsToRemove) {
    html.style.removeProperty(prop);
  }
}

/**
 * Apply accent color overrides via a dedicated <style> element.
 * Returns a cleanup function that removes the overrides.
 */
export function applyAccentColorOverride(accentHex: string | null, isDark: boolean): void {
  let styleEl = document.getElementById(ACCENT_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;

  if (!accentHex) {
    // Remove accent override
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = ACCENT_OVERRIDE_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const palette = generateAccentPalette(accentHex, isDark);
  const declarations = Object.entries(palette)
    .map(([prop, value]) => `  ${prop}: ${value};`)
    .join('\n');

  styleEl.textContent = `:root {\n${declarations}\n}`;
}

// ---------------------------------------------------------------------------
// DOM manipulation: font overrides
// ---------------------------------------------------------------------------

export interface FontOverrides {
  /** CSS font-family string (or null to use theme default) */
  fontFamily: string | null;
  /** UI font size in px (or null to use theme default) */
  uiFontSize: number | null;
}

/**
 * Apply font overrides via a dedicated <style> element.
 */
export function applyFontOverrides(overrides: FontOverrides): void {
  let styleEl = document.getElementById(FONT_OVERRIDE_STYLE_ID) as HTMLStyleElement | null;

  const hasOverrides = overrides.fontFamily !== null || overrides.uiFontSize !== null;

  if (!hasOverrides) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = FONT_OVERRIDE_STYLE_ID;
    document.head.appendChild(styleEl);
  }

  const declarations: string[] = [];
  if (overrides.fontFamily) {
    declarations.push(`  --ns-font-sans: ${overrides.fontFamily};`);
  }
  if (overrides.uiFontSize !== null) {
    declarations.push(`  font-size: ${overrides.uiFontSize}px;`);
  }

  styleEl.textContent = `:root {\n${declarations.join('\n')}\n}`;
}

// ---------------------------------------------------------------------------
// DOM manipulation: custom CSS
// ---------------------------------------------------------------------------

/**
 * Inject (or update) the user's custom CSS snippet via a <style> element.
 */
export function injectCustomCss(css: string): void {
  let styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_CSS_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

/**
 * Remove the custom CSS <style> element entirely.
 */
export function removeCustomCss(): void {
  document.getElementById(CUSTOM_CSS_STYLE_ID)?.remove();
}

// ---------------------------------------------------------------------------
// DOM manipulation: theme transition
// ---------------------------------------------------------------------------

/**
 * Trigger a smooth transition animation when switching themes.
 * Sets the `data-theme-transition` attribute on <html> for the duration
 * of the transition, which is picked up by the CSS rule in main.css.
 *
 * Returns a promise that resolves when the transition completes.
 */
export function triggerThemeTransition(): Promise<void> {
  const html = document.documentElement;
  html.setAttribute('data-theme-transition', '');

  return new Promise((resolve) => {
    setTimeout(() => {
      html.removeAttribute('data-theme-transition');
      resolve();
    }, TRANSITION_DURATION_MS);
  });
}

// ---------------------------------------------------------------------------
// Preset accent colors
// ---------------------------------------------------------------------------

/**
 * Curated accent colors that work well with both light and dark themes.
 */
export const ACCENT_COLOR_PRESETS: { label: string; hex: string }[] = [
  { label: 'Mauve', hex: '#cba6f7' },
  { label: 'Blue', hex: '#89b4fa' },
  { label: 'Sapphire', hex: '#74c7ec' },
  { label: 'Teal', hex: '#94e2d5' },
  { label: 'Green', hex: '#a6e3a1' },
  { label: 'Yellow', hex: '#f9e2af' },
  { label: 'Peach', hex: '#fab387' },
  { label: 'Pink', hex: '#f5c2e7' },
  { label: 'Red', hex: '#f38ba8' },
  { label: 'Flamingo', hex: '#f2cdcd' },
  { label: 'Lavender', hex: '#b4befe' },
  { label: 'Rosewater', hex: '#f5e0dc' },
];

// ---------------------------------------------------------------------------
// Font family presets
// ---------------------------------------------------------------------------

export interface FontPreset {
  id: string;
  label: string;
  cssValue: string;
}

export const UI_FONT_PRESETS: FontPreset[] = [
  {
    id: 'system',
    label: 'System default',
    cssValue: "system-ui, -apple-system, 'Segoe UI', sans-serif",
  },
  { id: 'inter', label: 'Inter', cssValue: "'Inter', system-ui, sans-serif" },
  { id: 'geist', label: 'Geist Sans', cssValue: "'Geist Sans', system-ui, sans-serif" },
  { id: 'source-sans', label: 'Source Sans 3', cssValue: "'Source Sans 3', system-ui, sans-serif" },
  { id: 'roboto', label: 'Roboto', cssValue: "'Roboto', system-ui, sans-serif" },
  { id: 'nunito', label: 'Nunito', cssValue: "'Nunito', system-ui, sans-serif" },
  { id: 'lato', label: 'Lato', cssValue: "'Lato', system-ui, sans-serif" },
];
