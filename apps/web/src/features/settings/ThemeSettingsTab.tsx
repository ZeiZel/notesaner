'use client';

/**
 * ThemeSettingsTab — thin wrapper that renders the existing ThemeSettings
 * component inside the settings modal.
 *
 * ThemeSettings already owns all state through theme-store.ts and the
 * useTheme() context — no additional wiring needed here.
 */

import { ThemeSettings } from '@/shared/lib/theme/ThemeSettings';

export function ThemeSettingsTab() {
  return <ThemeSettings />;
}
