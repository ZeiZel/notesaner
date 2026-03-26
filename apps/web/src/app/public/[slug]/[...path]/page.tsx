import type { Metadata } from 'next';

interface PublicNotePageProps {
  params: Promise<{ slug: string; path: string[] }>;
}

export async function generateMetadata({ params }: PublicNotePageProps): Promise<Metadata> {
  const { path } = await params;
  const noteName = path[path.length - 1] ?? 'Note';
  // Decode URL-encoded path segment and remove .md extension
  const title = decodeURIComponent(noteName).replace(/\.md$/, '');
  return { title };
}

/**
 * Public published note renderer.
 * Accepts a catch-all path to support nested folder structures.
 *
 * Rendered as SSG with ISR (revalidate on publish changes).
 */
export default async function PublicNotePage({ params }: PublicNotePageProps) {
  const { slug, path } = await params;
  const notePath = path.join('/');

  return (
    <article className="prose max-w-prose">
      <p className="text-xs text-foreground-muted">
        Published vault: {slug} / {notePath}
      </p>
      <div className="mt-6 text-foreground">
        <p className="text-foreground-secondary">
          The rendered note content will appear here.
          (features/publishing/ui/PublishedNoteView.tsx)
        </p>
      </div>
    </article>
  );
}
