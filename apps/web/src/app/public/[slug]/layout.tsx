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
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-wide items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-foreground">Notesaner</span>
          <a
            href="/"
            className="text-xs text-foreground-secondary transition-colors hover:text-primary"
          >
            Open in app
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-wide px-4 py-8">{children}</div>
    </div>
  );
}
