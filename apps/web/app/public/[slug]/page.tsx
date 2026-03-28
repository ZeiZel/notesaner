import { notFound } from 'next/navigation';
import { getVaultIndex, getAllPublishedNotes } from '@/features/publish';

// ---------------------------------------------------------------------------
// ISR: revalidate every 5 minutes
// ---------------------------------------------------------------------------
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicVaultPageProps {
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/**
 * Public vault index page.
 *
 * Displays vault metadata (name, description, note count) and a
 * list of published notes as entry points for readers.
 *
 * Rendered as a Server Component with ISR.
 */
export default async function PublicVaultPage({ params }: PublicVaultPageProps) {
  const { slug } = await params;

  const [vault, notes] = await Promise.all([getVaultIndex(slug), getAllPublishedNotes(slug)]);

  if (!vault) {
    notFound();
  }

  return (
    <div>
      {/* Vault header */}
      <header className="mb-8 border-b border-border pb-6">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">{vault.name}</h1>
        {vault.description && (
          <p className="mt-3 text-base text-foreground-secondary leading-relaxed">
            {vault.description}
          </p>
        )}
        <p className="mt-2 text-sm text-foreground-muted">
          {vault.publishedNoteCount} published {vault.publishedNoteCount === 1 ? 'note' : 'notes'}
        </p>
      </header>

      {/* Published notes list */}
      {notes.length > 0 ? (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-foreground">Published Notes</h2>
          <ul className="space-y-2">
            {notes.map((note) => {
              const pathWithoutExt = note.path.replace(/\.md$/, '');
              const displayPath = note.path
                .replace(/\.md$/, '')
                .split('/')
                .map((s) => decodeURIComponent(s))
                .join(' / ');

              return (
                <li key={note.id}>
                  <a
                    href={`/public/${encodeURIComponent(slug)}/${pathWithoutExt}`}
                    className="group flex items-start gap-3 rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-accent/50"
                  >
                    {/* Note icon */}
                    <svg
                      viewBox="0 0 16 16"
                      className="mt-0.5 h-4 w-4 shrink-0 text-foreground-muted group-hover:text-primary"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h5.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 14 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 14.5v-13Zm1.5-.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4.414L10.586 2H5.5Z" />
                    </svg>

                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground group-hover:text-primary">
                        {note.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-foreground-muted">
                        {displayPath}
                      </span>
                    </div>

                    <time
                      dateTime={note.updatedAt}
                      className="shrink-0 text-xs text-foreground-muted"
                    >
                      {new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(
                        new Date(note.updatedAt),
                      )}
                    </time>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <p className="text-sm text-foreground-muted">
          No published notes yet. Notes will appear here once they are published.
        </p>
      )}
    </div>
  );
}
