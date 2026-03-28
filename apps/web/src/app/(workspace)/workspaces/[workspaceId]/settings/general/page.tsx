import type { Metadata } from 'next';
import { GeneralSettingsClient } from './GeneralSettingsClient';

export const metadata: Metadata = {
  title: 'General settings',
};

/**
 * General workspace settings page.
 * Server component that renders the client-side GeneralSettings form.
 */
export default function GeneralSettingsPage() {
  return <GeneralSettingsClient />;
}
