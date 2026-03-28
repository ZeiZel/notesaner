import type { Metadata } from 'next';
import { AppearanceSettingsPage } from '@/pages/settings-appearance';

export const metadata: Metadata = {
  title: 'Appearance settings',
};

/**
 * Appearance settings route — thin wrapper that delegates to AppearanceSettingsPage composition.
 */
export default function AppearanceSettingsRoute() {
  return <AppearanceSettingsPage />;
}
