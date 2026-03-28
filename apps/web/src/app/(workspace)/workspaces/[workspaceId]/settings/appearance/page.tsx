import type { Metadata } from 'next';
import { AppearanceSettingsClient } from './AppearanceSettingsClient';

export const metadata: Metadata = {
  title: 'Appearance settings',
};

/**
 * Appearance settings page — theme, CSS snippets, sidebar defaults.
 * Server component that renders the client-side AppearanceSettings.
 */
export default function AppearanceSettingsPage() {
  return <AppearanceSettingsClient />;
}
