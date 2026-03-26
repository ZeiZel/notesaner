import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Plugin browser',
};

interface PluginBrowserPageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Plugin marketplace/browser page.
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

      <div className="flex flex-1 items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-foreground-secondary">
            Plugin marketplace will render here.
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            workspace: {workspaceId}
          </p>
          <p className="mt-1 text-xs text-foreground-muted">
            (features/plugins/ui/PluginBrowser.tsx)
          </p>
        </div>
      </div>
    </div>
  );
}
