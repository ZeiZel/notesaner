'use client';

import type { ReactNode } from 'react';
import { SettingsLayout } from '@/widgets/settings-layout';

interface SettingsLayoutRouteProps {
  children: ReactNode;
}

/**
 * Settings route layout — thin wrapper that delegates to SettingsLayout widget.
 */
export default function SettingsLayoutRoute({ children }: SettingsLayoutRouteProps) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
