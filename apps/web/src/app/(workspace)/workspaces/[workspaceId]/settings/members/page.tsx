import type { Metadata } from 'next';
import { MembersSettingsClient } from './MembersSettingsClient';

export const metadata: Metadata = {
  title: 'Members settings',
};

/**
 * Members management page — invite, role change, and remove.
 * Server component that renders the client-side MembersSettings.
 */
export default function MembersSettingsPage() {
  return <MembersSettingsClient />;
}
