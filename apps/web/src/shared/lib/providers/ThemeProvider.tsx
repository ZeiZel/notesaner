'use client';

import { type ReactNode, useEffect } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: Theme;
}

/**
 * Manages the data-theme attribute on <html> for the Notesaner token system.
 *
 * The tokens.css file uses:
 *   :root                = dark theme (default)
 *   [data-theme="light"] = light theme overrides
 *
 * ThemeProvider resolves 'system' to 'dark' or 'light' at runtime.
 *
 * Theme preference is stored in localStorage under 'notesaner-theme'.
 */
export function ThemeProvider({ children, defaultTheme = 'dark' }: ThemeProviderProps) {
  useEffect(() => {
    const stored = localStorage.getItem('notesaner-theme') as Theme | null;
    const theme = stored ?? defaultTheme;
    applyTheme(theme);
  }, [defaultTheme]);

  return <>{children}</>;
}

function applyTheme(theme: Theme): void {
  const html = document.documentElement;

  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    html.setAttribute('data-theme', theme);
  }
}

/**
 * Hook to change the active theme.
 */
export function useTheme() {
  function setTheme(theme: Theme): void {
    localStorage.setItem('notesaner-theme', theme);
    applyTheme(theme);
  }

  function getTheme(): Theme {
    return (localStorage.getItem('notesaner-theme') as Theme | null) ?? 'dark';
  }

  return { setTheme, getTheme };
}
