'use client';

/**
 * ThemeSettingsTab -- theme settings inside the settings modal.
 *
 * Renders a compact three-way ThemeToggle (Ant Design Segmented) at the top
 * followed by the full ThemeSettings panel (theme gallery + custom CSS).
 *
 * ThemeSettings and ThemeToggle both read/write through the shared
 * theme-store / ThemeProvider context -- no additional wiring needed.
 */

import { Typography } from 'antd';
import { Box } from '@/shared/ui';
import { ThemeSettings } from '@/shared/lib/theme/ThemeSettings';
import { ThemeToggle } from './ThemeToggle';

export function ThemeSettingsTab() {
  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Quick mode switch */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
          Color mode
        </Typography.Text>
        <ThemeToggle variant="full" size="middle" />
      </Box>

      {/* Full theme gallery + custom CSS */}
      <ThemeSettings />
    </Box>
  );
}
