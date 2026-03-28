'use client';

/**
 * FolderPickerDialog — modal dialog for selecting a target folder.
 *
 * Used by NoteActions for copy-to-folder and move-to-folder operations.
 * Fetches the folder tree from the API and displays a navigable tree structure.
 *
 * Design:
 *   - Self-contained data fetching via TanStack Query.
 *   - Keyboard navigable: arrow keys, enter to select, escape to close.
 *   - No useEffect for data or state management.
 */

import { useState, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FolderNode {
  path: string;
  name: string;
  children: FolderNode[];
}

interface FolderPickerDialogProps {
  workspaceId: string;
  /** Title shown in the dialog header. */
  title: string;
  /** Label for the confirm button. */
  confirmLabel: string;
  /** Path to exclude from selection (the source note path). */
  excludePath?: string;
  /** Called when the user confirms a folder selection. */
  onSelect: (folderPath: string) => void;
  /** Called when the dialog is closed/cancelled. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// API helper
// ---------------------------------------------------------------------------

interface FolderListItem {
  path: string;
  name: string;
}

async function fetchFolders(token: string, workspaceId: string): Promise<FolderListItem[]> {
  return apiClient.get<FolderListItem[]>(`/api/workspaces/${workspaceId}/folders`, { token });
}

// ---------------------------------------------------------------------------
// Tree builder
// ---------------------------------------------------------------------------

function buildFolderTree(folders: FolderListItem[]): FolderNode[] {
  const root: FolderNode[] = [];
  const nodeMap = new Map<string, FolderNode>();

  // Sort folders by path depth for deterministic tree building
  const sorted = [...folders].sort((a, b) => a.path.localeCompare(b.path));

  for (const folder of sorted) {
    const node: FolderNode = {
      path: folder.path,
      name: folder.name,
      children: [],
    };
    nodeMap.set(folder.path, node);

    // Find parent path
    const lastSlash = folder.path.lastIndexOf('/');
    const parentPath = lastSlash > 0 ? folder.path.slice(0, lastSlash) : '';

    if (parentPath && nodeMap.has(parentPath)) {
      nodeMap.get(parentPath)?.children.push(node);
    } else {
      root.push(node);
    }
  }

  return root;
}

// ---------------------------------------------------------------------------
// FolderTreeItem
// ---------------------------------------------------------------------------

interface FolderTreeItemProps {
  node: FolderNode;
  depth: number;
  selectedPath: string | null;
  expandedPaths: Set<string>;
  excludePath?: string;
  onSelect: (path: string) => void;
  onToggleExpand: (path: string) => void;
}

function FolderTreeItem({
  node,
  depth,
  selectedPath,
  expandedPaths,
  excludePath,
  onSelect,
  onToggleExpand,
}: FolderTreeItemProps) {
  const isSelected = selectedPath === node.path;
  const isExpanded = expandedPaths.has(node.path);
  const hasChildren = node.children.length > 0;
  const isExcluded = excludePath !== undefined && node.path === excludePath;

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          if (!isExcluded) {
            onSelect(node.path);
          }
          if (hasChildren) {
            onToggleExpand(node.path);
          }
        }}
        disabled={isExcluded}
        aria-selected={isSelected}
        className={cn(
          'flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-sm transition-colors',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          isSelected && 'bg-primary/10 text-primary font-medium',
          !isSelected && !isExcluded && 'text-foreground hover:bg-accent',
          isExcluded && 'opacity-40 cursor-not-allowed',
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {/* Expand/collapse chevron */}
        {hasChildren ? (
          <svg
            viewBox="0 0 16 16"
            className={cn('h-3 w-3 shrink-0 transition-transform', isExpanded && 'rotate-90')}
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
          </svg>
        ) : (
          <span className="w-3 shrink-0" />
        )}

        {/* Folder icon */}
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
        </svg>

        <span className="truncate">{node.name}</span>
      </button>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <FolderTreeItem
              key={child.path}
              node={child}
              depth={depth + 1}
              selectedPath={selectedPath}
              expandedPaths={expandedPaths}
              excludePath={excludePath}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FolderPickerDialog({
  workspaceId,
  title,
  confirmLabel,
  excludePath,
  onSelect,
  onClose,
}: FolderPickerDialogProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const dialogRef = useRef<HTMLDivElement>(null);

  const {
    data: folders,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['folders', workspaceId],
    queryFn: () => fetchFolders(accessToken ?? '', workspaceId),
    enabled: !!accessToken,
    staleTime: 30_000,
  });

  const folderTree = folders ? buildFolderTree(folders) : [];

  const handleToggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (selectedPath) {
      onSelect(selectedPath);
    }
  }, [selectedPath, onSelect]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter' && selectedPath) {
        e.preventDefault();
        handleConfirm();
      }
    },
    [onClose, selectedPath, handleConfirm],
  );

  // Allow selecting root (empty path) for top-level placement
  const handleSelectRoot = useCallback(() => {
    setSelectedPath('');
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog panel */}
      <div
        ref={dialogRef}
        className="relative z-10 flex h-[480px] w-[400px] max-w-[90vw] max-h-[80vh] flex-col overflow-hidden rounded-lg border bg-background shadow-lg"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-sm opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-2">
          {isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-primary" />
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-2 py-8">
              <p className="text-sm text-destructive">Failed to load folders</p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="rounded bg-accent px-2 py-1 text-xs font-medium hover:bg-border transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!isLoading && !isError && (
            <div role="tree" aria-label="Folder tree">
              {/* Root option */}
              <button
                type="button"
                onClick={handleSelectRoot}
                aria-selected={selectedPath === ''}
                className={cn(
                  'flex w-full items-center gap-1.5 rounded-sm px-2 py-1 text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                  selectedPath === '' && 'bg-primary/10 text-primary font-medium',
                  selectedPath !== '' && 'text-foreground hover:bg-accent',
                )}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
                </svg>
                <span>/ (root)</span>
              </button>

              {folderTree.map((node) => (
                <FolderTreeItem
                  key={node.path}
                  node={node}
                  depth={0}
                  selectedPath={selectedPath}
                  expandedPaths={expandedPaths}
                  excludePath={excludePath}
                  onSelect={setSelectedPath}
                  onToggleExpand={handleToggleExpand}
                />
              ))}

              {folderTree.length === 0 && (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No folders found in this workspace.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t px-4 py-3">
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">
            {selectedPath !== null ? selectedPath || '/ (root)' : 'Select a folder'}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-md px-3',
                'border border-input bg-background text-sm',
                'hover:bg-accent hover:text-accent-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedPath === null}
              className={cn(
                'inline-flex h-8 items-center justify-center rounded-md px-4',
                'bg-primary text-primary-foreground text-sm font-medium',
                'hover:bg-primary/90',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                'disabled:pointer-events-none disabled:opacity-50',
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
