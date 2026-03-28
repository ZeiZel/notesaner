import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Workspaces',
};

/**
 * Workspace picker page.
 * Shown when no workspace is selected or when navigating to /workspaces.
 */
export default function WorkspacesPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">Your Workspaces</h1>
        <p className="mt-2 text-sm text-foreground-secondary">
          Select a workspace to continue, or create a new one.
        </p>
      </div>

      {/* Workspace grid placeholder */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
        {/* Create new workspace card */}
        <button className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border p-8 text-center transition-colors hover:border-primary hover:bg-primary-muted">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-muted">
            <svg
              viewBox="0 0 24 24"
              className="h-5 w-5 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">New workspace</p>
            <p className="text-xs text-foreground-muted">Create a fresh knowledge base</p>
          </div>
        </button>
      </div>
    </div>
  );
}
