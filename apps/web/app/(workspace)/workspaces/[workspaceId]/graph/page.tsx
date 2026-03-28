import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GraphSkeleton } from '@/shared/ui/skeletons';
import { GraphPage } from '@/pages/graph';

interface GraphRouteProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = {
  title: 'Graph view',
};

/**
 * Graph view route — thin wrapper that delegates to GraphPage composition.
 */
export default async function GraphRoute({ params }: GraphRouteProps) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<GraphSkeleton />}>
      <GraphPage workspaceId={workspaceId} />
    </Suspense>
  );
}
