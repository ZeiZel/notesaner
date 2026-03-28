import type { Metadata } from 'next';
import { Suspense } from 'react';
import { GraphSkeleton } from '@/shared/lib/skeletons';
import { GraphPageClient } from './GraphPageClient';

interface GraphPageProps {
  params: Promise<{ workspaceId: string }>;
}

export const metadata: Metadata = {
  title: 'Graph view',
};

/**
 * Full-screen graph view page.
 *
 * The actual graph canvas is heavy (WebGL/SVG, force simulation) so it
 * is dynamically imported in GraphPageClient. The Server Component wrapper
 * streams the skeleton immediately.
 */
export default async function GraphPage({ params }: GraphPageProps) {
  const { workspaceId } = await params;

  return (
    <Suspense fallback={<GraphSkeleton />}>
      <GraphPageClient workspaceId={workspaceId} />
    </Suspense>
  );
}
