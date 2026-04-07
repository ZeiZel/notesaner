import type { Metadata } from 'next';
import { PluginsSettingsPage } from '@/pages/settings-plugins';

export const metadata: Metadata = {
  title: 'Plugins settings',
};

/**
 * Plugins settings route — thin wrapper that delegates to PluginsSettingsPage composition.
 */
export default function PluginsSettingsRoute() {
  return <PluginsSettingsPage />;
}
