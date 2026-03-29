'use client';

/**
 * NoteBreadcrumb — breadcrumb navigation for the note hierarchy.
 *
 * Renders the current note's position in the folder tree:
 *   Workspace > Folder > Subfolder > Note
 *
 * Features:
 *   - Ant Design Breadcrumb component with icon-decorated segments
 *   - Folder segments show a folder icon; the final note segment shows a document icon
 *   - Workspace root segment shows a workspace icon
 *   - Every segment except the last is clickable (calls onNavigate)
 *   - Responsive: collapses middle segments when there are more than `maxItems`
 *   - Collapsed middle segments are revealed via an Ant Design Dropdown
 *
 * Props:
 *   - workspaceName — label for the root workspace segment
 *   - notePath     — note path relative to the workspace root (e.g. "Projects/Web/todo.md")
 *   - noteTitle    — human-readable title of the note (overrides the filename derived from path)
 *   - onNavigate   — called when a folder segment is clicked; receives the partial path
 *   - maxItems     — max total visible segments before collapsing; defaults to 4
 *   - className    — additional class names
 */

import { useState } from 'react';
import { Breadcrumb, Dropdown } from 'antd';
import type { BreadcrumbProps, MenuProps } from 'antd';
import { cn } from '@/shared/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NoteBreadcrumbProps {
  /** Display name for the workspace root segment (e.g. "My Workspace"). */
  workspaceName: string;
  /**
   * Note path relative to workspace root (e.g. "Projects/Web/todo.md").
   * When undefined or empty, only the workspace segment is rendered.
   */
  notePath?: string;
  /**
   * Override the display label for the last (note) segment.
   * Falls back to the filename derived from the path.
   */
  noteTitle?: string;
  /**
   * Called when a non-terminal segment is clicked.
   * Receives the partial path up to (and including) the clicked segment.
   * For the workspace root segment the path is an empty string "".
   */
  onNavigate?: (path: string) => void;
  /**
   * Maximum number of total visible breadcrumb segments.
   * When the path has more segments, the middle ones collapse into a dropdown.
   * Defaults to 4.
   */
  maxItems?: number;
  /** Additional CSS class for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Internal segment shape
// ---------------------------------------------------------------------------

export interface BreadcrumbSegment {
  /** Segment label (folder name or note title). */
  label: string;
  /**
   * Partial path up to and including this segment (relative to workspace root).
   * Empty string for the workspace root.
   */
  path: string;
  /** Whether this is the final segment (the note itself). */
  isLast: boolean;
  /** Whether this represents a folder. */
  isFolder: boolean;
}

// ---------------------------------------------------------------------------
// Icons — inline SVG to keep the bundle lean and avoid icon registry setup
// ---------------------------------------------------------------------------

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="inline h-3.5 w-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M2 3.5A1.5 1.5 0 013.5 2h2.879a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 009.62 4H12.5A1.5 1.5 0 0114 5.5v7A1.5 1.5 0 0112.5 14h-9A1.5 1.5 0 012 12.5v-9z" />
    </svg>
  );
}

function DocumentIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="inline h-3.5 w-3.5 shrink-0 text-primary/70"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
      <path d="M9.5 1.5v2.75c0 .138.112.25.25.25h2.75L9.5 1.5z" />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="inline h-3.5 w-3.5 shrink-0"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function EllipsisIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M3 8a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm5 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Path parsing helpers
// ---------------------------------------------------------------------------

/**
 * Derives the display label from the last segment of a path.
 * Strips common note extensions (.md, .txt, .canvas, .mdx).
 */
export function deriveFilename(path: string): string {
  const lastSegment = path.split('/').pop() ?? path;
  return lastSegment.replace(/\.(md|txt|canvas|mdx)$/i, '');
}

/**
 * Builds an ordered array of breadcrumb segments from a note path.
 *
 * Example input:
 *   workspaceName = "My Vault"
 *   notePath      = "Projects/Web/todo.md"
 *   noteTitle     = "Todo List"
 *
 * Returns:
 *   [
 *     { label: "My Vault",  path: "",                    isLast: false, isFolder: false },
 *     { label: "Projects",  path: "Projects",             isLast: false, isFolder: true  },
 *     { label: "Web",       path: "Projects/Web",         isLast: false, isFolder: true  },
 *     { label: "Todo List", path: "Projects/Web/todo.md", isLast: true,  isFolder: false },
 *   ]
 */
export function buildBreadcrumbSegments(
  workspaceName: string,
  notePath?: string,
  noteTitle?: string,
): BreadcrumbSegment[] {
  const hasPath = notePath != null && notePath.trim() !== '';

  const root: BreadcrumbSegment = {
    label: workspaceName,
    path: '',
    isLast: !hasPath,
    isFolder: false,
  };

  if (!hasPath) {
    return [root];
  }

  // notePath is guaranteed non-null/non-empty here because hasPath is true
  const parts = notePath!.split('/').filter(Boolean); // eslint-disable-line @typescript-eslint/no-non-null-assertion

  if (parts.length === 0) {
    return [root];
  }

  const folderParts = parts.slice(0, -1);
  // parts is non-empty (guarded above), so the last element is safe to access
  const filePart = parts[parts.length - 1] ?? '';

  const folderSegments: BreadcrumbSegment[] = folderParts.map((part, index) => ({
    label: decodeURIComponent(part),
    path: folderParts.slice(0, index + 1).join('/'),
    isLast: false,
    isFolder: true,
  }));

  const noteSegment: BreadcrumbSegment = {
    label: noteTitle ?? deriveFilename(filePart),
    path: parts.join('/'),
    isLast: true,
    isFolder: false,
  };

  return [root, ...folderSegments, noteSegment];
}

// ---------------------------------------------------------------------------
// Segment rendering helpers
// ---------------------------------------------------------------------------

function getIcon(segment: BreadcrumbSegment) {
  if (segment.isLast) return <DocumentIcon />;
  if (segment.path === '') return <WorkspaceIcon />;
  return <FolderIcon />;
}

// ---------------------------------------------------------------------------
// NoteBreadcrumb component
// ---------------------------------------------------------------------------

export function NoteBreadcrumb({
  workspaceName,
  notePath,
  noteTitle,
  onNavigate,
  maxItems = 4,
  className,
}: NoteBreadcrumbProps) {
  const [collapsedOpen, setCollapsedOpen] = useState(false);

  const segments = buildBreadcrumbSegments(workspaceName, notePath, noteTitle);

  // When the segment count exceeds maxItems, collapse the middle segments.
  // We always show: first (workspace), last N-2 before the note, and the note itself.
  // The collapsed group sits between the first and the remaining visible ones.
  const shouldCollapse = segments.length > maxItems;

  // Number of segments to keep visible after collapse (first + tail + last)
  // Keep first segment + (maxItems - 2) tail segments + the last note segment
  const tailCount = Math.max(1, maxItems - 2);
  const collapsedSegments: BreadcrumbSegment[] = shouldCollapse
    ? segments.slice(1, segments.length - tailCount)
    : [];
  // segments always has at least one element (workspace root is always present)
  const firstSegment = segments[0] as BreadcrumbSegment;
  const visibleAfterCollapse: BreadcrumbSegment[] = shouldCollapse
    ? [firstSegment, ...segments.slice(segments.length - tailCount)]
    : segments;

  // Dropdown menu items for collapsed segments
  const collapsedMenuItems: MenuProps['items'] = collapsedSegments.map((seg, i) => ({
    key: seg.path || `seg-${i}`,
    label: (
      <button
        type="button"
        onClick={() => {
          onNavigate?.(seg.path);
          setCollapsedOpen(false);
        }}
        className="flex items-center gap-1.5 text-left w-full"
      >
        <FolderIcon />
        <span>{seg.label}</span>
      </button>
    ),
  }));

  // Build the Ant Design Breadcrumb items array from visible segments
  const items: BreadcrumbProps['items'] = [];

  visibleAfterCollapse.forEach((segment, index) => {
    // Insert the collapsed ellipsis node after the first segment when collapsing
    if (shouldCollapse && index === 1) {
      items.push({
        title: (
          <Dropdown
            menu={{ items: collapsedMenuItems }}
            trigger={['click']}
            open={collapsedOpen}
            onOpenChange={setCollapsedOpen}
          >
            <button
              type="button"
              aria-label="Show hidden path segments"
              aria-expanded={collapsedOpen}
              className="flex items-center justify-center rounded px-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <EllipsisIcon />
            </button>
          </Dropdown>
        ),
      });
    }

    const icon = getIcon(segment);

    if (segment.isLast) {
      items.push({
        title: (
          <span aria-current="page" className="flex items-center gap-1 font-medium text-foreground">
            {icon}
            <span className="truncate max-w-[200px]" title={segment.label}>
              {segment.label}
            </span>
          </span>
        ),
      });
    } else {
      items.push({
        title: (
          <button
            type="button"
            onClick={() => onNavigate?.(segment.path)}
            className="flex items-center gap-1 rounded px-0.5 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            aria-label={`Navigate to ${segment.label}`}
          >
            {icon}
            <span className="truncate max-w-[140px]" title={segment.label}>
              {segment.label}
            </span>
          </button>
        ),
      });
    }
  });

  return (
    <nav
      aria-label="Note path"
      className={cn('flex items-center text-xs text-foreground-secondary', className)}
    >
      <Breadcrumb items={items} />
    </nav>
  );
}
