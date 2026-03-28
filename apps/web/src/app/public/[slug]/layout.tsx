import type { Metadata } from 'next';
import type { ReactNode } from 'react';

interface PublicVaultLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicVaultLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  return {
    title: {
      default: slug,
      template: `%s — ${slug}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

/**
 * Public published vault layout.
 * No authentication required. Rendered with ISR/SSG.
 */
export default function PublicVaultLayout({ children }: Omit<PublicVaultLayoutProps, 'params'>) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Minimal public navigation */}
      <header
        role="banner"
        className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm"
      >
        <nav
          aria-label="Public vault navigation"
          className="mx-auto flex max-w-wide items-center justify-between px-4 py-3"
        >
          <span className="text-sm font-semibold text-foreground">Notesaner</span>
          <a
            href="/"
            className="text-xs text-foreground-secondary transition-colors hover:text-primary"
          >
            Open in app
          </a>
        </nav>
      </header>

      <main id="main-content" tabIndex={-1} className="mx-auto max-w-wide px-4 py-8">
        {children}
      </main>

      <footer role="contentinfo" className="sr-only">
        <p>Notesaner published vault</p>
      </footer>
    </div>
  );
}
