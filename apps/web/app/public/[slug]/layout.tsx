import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { getVaultIndex, getAllPublishedNotes, generateVaultMetadata } from '@/features/publish';
import { VaultNavigation } from '@/widgets/public-vault-shell/ui/VaultNavigation';

// ---------------------------------------------------------------------------
// ISR: revalidate every 5 minutes
// ---------------------------------------------------------------------------
export const revalidate = 300;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublicVaultLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata({ params }: PublicVaultLayoutProps): Promise<Metadata> {
  const { slug } = await params;
  const vault = await getVaultIndex(slug);

  if (!vault) {
    return {
      title: {
        default: slug,
        template: `%s - ${slug}`,
      },
      robots: { index: true, follow: true },
    };
  }

  return generateVaultMetadata({
    slug: vault.slug,
    name: vault.name,
    description: vault.description,
    noteCount: vault.publishedNoteCount,
  });
}

// ---------------------------------------------------------------------------
// Navigation tree builder
// ---------------------------------------------------------------------------

interface NavTreeNode {
  title: string;
  path: string;
  isFolder: boolean;
  children?: NavTreeNode[];
}

/**
 * Build a hierarchical navigation tree from a flat list of published notes.
 * Each note path like "guides/getting-started.md" becomes nested folder nodes.
 */
function buildNavTree(notes: Array<{ path: string; title: string }>): NavTreeNode[] {
  const root: NavTreeNode[] = [];
  const folderMap = new Map<string, NavTreeNode>();

  // Sort notes by path for consistent ordering
  const sorted = [...notes].sort((a, b) => a.path.localeCompare(b.path));

  for (const note of sorted) {
    const segments = note.path.split('/');

    // Ensure all ancestor folders exist
    let parentChildren = root;
    let accumulatedPath = '';

    for (let i = 0; i < segments.length - 1; i++) {
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${segments[i]}` : segments[i];

      let folder = folderMap.get(accumulatedPath);
      if (!folder) {
        folder = {
          title: segments[i],
          path: accumulatedPath,
          isFolder: true,
          children: [],
        };
        folderMap.set(accumulatedPath, folder);
        parentChildren.push(folder);
      }
      parentChildren = folder.children ?? [];
    }

    // Add the note itself
    parentChildren.push({
      title: note.title,
      path: note.path,
      isFolder: false,
    });
  }

  return root;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Public published vault layout.
 * No authentication required. Rendered with ISR (5-minute revalidation).
 *
 * Fetches vault metadata and published notes list on the server to build
 * the navigation sidebar. The sidebar is rendered as a Server Component
 * for SEO and initial load performance.
 */
export default async function PublicVaultLayout({ children, params }: PublicVaultLayoutProps) {
  const { slug } = await params;

  // Fetch vault data and note list in parallel
  const [vault, notes] = await Promise.all([getVaultIndex(slug), getAllPublishedNotes(slug)]);

  const vaultName = vault?.name ?? slug;
  const navTree = buildNavTree(notes.map((n) => ({ path: n.path, title: n.title })));

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navigation header */}
      <header
        role="banner"
        className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm"
      >
        <nav
          aria-label="Public vault navigation"
          className="mx-auto flex max-w-wide items-center justify-between px-4 py-3"
        >
          <a
            href={`/public/${encodeURIComponent(slug)}`}
            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {vaultName}
          </a>
          <a
            href="/"
            className="text-xs text-foreground-secondary transition-colors hover:text-primary"
          >
            Open in app
          </a>
        </nav>
      </header>

      {/* Body: sidebar + content */}
      <div className="mx-auto flex max-w-wide">
        {/* Sidebar navigation */}
        <Suspense fallback={null}>
          <VaultNavigation slug={slug} notes={navTree} />
        </Suspense>

        {/* Main content */}
        <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 px-4 py-8 lg:px-8">
          {children}
        </main>
      </div>

      <footer role="contentinfo" className="border-t border-border px-4 py-4 text-center">
        <p className="text-xs text-foreground-muted">
          Powered by{' '}
          <a href="/" className="text-primary hover:underline">
            Notesaner
          </a>
        </p>
      </footer>
    </div>
  );
}
