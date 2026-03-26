import type { Metadata } from 'next';

interface GraphPageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = {
  title: 'Graph view',
};

/**
 * Full-screen graph view page.
 * Renders the knowledge graph for the current workspace.
 */
export default async function GraphPage({ params }: GraphPageProps) {
  const { workspaceId } = await params;

  return (
    <div className="flex h-full flex-col">
      {/* Graph toolbar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">Graph view</h1>
        <div className="flex items-center gap-2 text-xs text-foreground-secondary">
          <span>workspace: {workspaceId}</span>
        </div>
      </div>

      {/* Graph canvas placeholder */}
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary-muted">
            <svg
              viewBox="0 0 24 24"
              className="h-8 w-8 text-primary"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden="true"
            >
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="5" r="2" />
              <circle cx="19" cy="12" r="2" />
              <circle cx="12" cy="19" r="2" />
              <path strokeLinecap="round" d="M7 12h3M14 12h3M12 7v3M12 14v3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-foreground">Graph view</p>
          <p className="mt-1 text-xs text-foreground-secondary">
            The knowledge graph will render here using WebGL/SVG canvas.
          </p>
          <p className="mt-0.5 text-xs text-foreground-muted">
            (widgets/graph-panel/GraphCanvas.tsx)
          </p>
        </div>
      </div>
    </div>
  );
}
