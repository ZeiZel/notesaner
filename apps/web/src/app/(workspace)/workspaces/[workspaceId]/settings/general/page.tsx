import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'General settings',
};

interface GeneralSettingsPageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * General workspace settings page.
 */
export default async function GeneralSettingsPage({ params }: GeneralSettingsPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="p-6">
      <h2 className="text-xl font-bold text-foreground">General</h2>
      <p className="mt-1 text-sm text-foreground-secondary">
        Workspace name, description, and basic settings.
      </p>
      <p className="mt-4 text-xs text-foreground-muted">workspace: {workspaceId}</p>

      {/* Placeholder for GeneralSettings feature component */}
      <div className="mt-6 rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-foreground-secondary">
          General settings form will render here.
          (features/settings/ui/GeneralSettings.tsx)
        </p>
      </div>
    </div>
  );
}
