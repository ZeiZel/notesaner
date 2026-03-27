'use client';

/**
 * Re-exports the ThemeProvider and useTheme hook from the theme module.
 *
 * This file exists for backwards compatibility — the Providers composition
 * (providers/index.tsx) imports from here so callers that import
 * from '@/shared/lib/providers' continue to work.
 */

export { ThemeProvider, useTheme } from '../theme';
