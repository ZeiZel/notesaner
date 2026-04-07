import type { Metadata } from 'next';
import { DangerZonePage } from '@/pages/settings-danger';

export const metadata: Metadata = {
  title: 'Danger zone',
};

/**
 * Danger zone route — thin wrapper that delegates to DangerZonePage composition.
 */
export default function DangerZoneRoute() {
  return <DangerZonePage />;
}
