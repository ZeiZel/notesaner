/**
 * VaultNavigation — server-rendered sidebar navigation for public vault pages.
 *
 * Renders a hierarchical folder/note tree auto-generated from the
 * published notes list. This is a Server Component for SEO and
 * initial load performance. All links are plain <a> tags for
 * full SSR crawlability.
 *
 * Features:
 *   - Hierarchical folder/note tree
 *   - All folders expanded by default for crawlability
 *   - Accessible: uses semantic <nav> with aria-label
 *   - Responsive: hidden on mobile (controlled via CSS)
 *   - Links to individual note pages
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NavTreeNode {
  title: string;
  path: string;
  isFolder: boolean;
  children?: NavTreeNode[];
}

interface VaultNavigationProps {
  /** The public vault slug. */
  slug: string;
  /** The hierarchical note tree. */
  notes: NavTreeNode[];
}

// ---------------------------------------------------------------------------
// Icons (inline SVG for server rendering)
// ---------------------------------------------------------------------------

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h2.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H12.5A1.5 1.5 0 0 1 14 5.5v7A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9Z" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M4 1.5A1.5 1.5 0 0 1 5.5 0h5.586a1.5 1.5 0 0 1 1.06.44l1.415 1.414A1.5 1.5 0 0 1 14 2.914V14.5a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 4 14.5v-13Zm1.5-.5a.5.5 0 0 0-.5.5v13a.5.5 0 0 0 .5.5h7a.5.5 0 0 0 .5-.5V4.414L10.586 2H5.5Z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tree node renderer
// ---------------------------------------------------------------------------

function TreeNode({ node, slug, depth }: { node: NavTreeNode; slug: string; depth: number }) {
  const paddingLeft = 12 + depth * 16;
  const pathWithoutExt = node.path.replace(/\.md$/, '');

  if (node.isFolder) {
    return (
      <li>
        <div
          className="flex items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm text-foreground-secondary"
          style={{ paddingLeft }}
        >
          <FolderIcon />
          <span className="truncate font-medium">{node.title}</span>
        </div>

        {node.children && node.children.length > 0 && (
          <ul className="list-none">
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} slug={slug} depth={depth + 1} />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Note leaf node
  return (
    <li>
      <a
        href={`/public/${encodeURIComponent(slug)}/${pathWithoutExt}`}
        className="flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm text-foreground-secondary transition-colors hover:bg-accent hover:text-foreground"
        style={{ paddingLeft: paddingLeft + 12 }}
      >
        <NoteIcon />
        <span className="truncate">{node.title}</span>
      </a>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VaultNavigation({ slug, notes }: VaultNavigationProps) {
  if (notes.length === 0) {
    return null;
  }

  return (
    <aside
      className="hidden lg:block sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border px-2 py-4"
      aria-label="Published notes navigation"
    >
      <nav>
        <ul className="list-none space-y-0.5">
          {notes.map((node) => (
            <TreeNode key={node.path} node={node} slug={slug} depth={0} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
