import Link from 'next/link';

/**
 * Global 404 page.
 *
 * Provides helpful navigation options: go home, search, or report a broken link.
 * Server Component — no 'use client' needed.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="max-w-md text-center">
        <p className="text-8xl font-extrabold text-primary opacity-20">404</p>

        <h1 className="mt-4 text-2xl font-bold text-foreground">Page not found</h1>

        <p className="mt-2 text-sm text-foreground-secondary">
          The page you are looking for does not exist or may have been moved.
        </p>

        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Go home
          </Link>

          <Link
            href="/workspaces"
            className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            My workspaces
          </Link>
        </div>

        <p className="mt-6 text-xs text-foreground-muted">
          If you followed a link to get here, please{' '}
          <a
            href="https://github.com/notesaner/notesaner/issues/new?title=Broken+link&body=I+found+a+broken+link+on+the+site."
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary-hover"
          >
            report the broken link
          </a>
          .
        </p>
      </div>
    </div>
  );
}
