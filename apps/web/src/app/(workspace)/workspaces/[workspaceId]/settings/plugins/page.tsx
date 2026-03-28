import type { Metadata } from 'next';
import { PluginsSettingsClient } from './PluginsSettingsClient';

export const metadata: Metadata = {
  title: 'Plugins settings',
};

/**
 * Plugins management page — enable/disable, settings, install.
 * Server component that renders the client-side PluginsSettings.
 */
export default function PluginsSettingsPage() {
  return <PluginsSettingsClient />;
}
