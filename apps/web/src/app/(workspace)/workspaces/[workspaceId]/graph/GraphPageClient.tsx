'use client';

/**
 * GraphPageClient — client wrapper that dynamically imports the graph canvas.
 *
 * The graph view is one of the heaviest features (D3/WebGL force simulation,
 * SVG rendering). By using next/dynamic, the graph chunk is only downloaded
 * when the user navigates to /workspaces/:id/graph.
 */

import dynamic from 'next/dynamic';
import { GraphSkeleton } from '@/shared/lib/skeletons';
import { ErrorBoundary } from '@/shared/lib/ErrorBoundary';

const LocalGraphPanel = dynamic(
  () =>
    import('@/features/workspace/panels/LocalGraphPanel').then((m) => ({
      default: m.LocalGraphPanel,
    })),
  {
    ssr: false,
    loading: () => <GraphSkeleton />,
  },
);

interface GraphPageClientProps {
  workspaceId: string;
}

export function GraphPageClient({ workspaceId }: GraphPageClientProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Graph toolbar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <h1 className="text-sm font-semibold text-foreground">Graph view</h1>
        <div className="flex items-center gap-2 text-xs text-foreground-secondary">
          <span>workspace: {workspaceId}</span>
        </div>
      </div>

      {/* Graph canvas — dynamically imported, isolated by error boundary */}
      <div className="flex-1 bg-background">
        <ErrorBoundary moduleName="Graph View" remountOnRetry>
          <LocalGraphPanel />
        </ErrorBoundary>
      </div>
    </div>
  );
}
