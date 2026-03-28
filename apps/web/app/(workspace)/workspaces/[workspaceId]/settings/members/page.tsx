import type { Metadata } from 'next';
import { MembersSettingsPage } from '@/pages/settings-members';

export const metadata: Metadata = {
  title: 'Members settings',
};

/**
 * Members settings route — thin wrapper that delegates to MembersSettingsPage composition.
 */
export default function MembersSettingsRoute() {
  return <MembersSettingsPage />;
}
