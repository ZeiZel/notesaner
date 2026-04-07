import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PluginBrowserSkeleton } from '@/shared/ui/skeletons';
import { PluginBrowserPage } from '@/pages/plugin-browser';

export const metadata: Metadata = {
  title: 'Plugin browser',
};

interface PluginBrowserRouteProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Plugin browser route — thin wrapper that delegates to PluginBrowserPage composition.
 */
export default async function PluginBrowserRoute({ params }: PluginBrowserRouteProps) {
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
          <PluginBrowserPage workspaceId={workspaceId} />
        </Suspense>
      </div>
    </div>
  );
}
