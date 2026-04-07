import type { Metadata } from 'next';

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

export async function generateMetadata({ params }: WorkspacePageProps): Promise<Metadata> {
  const { workspaceId } = await params;
  return {
    title: `Workspace ${workspaceId}`,
  };
}

/**
 * Workspace home page — shown when no note is selected.
 * Displays a welcome state with recent notes and quick actions.
 */
export default async function WorkspaceHomePage({ params }: WorkspacePageProps) {
  const { workspaceId } = await params;

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Welcome to your workspace</h1>
        <p className="mt-2 text-sm text-foreground-secondary">
          Workspace ID:{' '}
          <code className="rounded bg-background-elevated px-1 py-0.5 font-mono text-xs text-primary">
            {workspaceId}
          </code>
        </p>
        <p className="mt-1 text-sm text-foreground-secondary">
          Select a note from the sidebar to get started.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          New note
        </button>
        <button className="flex items-center gap-2 rounded-md border border-border bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary-hover">
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
            <path d="M10.68 11.74a6 6 0 01-7.922-8.982 6 6 0 018.982 7.922l3.04 3.04a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215l-3.04-3.04zM11.5 7a4.499 4.499 0 11-8.997 0A4.499 4.499 0 0111.5 7z" />
          </svg>
          Search notes
        </button>
      </div>
    </div>
  );
}
