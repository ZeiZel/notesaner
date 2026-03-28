import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PluginBrowserSkeleton } from '@/shared/lib/skeletons';
import { PluginBrowserPageClient } from './PluginBrowserPageClient';

export const metadata: Metadata = {
  title: 'Plugin browser',
};

interface PluginBrowserPageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Plugin marketplace/browser page.
 *
 * The PluginBrowser component (grid, modals, search, filters) is heavy.
 * It is dynamically imported in the client wrapper to reduce initial JS.
 */
export default async function PluginBrowserPage({ params }: PluginBrowserPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-6">
        <h1 className="text-xl font-bold text-foreground">Plugin browser</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Discover and install plugins to extend your workspace.
        </p>
      </div>

      <div className="flex-1 overflow-hidden">
        <Suspense fallback={<PluginBrowserSkeleton />}>
          <PluginBrowserPageClient workspaceId={workspaceId} />
        </Suspense>
      </div>
    </div>
  );
}
