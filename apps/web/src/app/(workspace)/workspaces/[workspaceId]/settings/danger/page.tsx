import type { Metadata } from 'next';
import { DangerZoneClient } from './DangerZoneClient';

export const metadata: Metadata = {
  title: 'Danger zone',
};

/**
 * Danger zone page — transfer ownership, delete workspace.
 * Server component that renders the client-side DangerZone.
 */
export default function DangerZonePage() {
  return <DangerZoneClient />;
}
