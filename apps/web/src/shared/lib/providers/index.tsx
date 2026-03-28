'use client';

import { type ReactNode } from 'react';
import { AntdProvider } from '@/shared/config/antd-provider';
import { QueryProvider } from './QueryProvider';
import { ThemeProvider } from './ThemeProvider';

interface ProvidersProps {
  children: ReactNode;
}

/**
 * Root provider composition. Wraps the application with all global providers.
 *
 * Order matters:
 * 1. ThemeProvider — applies data-theme attribute and CSS variables immediately
 * 2. AntdProvider — reads resolved theme and applies Ant Design ConfigProvider
 * 3. QueryProvider — provides TanStack Query context (may depend on auth)
 */
export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider defaultTheme="dark">
      <AntdProvider>
        <QueryProvider>{children}</QueryProvider>
      </AntdProvider>
    </ThemeProvider>
  );
}

export { QueryProvider } from './QueryProvider';
export { ThemeProvider, useTheme } from './ThemeProvider';
export { KeyboardShortcutsProvider } from './KeyboardShortcutsProvider';
