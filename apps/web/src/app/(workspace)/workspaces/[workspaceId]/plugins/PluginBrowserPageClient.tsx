'use client';

/**
 * PluginBrowserPageClient — dynamically imports the PluginBrowser component.
 *
 * The plugin browser is a large feature with grid layout, modals, search,
 * and filtering. Dynamic import keeps it out of the initial JS bundle.
 */

import dynamic from 'next/dynamic';
import { PluginBrowserSkeleton } from '@/shared/lib/skeletons';
import { ErrorBoundary } from '@/shared/lib/ErrorBoundary';

const PluginBrowser = dynamic(
  () =>
    import('@/features/plugins/PluginBrowser').then((m) => ({
      default: m.PluginBrowser,
    })),
  {
    ssr: false,
    loading: () => <PluginBrowserSkeleton />,
  },
);

interface PluginBrowserPageClientProps {
  workspaceId: string;
}

export function PluginBrowserPageClient({ workspaceId }: PluginBrowserPageClientProps) {
  // In production, the access token comes from the auth store/session.
  // For now, pass a placeholder that the PluginBrowser will use.
  return (
    <ErrorBoundary moduleName="Plugin Browser" remountOnRetry>
      <PluginBrowser accessToken="" workspaceId={workspaceId} />
    </ErrorBoundary>
  );
}
