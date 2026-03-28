'use client';

/**
 * FileExplorer — virtualized file tree for the left sidebar.
 *
 * Uses VirtualTree from shared/lib to render only visible nodes in the DOM.
 * The tree data comes from a workspace files API (or is passed as props).
 * Expand/collapse and selection state is read from the sidebar store.
 *
 * This replaces the static FileExplorerPlaceholder with a performant,
 * production-ready tree that can handle thousands of files.
 */

import { useCallback, useRef, useMemo, useEffect } from 'react';
import { Tooltip } from 'antd';
import {
  VirtualTree,
  type FlatNode,
  type TreeNode,
  type VirtualTreeHandle,
} from '@/shared/ui/VirtualTree';
import { useSidebarStore } from '@/shared/stores/sidebar-store';
import { usePresenceStore, selectUsersOnNote } from '@/shared/stores/presence-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileNodeData {
  /** Display name of the file or folder. */
  name: string;
  /** Whether this is a folder. */
  isFolder: boolean;
  /** Full path relative to workspace root (e.g. "Projects/todo.md"). */
  path: string;
  /** File extension without dot (e.g. "md", "png"). Undefined for folders. */
  extension?: string;
}

export interface FileExplorerProps {
  /** Tree data for the workspace. */
  fileTree: TreeNode<FileNodeData>[];
  /** Called when a file (leaf) is selected. Receives node ID and file path. */
  onFileSelect?: (nodeId: string, path: string) => void;
}

// ---------------------------------------------------------------------------
// Icon helpers
// ---------------------------------------------------------------------------

function FolderIcon({ expanded }: { expanded: boolean }) {
  if (expanded) {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-3.5 w-3.5 shrink-0 text-sidebar-muted"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M1.75 2.5a.25.25 0 00-.25.25v4.5a.25.25 0 00.25.25h12.5a.25.25 0 00.25-.25v-3a.25.25 0 00-.25-.25H7.19a1.75 1.75 0 01-1.24-.513L4.56 2.05a.25.25 0 00-.177-.073H1.75z" />
        <path d="M14.5 8H1.5v4.25c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V8z" opacity="0.6" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 text-sidebar-muted"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
    </svg>
  );
}

function FileIcon({ extension }: { extension?: string }) {
  const color = extension === 'md' ? 'text-primary/60' : 'text-sidebar-muted';
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3.5 w-3.5 shrink-0 ${color}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
      <path d="M9.5 1.5v2.75c0 .138.112.25.25.25h2.75L9.5 1.5z" />
    </svg>
  );
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={`h-3 w-3 shrink-0 text-sidebar-muted transition-transform duration-fast ${expanded ? 'rotate-90' : ''}`}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M6 3.5l5 4.5-5 4.5V3.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tree row renderer
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Presence dot for file tree items
// ---------------------------------------------------------------------------

function FilePresenceDot({ nodeId }: { nodeId: string }) {
  const viewers = usePresenceStore((state) => selectUsersOnNote(state, nodeId));

  if (viewers.length === 0) return null;

  const dotColor = viewers[0].color;
  const tooltipText =
    viewers.length === 1
      ? `${viewers[0].displayName} is editing`
      : `${viewers.length} users editing: ${viewers.map((v) => v.displayName).join(', ')}`;

  return (
    <Tooltip title={tooltipText} placement="right" mouseEnterDelay={0.3}>
      <span
        className="inline-block shrink-0 rounded-full"
        style={{
          width: 6,
          height: 6,
          backgroundColor: dotColor,
        }}
        role="status"
        aria-label={tooltipText}
      />
    </Tooltip>
  );
}

function FileTreeRow({
  flatNode,
  isSelected,
  onToggle,
  onSelect,
}: {
  flatNode: FlatNode<FileNodeData>;
  isSelected: boolean;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  const { node, depth, isParent, isExpanded } = flatNode;
  const { name, isFolder, extension } = node.data;

  function handleClick() {
    if (isParent) {
      onToggle(node.id);
    }
    onSelect(node.id);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isFolder ? `${name} folder${isExpanded ? ', expanded' : ', collapsed'}` : name}
      className={`flex w-full items-center gap-1 rounded-sm py-1 text-left text-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ${
        isSelected
          ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
          : 'text-sidebar-foreground'
      }`}
      style={{ paddingLeft: `${depth * 12 + 4}px` }}
    >
      {isParent && <ChevronIcon expanded={isExpanded} />}
      {!isParent && <span className="w-3" aria-hidden="true" />}
      {isFolder ? <FolderIcon expanded={isExpanded} /> : <FileIcon extension={extension} />}
      <span className="truncate">{name}</span>
      {/* Presence dot: shows when others are editing this note */}
      {!isFolder && <FilePresenceDot nodeId={node.id} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FileExplorer({ fileTree, onFileSelect }: FileExplorerProps) {
  const treeRef = useRef<VirtualTreeHandle>(null);
  const expandedFolders = useSidebarStore((s) => s.expandedFolders);
  const selectedFileId = useSidebarStore((s) => s.selectedFileId);
  const toggleFolder = useSidebarStore((s) => s.toggleFolder);
  const setSelectedFile = useSidebarStore((s) => s.setSelectedFile);

  const expandedIds = useMemo(() => new Set(expandedFolders), [expandedFolders]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      toggleFolder(nodeId);
    },
    [toggleFolder],
  );

  const handleSelect = useCallback(
    (nodeId: string) => {
      setSelectedFile(nodeId);
      // Find the node data to get the path
      const findNode = (nodes: TreeNode<FileNodeData>[]): TreeNode<FileNodeData> | null => {
        for (const node of nodes) {
          if (node.id === nodeId) return node;
          if (node.children) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findNode(fileTree);
      if (node && !node.data.isFolder && onFileSelect) {
        onFileSelect(nodeId, node.data.path);
      }
    },
    [setSelectedFile, fileTree, onFileSelect],
  );

  // Scroll to selected file on initial render / when selectedFileId changes
  useEffect(() => {
    if (selectedFileId) {
      // Small delay to let virtualizer measure
      const timer = setTimeout(() => {
        treeRef.current?.scrollToNode(selectedFileId);
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [selectedFileId]);

  const renderNode = useCallback(
    (flatNode: FlatNode<FileNodeData>) => (
      <FileTreeRow
        flatNode={flatNode}
        isSelected={flatNode.node.id === selectedFileId}
        onToggle={handleToggle}
        onSelect={handleSelect}
      />
    ),
    [selectedFileId, handleToggle, handleSelect],
  );

  if (fileTree.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <p className="text-xs text-sidebar-muted">No files yet</p>
        <button className="flex items-center gap-1.5 rounded-sm px-2 py-1 text-xs text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 01.75.75v4.5h4.5a.75.75 0 010 1.5h-4.5v4.5a.75.75 0 01-1.5 0v-4.5h-4.5a.75.75 0 010-1.5h4.5v-4.5A.75.75 0 018 2z" />
          </svg>
          New note
        </button>
      </div>
    );
  }

  return (
    <VirtualTree<FileNodeData>
      ref={treeRef}
      roots={fileTree}
      expandedIds={expandedIds}
      selectedId={selectedFileId}
      onToggle={handleToggle}
      onSelect={handleSelect}
      renderNode={renderNode}
      estimateSize={28}
      overscan={10}
      className="h-full"
      aria-label="File explorer"
    />
  );
}
