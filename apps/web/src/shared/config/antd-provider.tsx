'use client';

/**
 * AntdProvider — Ant Design ConfigProvider wrapper for Notesaner.
 *
 * Reads the current theme mode from the ThemeProvider context and applies
 * the matching Ant Design theme configuration (dark/light). This ensures
 * antd components visually align with the Catppuccin-based design system.
 *
 * This component must be rendered INSIDE ThemeProvider so it can access
 * the resolved theme via the useTheme hook.
 */

import { ConfigProvider } from 'antd';
import { type ReactNode, useMemo } from 'react';
import { useTheme } from '@/shared/lib/theme';
import { getAntdTheme } from './antd-theme';

interface AntdProviderProps {
  children: ReactNode;
}

export function AntdProvider({ children }: AntdProviderProps) {
  const { activeTheme } = useTheme();

  const themeConfig = useMemo(() => getAntdTheme(activeTheme.isDark), [activeTheme.isDark]);

  return <ConfigProvider theme={themeConfig}>{children}</ConfigProvider>;
}
