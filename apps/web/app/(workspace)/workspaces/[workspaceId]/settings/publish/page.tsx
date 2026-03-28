import type { Metadata } from 'next';
import { PublishSettingsPage } from '@/pages/settings-publish';

export const metadata: Metadata = {
  title: 'Publish settings',
};

/**
 * Publish settings route — thin wrapper that delegates to PublishSettingsPage composition.
 */
export default function PublishSettingsRoute() {
  return <PublishSettingsPage />;
}
