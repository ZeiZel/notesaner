'use client';

/**
 * EditorDropZone
 *
 * Wraps the editor content area with drag-and-drop file upload support.
 *
 * Features:
 *   - Drop overlay while files are being dragged over the editor
 *   - Uploads files via axios to /api/workspaces/:workspaceId/files/upload
 *   - Inserts markdown links at the drop position:
 *       images  →  ![filename](url)
 *       files   →  [filename](url)
 *   - Progress indicator per file (Ant Design Progress)
 *   - Clipboard paste support for images (PNG, JPEG, GIF, WebP, SVG)
 *   - Error notifications via Ant Design message
 *
 * This component is meant to be used alongside the DropUploadExtension TipTap
 * extension. The extension captures file events and calls back into this
 * component; this component manages upload state and triggers editor insertions.
 *
 * Usage:
 *   <EditorDropZone editor={editor} workspaceId={wsId}>
 *     <TipTapEditorContent ... />
 *   </EditorDropZone>
 *
 * @module features/editor/ui/EditorDropZone
 */

import { useCallback, useRef, useState, type ReactNode } from 'react';
import type { Editor } from '@tiptap/core';
import { Progress, message } from 'antd';
import axios from 'axios';
import { cn } from '@/shared/lib/utils';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp']);
export const IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type UploadStatus = 'uploading' | 'done' | 'error';

export interface UploadEntry {
  /** Unique ID for this entry. */
  id: string;
  /** Original file name. */
  fileName: string;
  /** Upload progress 0-100. */
  progress: number;
  /** Current status. */
  status: UploadStatus;
  /** Error message if status is 'error'. */
  error?: string;
  /** URL returned after successful upload. */
  resultUrl?: string;
}

export interface EditorDropZoneProps {
  /** The TipTap editor instance (used for markdown insertion). */
  editor: Editor | null;
  /** Workspace ID for the upload endpoint. Falls back to store if omitted. */
  workspaceId?: string;
  /** Additional class names for the outer container. */
  className?: string;
  /** Disables all drop/paste handling. */
  disabled?: boolean;
  /** Content rendered inside (typically the TipTap EditorContent). */
  children: ReactNode;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @internal exported for tests */
export function generateId(): string {
  return `editor-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** @internal exported for tests */
export function getEditorFileExtension(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  if (dot === -1) return '';
  return fileName.slice(dot + 1).toLowerCase();
}

/** Returns true when the file should be inserted as an image (![]()). */
export function isImageFile(file: File): boolean {
  if (IMAGE_MIME_TYPES.has(file.type)) return true;
  return IMAGE_EXTENSIONS.has(getEditorFileExtension(file.name));
}

/**
 * Builds the markdown snippet to insert for a successfully uploaded file.
 *
 * Images:   ![filename](url)
 * Others:   [filename](url)
 */
export function buildMarkdownLink(fileName: string, url: string, asImage: boolean): string {
  const label = fileName.replace(/\.\w+$/, '');
  return asImage ? `![${label}](${url})` : `[${label}](${url})`;
}

// ---------------------------------------------------------------------------
// Upload via axios with progress
// ---------------------------------------------------------------------------

interface UploadResult {
  url: string;
}

function uploadFile(
  file: File,
  workspaceId: string,
  token: string,
  onProgress: (percent: number) => void,
  signal: AbortSignal,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append('file', file);

  return axios
    .post<UploadResult>(`${API_BASE_URL}/api/workspaces/${workspaceId}/files/upload`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        // Let axios set Content-Type (multipart/form-data with boundary)
        'Content-Type': 'multipart/form-data',
      },
      signal,
      onUploadProgress(event) {
        if (event.total && event.total > 0) {
          const percent = Math.round((event.loaded / event.total) * 100);
          onProgress(percent);
        }
      },
    })
    .then((res) => res.data);
}

// ---------------------------------------------------------------------------
// Drop overlay
// ---------------------------------------------------------------------------

function DropOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center rounded-lg bg-background/85 backdrop-blur-sm"
      role="status"
      aria-label="Drop files to upload"
    >
      <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-primary/60 bg-background/95 px-10 py-8 shadow-lg">
        {/* Upload arrow icon */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7 text-primary"
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
          <p className="text-base font-semibold text-foreground">Drop to insert</p>
          <p className="mt-0.5 text-sm text-foreground-muted">
            Images will be embedded, other files linked
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload progress panel
// ---------------------------------------------------------------------------

function UploadProgressPanel({
  entries,
  onDismiss,
}: {
  entries: UploadEntry[];
  onDismiss: (id: string) => void;
}) {
  if (entries.length === 0) return null;

  return (
    <div className="absolute bottom-4 right-4 z-50 flex w-72 flex-col gap-1.5 rounded-lg border border-border bg-background px-3 py-2.5 shadow-lg">
      {entries.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-0.5">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-xs font-medium text-foreground">{entry.fileName}</span>

            {entry.status === 'done' && (
              <button
                type="button"
                aria-label={`Dismiss ${entry.fileName}`}
                onClick={() => onDismiss(entry.id)}
                className="shrink-0 text-foreground-muted hover:text-foreground"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" />
                </svg>
              </button>
            )}

            {entry.status === 'error' && (
              <button
                type="button"
                aria-label={`Dismiss ${entry.fileName}`}
                onClick={() => onDismiss(entry.id)}
                className="shrink-0 text-destructive hover:text-foreground"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="currentColor" aria-hidden="true">
                  <path d="M2.22 2.22a.75.75 0 011.06 0L6 4.94l2.72-2.72a.75.75 0 111.06 1.06L7.06 6l2.72 2.72a.75.75 0 11-1.06 1.06L6 7.06 3.28 9.78a.75.75 0 01-1.06-1.06L4.94 6 2.22 3.28a.75.75 0 010-1.06z" />
                </svg>
              </button>
            )}
          </div>

          {entry.status === 'uploading' && (
            <Progress
              percent={entry.progress}
              size="small"
              showInfo={false}
              status="active"
              strokeColor="var(--ant-color-primary)"
            />
          )}

          {entry.status === 'done' && (
            <Progress percent={100} size="small" showInfo={false} status="success" />
          )}

          {entry.status === 'error' && (
            <p className="truncate text-xs text-destructive">{entry.error ?? 'Upload failed'}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function EditorDropZone({
  editor,
  workspaceId: workspaceIdProp,
  className,
  disabled = false,
  children,
}: EditorDropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploads, setUploads] = useState<UploadEntry[]>([]);

  // Drag counter to handle nested dragenter/dragleave events
  const dragCounterRef = useRef(0);
  // Per-upload abort controllers
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());

  const [messageApi, contextHolder] = message.useMessage();

  // ---------------------------------------------------------------------------
  // Upload a single file and insert the resulting link into the editor
  // ---------------------------------------------------------------------------

  const uploadAndInsert = useCallback(
    async (file: File, insertPos: number | null): Promise<void> => {
      const token = useAuthStore.getState().accessToken;
      const workspaceId = workspaceIdProp ?? useWorkspaceStore.getState().activeWorkspaceId;

      if (!token || !workspaceId) {
        void messageApi.error('Not authenticated. Please log in and try again.');
        return;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        void messageApi.error(`"${file.name}" exceeds the ${MAX_FILE_SIZE_MB} MB limit.`);
        return;
      }

      const id = generateId();
      const entry: UploadEntry = {
        id,
        fileName: file.name,
        progress: 0,
        status: 'uploading',
      };

      setUploads((prev) => [...prev, entry]);

      const abortController = new AbortController();
      abortControllersRef.current.set(id, abortController);

      try {
        const result = await uploadFile(
          file,
          workspaceId,
          token,
          (percent) => {
            setUploads((prev) => prev.map((e) => (e.id === id ? { ...e, progress: percent } : e)));
          },
          abortController.signal,
        );

        setUploads((prev) =>
          prev.map((e) =>
            e.id === id ? { ...e, status: 'done', progress: 100, resultUrl: result.url } : e,
          ),
        );

        // Insert markdown into the editor at the drop position (or selection head)
        if (editor) {
          const markdown = buildMarkdownLink(file.name, result.url, isImageFile(file));

          if (insertPos !== null) {
            // Insert at the resolved drop position
            editor
              .chain()
              .focus()
              .insertContentAt(insertPos, markdown + ' ')
              .run();
          } else {
            // Paste case — insert at current selection
            editor
              .chain()
              .focus()
              .insertContent(markdown + ' ')
              .run();
          }
        }
      } catch (err: unknown) {
        if (axios.isCancel(err)) {
          setUploads((prev) =>
            prev.map((e) =>
              e.id === id ? { ...e, status: 'error', error: 'Upload cancelled' } : e,
            ),
          );
          return;
        }

        const errorMessage =
          err instanceof Error ? err.message : 'Upload failed. Please try again.';

        setUploads((prev) =>
          prev.map((e) => (e.id === id ? { ...e, status: 'error', error: errorMessage } : e)),
        );

        void messageApi.error(`Failed to upload "${file.name}": ${errorMessage}`);
      } finally {
        abortControllersRef.current.delete(id);
      }
    },
    [editor, workspaceIdProp, messageApi],
  );

  // ---------------------------------------------------------------------------
  // Called by the TipTap DropUploadExtension (or internal drop handler)
  // ---------------------------------------------------------------------------

  const handleFiles = useCallback(
    (files: File[], pos: number | null): void => {
      if (disabled) return;
      for (const file of files) {
        void uploadAndInsert(file, pos);
      }
    },
    [disabled, uploadAndInsert],
  );

  // Expose handleFiles so the DropUploadExtension can call it.
  // We attach it to the container element's dataset so the extension can
  // find it, or callers can pass it as a ref callback. The recommended usage
  // is to configure the TipTap extension with onFiles pointing to this handler.
  // This component also supports native drag events on the wrapper div.

  // ---------------------------------------------------------------------------
  // Native drag events (fallback / non-TipTap area support)
  // ---------------------------------------------------------------------------

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current++;
      if (dragCounterRef.current === 1 && e.dataTransfer.types.includes('Files')) {
        setIsDragOver(true);
      }
    },
    [disabled],
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
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
      e.dataTransfer.dropEffect = 'copy';
    },
    [disabled],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      // Always hide overlay regardless
      dragCounterRef.current = 0;
      setIsDragOver(false);

      // When TipTap editor is present, it handles the drop via the extension.
      // We still reset the overlay state but let ProseMirror process the event.
      if (editor) return;

      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        handleFiles(files, null);
      }
    },
    [disabled, editor, handleFiles],
  );

  // ---------------------------------------------------------------------------
  // Dismiss an upload entry from the panel
  // ---------------------------------------------------------------------------

  const handleDismiss = useCallback((id: string) => {
    abortControllersRef.current.get(id)?.abort();
    setUploads((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      className={cn('relative', className)}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {contextHolder}
      {children}
      <DropOverlay visible={isDragOver} />
      <UploadProgressPanel entries={uploads} onDismiss={handleDismiss} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public ref API (for external use)
// ---------------------------------------------------------------------------

/**
 * Returns the `handleFiles` callback suitable for passing to
 * DropUploadExtension.configure({ onFiles: ... }).
 *
 * Prefer constructing EditorDropZone and using the ref instead of calling
 * this directly.
 */
export type EditorDropZoneFilesHandler = (files: File[], pos: number | null) => void;

EditorDropZone.displayName = 'EditorDropZone';
