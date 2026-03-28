'use client';

/**
 * FileDropZone -- full-screen overlay that activates when files are dragged
 * over the workspace area.
 *
 * Features:
 *   - Shows a visual overlay with accepted file types when dragging files
 *   - Progress indicator for active uploads
 *   - Per-file status display with error reporting
 *   - Auto-hides when idle and no active imports
 *
 * This component should wrap the main workspace content area. It uses the
 * useFileImport hook for actual upload logic and subscribes to
 * useFileImportStore for progress state.
 *
 * @module features/workspace/components/FileDropZone
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  useFileImport,
  useFileImportStore,
  type UseFileImportOptions,
  type ImportFileEntry,
} from '../hooks/useFileImport';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FileDropZoneProps extends UseFileImportOptions {
  /** Content to render inside the drop zone (the workspace). */
  children: ReactNode;
  /** Additional CSS class for the outer container. */
  className?: string;
  /** Whether the drop zone is disabled. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// File type icon helper
// ---------------------------------------------------------------------------

function FileTypeIcon({ fileType }: { fileType: 'note' | 'image' | 'attachment' }) {
  if (fileType === 'note') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-primary"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M3.75 1.5a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25V6H9.75A1.75 1.75 0 018 4.25V1.5H3.75z" />
        <path d="M9.5 1.5v2.75c0 .138.112.25.25.25h2.75L9.5 1.5z" />
      </svg>
    );
  }
  if (fileType === 'image') {
    return (
      <svg
        viewBox="0 0 16 16"
        className="h-4 w-4 shrink-0 text-green-500"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h.94l4.97-6.62a.75.75 0 011.18-.06l2.97 3.37 1.34-1.34a.75.75 0 011.06 0l.97.97V2.75a.25.25 0 00-.25-.25H1.75zM0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0114.25 15H1.75A1.75 1.75 0 010 13.25V2.75zm5.5 3.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4 shrink-0 text-orange-500"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3.5 1.75a.25.25 0 01.25-.25h3a.75.75 0 01.53.22l2.72 2.72a.75.75 0 01.22.53v8.28a.25.25 0 01-.25.25h-6.5a.25.25 0 01-.25-.25V1.75z" />
      <path d="M8 1.5v3.25c0 .138.112.25.25.25h3.25L8 1.5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function StatusIndicator({ status }: { status: ImportFileEntry['status'] }) {
  switch (status) {
    case 'pending':
      return <span className="text-xs text-foreground-muted">Pending</span>;
    case 'uploading':
    case 'processing':
      return (
        <svg
          className="h-4 w-4 animate-spin text-primary"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" opacity="0.25" />
          <path
            d="M14 8a6 6 0 00-6-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'done':
      return (
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 text-green-500"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      );
    case 'error':
      return (
        <svg
          viewBox="0 0 16 16"
          className="h-4 w-4 text-destructive"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      );
  }
}

// ---------------------------------------------------------------------------
// Progress bar
// ---------------------------------------------------------------------------

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-1 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Import status panel
// ---------------------------------------------------------------------------

function ImportStatusPanel() {
  const entries = useFileImportStore((s) => s.entries);
  const isImporting = useFileImportStore((s) => s.isImporting);
  const overallProgress = useFileImportStore((s) => s.overallProgress);
  const clearCompleted = useFileImportStore((s) => s.clearCompleted);
  const reset = useFileImportStore((s) => s.reset);

  if (entries.length === 0) return null;

  const doneCount = entries.filter((e) => e.status === 'done').length;
  const errorCount = entries.filter((e) => e.status === 'error').length;
  const totalCount = entries.length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {isImporting ? 'Importing files...' : 'Import complete'}
          </span>
          <span className="text-xs text-foreground-muted">
            {doneCount}/{totalCount}
            {errorCount > 0 && ` (${errorCount} failed)`}
          </span>
        </div>
        <button
          type="button"
          onClick={isImporting ? undefined : reset}
          disabled={isImporting}
          className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          aria-label="Close import panel"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.749.749 0 011.275.326.749.749 0 01-.215.734L9.06 8l3.22 3.22a.749.749 0 01-.326 1.275.749.749 0 01-.734-.215L8 9.06l-3.22 3.22a.751.751 0 01-1.042-.018.751.751 0 01-.018-1.042L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
          </svg>
        </button>
      </div>

      {/* Overall progress */}
      {isImporting && (
        <div className="px-3 py-1.5">
          <ProgressBar value={overallProgress} />
        </div>
      )}

      {/* File list */}
      <div className="max-h-48 overflow-y-auto">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="flex items-center gap-2 border-b border-border/50 px-3 py-1.5 last:border-b-0"
          >
            <FileTypeIcon fileType={entry.fileType} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-medium">{entry.fileName}</p>
              {entry.status === 'uploading' && <ProgressBar value={entry.progress} />}
              {entry.error && <p className="truncate text-xs text-destructive">{entry.error}</p>}
            </div>
            <StatusIndicator status={entry.status} />
          </div>
        ))}
      </div>

      {/* Footer actions */}
      {!isImporting && (doneCount > 0 || errorCount > 0) && (
        <div className="flex justify-end border-t border-border px-3 py-1.5">
          <button
            type="button"
            onClick={clearCompleted}
            className="text-xs text-primary hover:underline"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drop overlay
// ---------------------------------------------------------------------------

function DropOverlay({ isDragOver }: { isDragOver: boolean }) {
  if (!isDragOver) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-primary/50 bg-background/90 px-12 py-10">
        {/* Upload icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
        </div>

        <div className="text-center">
          <p className="text-lg font-semibold text-foreground">Drop files to import</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Markdown, text, images (PNG, JPG, GIF, SVG), and PDF
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function FileDropZone({
  children,
  className,
  disabled = false,
  ...importOptions
}: FileDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const { importFiles } = useFileImport(importOptions);

  // Use a counter to handle nested drag enter/leave events correctly.
  // The browser fires dragenter/dragleave on every child element.
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;

      if (dragCounterRef.current === 1) {
        // Check if the drag contains files
        if (e.dataTransfer.types.includes('Files')) {
          setIsDragOver(true);
        }
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current--;

      if (dragCounterRef.current === 0) {
        setIsDragOver(false);
      }
    },
    [disabled],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      // Set the drop effect to "copy" to show the + cursor
      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length === 0) return;

      // Filter to accepted files (validation errors are handled in the hook)
      importFiles(files);
    },
    [disabled, importFiles],
  );

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {children}
      <DropOverlay isDragOver={isDragOver} />
      <ImportStatusPanel />
    </div>
  );
}
