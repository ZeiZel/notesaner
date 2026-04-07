import { redirect } from 'next/navigation';

interface SettingsPageProps {
  params: Promise<{ workspaceId: string }>;
}

/**
 * Settings root — redirects to general settings.
 */
export default async function SettingsPage({ params }: SettingsPageProps) {
  const { workspaceId } = await params;
  redirect(`/workspaces/${workspaceId}/settings/general`);
}
