import Link from 'next/link';

/**
 * Global 404 page.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="text-center">
        <p className="text-8xl font-extrabold text-primary opacity-20">404</p>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Page not found</h1>
        <p className="mt-2 text-sm text-foreground-secondary">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
