import type { Metadata } from 'next';
import { GeneralSettingsPage } from '@/pages/settings-general';

export const metadata: Metadata = {
  title: 'General settings',
};

/**
 * General settings route — thin wrapper that delegates to GeneralSettingsPage composition.
 */
export default function GeneralSettingsRoute() {
  return <GeneralSettingsPage />;
}
