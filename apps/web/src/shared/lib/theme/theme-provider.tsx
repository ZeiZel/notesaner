'use client';

/**
 * ThemeProvider — applies the active theme to the document.
 *
 * Responsibilities:
 *   1. Read the stored ThemePreference from the Zustand store
 *   2. Resolve 'system' to 'dark' or 'light' via matchMedia
 *   3. Apply CSS custom properties for the resolved theme on <html>
 *   4. Set the data-theme attribute for static CSS rules in tokens.css
 *   5. Inject the custom CSS snippet via a <style> element
 *   6. React to system preference changes in real time
 *
 * Why a context in addition to the Zustand store?
 *   The context exposes derived, read-only state (resolvedTheme, activeTheme)
 *   so consumers don't need to import the store or re-derive these values.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useThemeStore } from './theme-store';
import { BUILT_IN_THEMES, themeDark, type Theme, type ThemePreference } from './themes';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface ThemeContextValue {
  /** Current user preference (may be 'system') */
  preference: ThemePreference;
  /** Resolved concrete theme (never 'system') */
  resolvedTheme: 'dark' | 'light' | string;
  /** The full Theme object that is currently active */
  activeTheme: Theme;
  /** All available themes (built-in + community) */
  availableThemes: Theme[];
  /** Change the theme preference */
  setPreference: (preference: ThemePreference) => void;
  /** Current custom CSS snippet */
  customCss: string;
  /** Update and immediately apply the custom CSS snippet */
  setCustomCss: (css: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// System preference subscription (useSyncExternalStore)
// The subscribe/getSnapshot pattern avoids useEffect for external store sync.
// ---------------------------------------------------------------------------

function subscribeToSystemPreference(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

function getSystemPreferenceSnapshot(): boolean {
  if (typeof window === 'undefined') return true; // SSR: default dark
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function getServerSystemPreferenceSnapshot(): boolean {
  return true; // SSR: default to dark
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

const CUSTOM_CSS_STYLE_ID = 'notesaner-custom-css';

function applyThemeToDocument(theme: Theme): void {
  const html = document.documentElement;

  // 1. Set the data-theme attribute — used by static CSS in tokens.css for
  //    rules that cannot be expressed as inline CSS variables (e.g. color-scheme).
  //    For built-in themes we rely on the data-theme attribute and the CSS in
  //    tokens.css. For custom/community themes we also apply inline variables.
  html.setAttribute('data-theme', theme.id);

  // 2. Set color-scheme for native browser elements (scrollbars, inputs, etc.)
  html.style.colorScheme = theme.isDark ? 'dark' : 'light';

  // 3. Apply all --ns-* CSS custom properties inline.
  //    This makes community/custom themes work without any CSS file changes.
  for (const [key, value] of Object.entries(theme.colors)) {
    html.style.setProperty(`--ns-${key}`, value);
  }
}

/**
 * Remove all inline --ns-* properties that were applied by applyThemeToDocument.
 * This is called when switching back to a built-in theme so the CSS file rules
 * take precedence again (data-theme attribute is still set for those).
 */
function clearInlineThemeVars(): void {
  const html = document.documentElement;
  // Collect all --ns-color-* inline properties and remove them.
  // We need to snapshot the style because removing modifies the live object.
  const propsToRemove: string[] = [];
  for (let i = 0; i < html.style.length; i++) {
    const prop = html.style.item(i);
    if (prop.startsWith('--ns-color-')) {
      propsToRemove.push(prop);
    }
  }
  for (const prop of propsToRemove) {
    html.style.removeProperty(prop);
  }
}

function injectCustomCss(css: string): void {
  let styleEl = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = CUSTOM_CSS_STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = css;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme preference used before the store hydrates. */
  defaultTheme?: ThemePreference;
}

export function ThemeProvider({
  children,
  defaultTheme: _defaultTheme = 'dark',
}: ThemeProviderProps) {
  const preference = useThemeStore((s) => s.preference);
  const communityThemes = useThemeStore((s) => s.communityThemes);
  const customCss = useThemeStore((s) => s.customCss);
  const setPreferenceInStore = useThemeStore((s) => s.setPreference);
  const setCustomCssInStore = useThemeStore((s) => s.setCustomCss);

  // System preference tracked without an effect — useSyncExternalStore is the
  // correct pattern for subscribing to external non-React stores.
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemPreference,
    getSystemPreferenceSnapshot,
    getServerSystemPreferenceSnapshot,
  );

  // All available themes in one list
  const availableThemes = useMemo<Theme[]>(
    () => [...BUILT_IN_THEMES, ...communityThemes],
    [communityThemes],
  );

  // Resolve the preference to a concrete theme id
  const resolvedThemeId: string = useMemo(() => {
    if (preference === 'system') {
      return systemPrefersDark ? 'dark' : 'light';
    }
    return preference;
  }, [preference, systemPrefersDark]);

  // Look up the active Theme object
  const activeTheme: Theme = useMemo(() => {
    return availableThemes.find((t) => t.id === resolvedThemeId) ?? themeDark;
  }, [availableThemes, resolvedThemeId]);

  // Track previous theme id to know when it changes
  const prevThemeIdRef = useRef<string | null>(null);
  const isBuiltInTheme = (id: string) => ['dark', 'light'].includes(id);

  // Apply theme to DOM whenever activeTheme changes.
  // Also triggers the smooth 200ms transition animation via
  // the data-theme-transition attribute.
  useEffect(() => {
    const prevId = prevThemeIdRef.current;
    prevThemeIdRef.current = activeTheme.id;

    // If we are switching from a custom/community theme back to a built-in,
    // clear the inline CSS variables first so tokens.css takes over again.
    if (prevId !== null && !isBuiltInTheme(prevId) && isBuiltInTheme(activeTheme.id)) {
      clearInlineThemeVars();
    }

    // Enable smooth transition only when switching themes (not on initial load).
    // The data-theme-transition attribute is picked up by the CSS rule in main.css
    // which applies transition: 200ms to all color properties.
    if (prevId !== null && prevId !== activeTheme.id) {
      const html = document.documentElement;
      html.setAttribute('data-theme-transition', '');

      // Remove the transition attribute after the animation completes.
      // setTimeout matches the 200ms transition duration in CSS.
      setTimeout(() => {
        html.removeAttribute('data-theme-transition');
      }, 200);
    }

    applyThemeToDocument(activeTheme);
  }, [activeTheme]);

  // Apply custom CSS snippet whenever it changes
  useEffect(() => {
    injectCustomCss(customCss);
  }, [customCss]);

  const setPreference = useCallback(
    (pref: ThemePreference) => {
      setPreferenceInStore(pref);
    },
    [setPreferenceInStore],
  );

  const setCustomCss = useCallback(
    (css: string) => {
      setCustomCssInStore(css);
    },
    [setCustomCssInStore],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolvedTheme: resolvedThemeId,
      activeTheme,
      availableThemes,
      setPreference,
      customCss,
      setCustomCss,
    }),
    [
      preference,
      resolvedThemeId,
      activeTheme,
      availableThemes,
      setPreference,
      customCss,
      setCustomCss,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns the current theme context.
 * Must be used inside a ThemeProvider.
 */
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used inside <ThemeProvider>');
  }
  return ctx;
}
