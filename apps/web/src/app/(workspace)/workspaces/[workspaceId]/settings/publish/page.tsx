import type { Metadata } from 'next';
import { PublishSettingsClient } from './PublishSettingsClient';

export const metadata: Metadata = {
  title: 'Publish settings',
};

/**
 * Publish settings page — public vault toggle, published notes, custom domain.
 * Server component that renders the client-side PublishSettings.
 */
export default function PublishSettingsPage() {
  return <PublishSettingsClient />;
}
