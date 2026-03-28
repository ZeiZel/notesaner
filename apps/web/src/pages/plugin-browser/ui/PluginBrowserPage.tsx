'use client';

/**
 * PluginBrowserPage — dynamically imports the PluginBrowser component.
 *
 * The plugin browser is a large feature with grid layout, modals, search,
 * and filtering. Dynamic import keeps it out of the initial JS bundle.
 */

import dynamic from 'next/dynamic';
import { PluginBrowserSkeleton } from '@/shared/ui/skeletons';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';

const PluginBrowser = dynamic(
  () =>
    import('@/features/plugins/ui/PluginBrowser').then((m) => ({
      default: m.PluginBrowser,
    })),
  {
    ssr: false,
    loading: () => <PluginBrowserSkeleton />,
  },
);

interface PluginBrowserPageProps {
  workspaceId: string;
}

export function PluginBrowserPage({ workspaceId }: PluginBrowserPageProps) {
  // In production, the access token comes from the auth store/session.
  // For now, pass a placeholder that the PluginBrowser will use.
  return (
    <ErrorBoundary moduleName="Plugin Browser" remountOnRetry>
      <PluginBrowser accessToken="" workspaceId={workspaceId} />
    </ErrorBoundary>
  );
}
