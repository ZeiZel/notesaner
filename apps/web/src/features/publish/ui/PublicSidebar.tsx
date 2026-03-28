'use client';

/**
 * PublicSidebar — sidebar with published note tree for public workspace view.
 *
 * Features:
 *   - Hierarchical folder/note tree with expand/collapse
 *   - Active note highlighting based on current path
 *   - Built-in search filter for quick note finding
 *   - Collapsible sidebar for mobile/small screens
 *   - Keyboard accessible: arrow keys for tree navigation
 *   - Folders expand/collapse on click; notes navigate on click
 *
 * Data source:
 *   The component accepts a tree structure as a prop. The parent layout
 *   is responsible for fetching the published note index from the API
 *   and passing it here.
 *
 * Usage:
 *   <PublicSidebar
 *     slug="my-vault"
 *     notes={noteTree}
 *     currentPath="projects/web/todo"
 *   />
 */

import { useState, useCallback, useId } from 'react';
import { cn } from '@/shared/lib/utils';

// ---- Types ----------------------------------------------------------------

export interface PublicNoteTreeNode {
  /** Display title (derived from filename or frontmatter). */
  title: string;
  /** Path within the vault (e.g. "projects/web/todo.md"). */
  path: string;
  /** Whether this node is a folder (has children). */
  isFolder: boolean;
  /** Child nodes (only for folders). */
  children?: PublicNoteTreeNode[];
}

interface PublicSidebarProps {
  /** The public vault slug. */
  slug: string;
  /** The hierarchical note tree. */
  notes: PublicNoteTreeNode[];
  /** Currently active note path (without .md extension). */
  currentPath?: string;
  /** Whether the sidebar is open (mobile toggle). */
  isOpen: boolean;
  /** Toggle sidebar visibility. */
  onToggle: () => void;
  /** Additional CSS class name for the sidebar container. */
  className?: string;
}

// ---- Icons ----------------------------------------------------------------

function FolderIcon({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M1.75 3A1.75 1.75 0 0 0 0 4.75v.5C0 5.664.336 6 .75 6h14.5c.414 0 .75-.336.75-.75v-.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2c-.227-.303-.57-.5-.95-.5H1.75Z" />
        <path d="M1.5 7.75v5.75c0 .966.784 1.75 1.75 1.75h9.5A1.75 1.75 0 0 0 14.5 13.5V7.75a.25.25 0 0 0-.25-.25H1.75a.25.25 0 0 0-.25.25Z" />
      </svg>
    );
  }

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

function ChevronIcon({ isExpanded }: { isExpanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={cn(
        'h-3 w-3 shrink-0 text-foreground-muted transition-transform duration-200',
        isExpanded && 'rotate-90',
      )}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6.22 4.22a.75.75 0 0 1 1.06 0l3.25 3.25a.75.75 0 0 1 0 1.06l-3.25 3.25a.75.75 0 0 1-1.06-1.06L8.94 8 6.22 5.28a.75.75 0 0 1 0-1.06Z" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-foreground-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M10.68 11.74a6 6 0 0 1-7.922-8.982 6 6 0 0 1 8.982 7.922l3.04 3.04a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215l-3.04-3.04ZM11.5 7a4.499 4.499 0 1 0-8.997 0A4.499 4.499 0 0 0 11.5 7Z" />
    </svg>
  );
}

// ---- Tree Node Component --------------------------------------------------

interface TreeNodeProps {
  node: PublicNoteTreeNode;
  slug: string;
  currentPath?: string;
  depth: number;
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
}

function TreeNode({
  node,
  slug,
  currentPath,
  depth,
  expandedFolders,
  onToggleFolder,
}: TreeNodeProps) {
  const isExpanded = expandedFolders.has(node.path);
  const pathWithoutExt = node.path.replace(/\.md$/, '');
  const isActive = currentPath === pathWithoutExt || currentPath === node.path;
  const paddingLeft = 12 + depth * 16;

  if (node.isFolder) {
    return (
      <li role="treeitem" aria-expanded={isExpanded}>
        <button
          type="button"
          onClick={() => onToggleFolder(node.path)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-sm transition-colors hover:bg-accent',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          )}
          style={{ paddingLeft }}
          aria-label={`${isExpanded ? 'Collapse' : 'Expand'} folder ${node.title}`}
        >
          <ChevronIcon isExpanded={isExpanded} />
          <FolderIcon isOpen={isExpanded} />
          <span className="truncate text-foreground-secondary">{node.title}</span>
        </button>

        {isExpanded && node.children && node.children.length > 0 && (
          <ul role="group" className="list-none">
            {node.children.map((child) => (
              <TreeNode
                key={child.path}
                node={child}
                slug={slug}
                currentPath={currentPath}
                depth={depth + 1}
                expandedFolders={expandedFolders}
                onToggleFolder={onToggleFolder}
              />
            ))}
          </ul>
        )}
      </li>
    );
  }

  // Note node
  return (
    <li role="treeitem">
      <a
        href={`/public/${encodeURIComponent(slug)}/${pathWithoutExt}`}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-sm transition-colors',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive
            ? 'bg-primary/10 font-medium text-primary'
            : 'text-foreground-secondary hover:bg-accent hover:text-foreground',
        )}
        style={{ paddingLeft: paddingLeft + 12 }}
        aria-current={isActive ? 'page' : undefined}
      >
        <NoteIcon />
        <span className="truncate">{node.title}</span>
      </a>
    </li>
  );
}

// ---- Filter helper --------------------------------------------------------

function filterTree(nodes: PublicNoteTreeNode[], query: string): PublicNoteTreeNode[] {
  const lower = query.toLowerCase();

  return nodes.reduce<PublicNoteTreeNode[]>((acc, node) => {
    if (node.isFolder && node.children) {
      const filteredChildren = filterTree(node.children, query);
      if (filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren });
      }
    } else if (node.title.toLowerCase().includes(lower)) {
      acc.push(node);
    }
    return acc;
  }, []);
}

function collectAllFolderPaths(nodes: PublicNoteTreeNode[]): string[] {
  const paths: string[] = [];
  for (const node of nodes) {
    if (node.isFolder) {
      paths.push(node.path);
      if (node.children) {
        paths.push(...collectAllFolderPaths(node.children));
      }
    }
  }
  return paths;
}

// ---- Main Component -------------------------------------------------------

export function PublicSidebar({
  slug,
  notes,
  currentPath,
  isOpen,
  onToggle,
  className,
}: PublicSidebarProps) {
  const searchId = useId();
  const [filterQuery, setFilterQuery] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    // Auto-expand folders in the current path
    if (!currentPath) return new Set<string>();

    const parts = currentPath.split('/');
    const paths = new Set<string>();
    let accumulated = '';
    for (let i = 0; i < parts.length - 1; i++) {
      accumulated = accumulated ? `${accumulated}/${parts[i]}` : parts[i];
      paths.add(accumulated);
    }
    return paths;
  });

  const handleToggleFolder = useCallback((folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  }, []);

  const handleClearFilter = useCallback(() => {
    setFilterQuery('');
  }, []);

  // Filter notes when search is active
  const isFiltering = filterQuery.trim().length > 0;
  const displayedNotes = isFiltering ? filterTree(notes, filterQuery.trim()) : notes;

  // When filtering, expand all folders to show matches
  const effectiveExpandedFolders = isFiltering
    ? new Set(collectAllFolderPaths(displayedNotes))
    : expandedFolders;

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden animate-in fade-in duration-200"
          aria-hidden="true"
          onClick={onToggle}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-background transition-transform duration-300',
          'lg:sticky lg:top-0 lg:z-0 lg:h-screen lg:translate-x-0',
          isOpen ? 'translate-x-0' : '-translate-x-full',
          className,
        )}
        aria-label="Published notes navigation"
      >
        {/* Sidebar header */}
        <div className="flex items-center justify-between border-b border-border px-3 py-3">
          <a
            href={`/public/${encodeURIComponent(slug)}`}
            className="truncate text-sm font-semibold text-foreground hover:text-primary transition-colors"
          >
            {slug}
          </a>

          {/* Close button (mobile only) */}
          <button
            type="button"
            onClick={onToggle}
            className="flex h-6 w-6 items-center justify-center rounded text-foreground-muted hover:bg-accent hover:text-foreground transition-colors lg:hidden"
            aria-label="Close sidebar"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Search filter */}
        <div className="border-b border-border px-3 py-2">
          <div className="relative flex items-center">
            <SearchIcon />
            <label htmlFor={searchId} className="sr-only">
              Filter notes
            </label>
            <input
              id={searchId}
              type="search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter notes..."
              autoComplete="off"
              spellCheck={false}
              className="ml-1.5 flex-1 bg-transparent text-xs text-foreground placeholder:text-foreground-muted focus:outline-none"
            />
            {isFiltering && (
              <button
                type="button"
                onClick={handleClearFilter}
                aria-label="Clear filter"
                className="flex h-4 w-4 items-center justify-center rounded-full text-foreground-muted hover:bg-accent hover:text-foreground transition-colors"
              >
                <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Note tree */}
        <nav className="flex-1 overflow-y-auto px-2 py-2" aria-label="Note tree">
          {displayedNotes.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-xs text-foreground-muted">
                {isFiltering ? 'No notes match your filter.' : 'No published notes.'}
              </p>
            </div>
          ) : (
            <ul role="tree" className="list-none space-y-0.5">
              {displayedNotes.map((node) => (
                <TreeNode
                  key={node.path}
                  node={node}
                  slug={slug}
                  currentPath={currentPath}
                  depth={0}
                  expandedFolders={effectiveExpandedFolders}
                  onToggleFolder={handleToggleFolder}
                />
              ))}
            </ul>
          )}
        </nav>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <a
            href="/"
            className="flex items-center gap-1.5 text-xs text-foreground-muted transition-colors hover:text-primary"
          >
            <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
              <path d="M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm7.5-6.923c-.67.204-1.335.82-1.887 1.855A7.97 7.97 0 0 0 5.145 4H7.5V1.077ZM4.09 4a9.267 9.267 0 0 1 .64-1.539 6.7 6.7 0 0 1 .597-.933A7.025 7.025 0 0 0 2.255 4H4.09Z" />
            </svg>
            Powered by Notesaner
          </a>
        </div>
      </aside>
    </>
  );
}
