'use client';

/**
 * PublicThemeProvider.tsx
 *
 * Context provider that injects public-vault theme CSS variables and custom
 * CSS into public pages.
 *
 * Responsibilities:
 *   1. Listen to the public theme store (selectedTheme, fontFamily, fontSize,
 *      maxWidth, customCss, isPreviewMode).
 *   2. Inject a <style> tag into <head> with:
 *      a. Theme CSS custom properties (:root { --pub-color-* })
 *      b. Typography CSS custom properties (:root { --pub-font-* })
 *      c. Sanitized custom CSS snippet
 *   3. Apply data-pub-theme attribute on <html> so downstream CSS can target
 *      [data-pub-theme="dark"] etc. for non-variable overrides.
 *   4. Set color-scheme on <html> to match isDark.
 *
 * Security:
 *   Custom CSS is sanitized via sanitizeCustomCss() before injection.
 *   The sanitizer removes lines matching known CSS injection patterns.
 *   CSP on the public pages provides the primary protection layer.
 *
 * Usage:
 *   Wrap public vault pages with <PublicThemeProvider> near the root.
 *   On private (admin) pages, pass initialSettings to override the store for
 *   preview rendering without affecting the real localStorage.
 */

import { createContext, useContext, useEffect, useId, useRef, type ReactNode } from 'react';
import {
  findPublicThemeById,
  generateThemeCssVars,
  generateTypographyCssVars,
  sanitizeCustomCss,
  PUBLIC_BUILT_IN_THEMES,
  type PublicThemeId,
  type PublicFontFamily,
} from '../model/public-themes';
import { usePublicThemeStore } from '../model/public-theme-store';

// ---------------------------------------------------------------------------
// Context type
// ---------------------------------------------------------------------------

export interface PublicThemeContextValue {
  /** Currently active theme ID. */
  themeId: PublicThemeId;
  /** Whether the active theme is a dark colour scheme. */
  isDark: boolean;
}

const PublicThemeContext = createContext<PublicThemeContextValue>({
  themeId: 'light',
  isDark: false,
});

// ---------------------------------------------------------------------------
// Provider props
// ---------------------------------------------------------------------------

export interface PublicThemeProviderProps {
  children: ReactNode;
  /**
   * Optional override settings. When provided, the provider uses these values
   * instead of the Zustand store. Useful for server-side rendering of public
   * pages where the store is not yet hydrated, or for isolated previewing.
   */
  initialSettings?: {
    selectedTheme?: PublicThemeId;
    fontFamily?: PublicFontFamily;
    customFontFamily?: string;
    fontSize?: number;
    maxWidth?: number;
    customCss?: string;
  };
}

// ---------------------------------------------------------------------------
// Provider component
// ---------------------------------------------------------------------------

export function PublicThemeProvider({ children, initialSettings }: PublicThemeProviderProps) {
  const styleId = useId();
  const styleRef = useRef<HTMLStyleElement | null>(null);

  // Read from store (these will be ignored when initialSettings overrides fully).
  const storeTheme = usePublicThemeStore((s) => s.selectedTheme);
  const storeFontFamily = usePublicThemeStore((s) => s.fontFamily);
  const storeCustomFontFamily = usePublicThemeStore((s) => s.customFontFamily);
  const storeFontSize = usePublicThemeStore((s) => s.fontSize);
  const storeMaxWidth = usePublicThemeStore((s) => s.maxWidth);
  const storeCustomCss = usePublicThemeStore((s) => s.customCss);

  // Resolve effective values: initialSettings wins over store.
  const themeId = initialSettings?.selectedTheme ?? storeTheme;
  const fontFamily = initialSettings?.fontFamily ?? storeFontFamily;
  const customFontFamily = initialSettings?.customFontFamily ?? storeCustomFontFamily;
  const fontSize = initialSettings?.fontSize ?? storeFontSize;
  const maxWidth = initialSettings?.maxWidth ?? storeMaxWidth;
  const rawCustomCss = initialSettings?.customCss ?? storeCustomCss;

  const theme = findPublicThemeById(themeId);
  const resolvedTheme = theme ?? findPublicThemeById('light') ?? PUBLIC_BUILT_IN_THEMES[0];
  const { isDark } = resolvedTheme;

  // Build the CSS string to inject.
  const cssContent = buildInjectedCss({
    theme: resolvedTheme,
    fontFamily,
    customFontFamily,
    fontSize,
    maxWidth,
    customCss: rawCustomCss,
  });

  useEffect(() => {
    // Create or reuse the managed <style> element.
    let styleEl = document.getElementById(`pub-theme-${styleId}`) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = `pub-theme-${styleId}`;
      document.head.appendChild(styleEl);
    }

    styleRef.current = styleEl;
    styleEl.textContent = cssContent;

    // Apply the data-pub-theme attribute and color-scheme on <html>.
    const html = document.documentElement;
    html.setAttribute('data-pub-theme', resolvedTheme.id);
    html.style.colorScheme = isDark ? 'dark' : 'light';

    return () => {
      // Cleanup on unmount.
      styleEl?.remove();
      html.removeAttribute('data-pub-theme');
      html.style.removeProperty('color-scheme');
    };
  }, [cssContent, resolvedTheme.id, isDark, styleId]);

  return (
    <PublicThemeContext.Provider value={{ themeId: resolvedTheme.id, isDark }}>
      {children}
    </PublicThemeContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// usePublicTheme hook
// ---------------------------------------------------------------------------

/**
 * Access the active public theme context.
 * Must be used within a <PublicThemeProvider> tree.
 */
export function usePublicTheme(): PublicThemeContextValue {
  return useContext(PublicThemeContext);
}

// ---------------------------------------------------------------------------
// Internal CSS builder
// ---------------------------------------------------------------------------

interface CssBuilderOptions {
  theme: ReturnType<typeof findPublicThemeById> & object;
  fontFamily: PublicFontFamily;
  customFontFamily: string;
  fontSize: number;
  maxWidth: number;
  customCss: string;
}

function buildInjectedCss(options: CssBuilderOptions): string {
  const { theme, fontFamily, customFontFamily, fontSize, maxWidth, customCss } = options;

  if (!theme) return '';

  const themeVars = generateThemeCssVars(theme);
  const typographyVars = generateTypographyCssVars({
    fontFamily,
    customFontFamily,
    fontSize,
    maxWidth,
  });

  const sanitizedCustom = sanitizeCustomCss(customCss);

  const parts = ['/* Notesaner public vault theme — generated */', themeVars, typographyVars];

  if (sanitizedCustom.trim()) {
    parts.push('/* Custom CSS */', sanitizedCustom);
  }

  return parts.join('\n\n');
}
