/**
 * features/settings/model/theme-store.ts
 *
 * Feature-level re-export and typed interface for the theme store.
 *
 * The canonical store lives in shared/lib/theme/theme-store.ts.
 * This module re-exports the public API so feature code only imports
 * from within its own layer, per FSD rules.
 *
 * Resolves 'system' to 'light' | 'dark' using the live matchMedia value
 * so consumers outside ThemeProvider context can read the effective mode.
 */

export { useThemeStore } from '@/shared/lib/theme/theme-store';
export type { ThemePreference } from '@/shared/lib/theme/themes';

/**
 * Get the system preference ('dark' | 'light') at call time.
 * Safe to call in both browser and SSR (returns 'dark' on server).
 */
export function getSystemColorScheme(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve a ThemePreference (which may be 'system') to a concrete 'dark' | 'light' mode.
 * For custom theme ids the resolved value defaults to 'dark'.
 */
export function resolveThemeMode(preference: string): 'dark' | 'light' {
  if (preference === 'system') return getSystemColorScheme();
  if (preference === 'light') return 'light';
  return 'dark';
}
