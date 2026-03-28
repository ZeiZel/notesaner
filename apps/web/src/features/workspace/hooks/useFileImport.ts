'use client';

/**
 * useFileImport -- hook for importing files via drag-and-drop into a workspace.
 *
 * Handles:
 *   - File validation (type, size)
 *   - Upload progress tracking per file
 *   - Markdown file detection and note creation
 *   - Image upload to workspace storage with link insertion
 *   - Batch imports with concurrency control
 *
 * Supported file types:
 *   .md, .txt  -- treated as note content
 *   .png, .jpg, .jpeg, .gif, .svg -- uploaded as images
 *   .pdf       -- uploaded as attachment
 *
 * @module features/workspace/hooks/useFileImport
 */

import { useCallback, useRef } from 'react';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE_MB = 50;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const MAX_CONCURRENT_UPLOADS = 3;

const ACCEPTED_EXTENSIONS = new Set(['md', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'svg', 'pdf']);

const NOTE_EXTENSIONS = new Set(['md', 'txt']);
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg']);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ImportFileStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error';

export interface ImportFileEntry {
  /** Unique ID for this import entry. */
  id: string;
  /** Original file name. */
  fileName: string;
  /** File size in bytes. */
  fileSize: number;
  /** Detected file type category. */
  fileType: 'note' | 'image' | 'attachment';
  /** Current status. */
  status: ImportFileStatus;
  /** Upload progress 0-100. */
  progress: number;
  /** Error message if status is 'error'. */
  error?: string;
  /** Resulting URL after upload (for images/attachments). */
  resultUrl?: string;
  /** Resulting note ID if a note was created. */
  resultNoteId?: string;
}

interface FileImportState {
  /** All file entries in the current import batch. */
  entries: ImportFileEntry[];
  /** Whether an import batch is currently active. */
  isImporting: boolean;
  /** Overall progress 0-100 for the entire batch. */
  overallProgress: number;

  // Actions
  startBatch: (entries: ImportFileEntry[]) => void;
  updateEntry: (id: string, patch: Partial<ImportFileEntry>) => void;
  clearCompleted: () => void;
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFileImportStore = create<FileImportState>()(
  devtools(
    (set) => ({
      entries: [],
      isImporting: false,
      overallProgress: 0,

      startBatch: (entries) =>
        set({ entries, isImporting: true, overallProgress: 0 }, false, 'fileImport/startBatch'),

      updateEntry: (id, patch) =>
        set(
          (state) => {
            const entries = state.entries.map((e) => (e.id === id ? { ...e, ...patch } : e));
            const totalProgress = entries.reduce((sum, e) => sum + e.progress, 0);
            const overallProgress =
              entries.length > 0 ? Math.round(totalProgress / entries.length) : 0;
            const allDone = entries.every((e) => e.status === 'done' || e.status === 'error');
            return {
              entries,
              overallProgress,
              isImporting: !allDone,
            };
          },
          false,
          'fileImport/updateEntry',
        ),

      clearCompleted: () =>
        set(
          (state) => ({
            entries: state.entries.filter((e) => e.status !== 'done' && e.status !== 'error'),
          }),
          false,
          'fileImport/clearCompleted',
        ),

      reset: () =>
        set({ entries: [], isImporting: false, overallProgress: 0 }, false, 'fileImport/reset'),
    }),
    { name: 'FileImportStore' },
  ),
);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function classifyFile(ext: string): 'note' | 'image' | 'attachment' {
  if (NOTE_EXTENSIONS.has(ext)) return 'note';
  if (IMAGE_EXTENSIONS.has(ext)) return 'image';
  return 'attachment';
}

function generateEntryId(): string {
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ValidatedFile {
  file: File;
  entry: ImportFileEntry;
}

function validateFiles(files: File[]): {
  valid: ValidatedFile[];
  rejected: ImportFileEntry[];
} {
  const valid: ValidatedFile[] = [];
  const rejected: ImportFileEntry[] = [];

  for (const file of files) {
    const ext = getFileExtension(file.name);
    const id = generateEntryId();

    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      rejected.push({
        id,
        fileName: file.name,
        fileSize: file.size,
        fileType: 'attachment',
        status: 'error',
        progress: 0,
        error: `Unsupported file type: .${ext}. Accepted: ${Array.from(ACCEPTED_EXTENSIONS)
          .map((e) => `.${e}`)
          .join(', ')}`,
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      rejected.push({
        id,
        fileName: file.name,
        fileSize: file.size,
        fileType: classifyFile(ext),
        status: 'error',
        progress: 0,
        error: `File too large (${Math.round(file.size / 1024 / 1024)}MB). Maximum: ${MAX_FILE_SIZE_MB}MB`,
      });
      continue;
    }

    valid.push({
      file,
      entry: {
        id,
        fileName: file.name,
        fileSize: file.size,
        fileType: classifyFile(ext),
        status: 'pending',
        progress: 0,
      },
    });
  }

  return { valid, rejected };
}

// ---------------------------------------------------------------------------
// Upload functions
// ---------------------------------------------------------------------------

/**
 * Uploads a file using XMLHttpRequest to track progress.
 * Returns the response body parsed as JSON.
 */
function uploadFileWithProgress(
  url: string,
  file: File,
  token: string,
  targetPath: string,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
): Promise<{ url?: string; noteId?: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    if (signal) {
      signal.addEventListener('abort', () => {
        xhr.abort();
        reject(new DOMException('Upload aborted', 'AbortError'));
      });
    }

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        onProgress(percent);
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText) as { url?: string; noteId?: string };
          resolve(data);
        } catch {
          resolve({});
        }
      } else {
        let errorMessage = `Upload failed (HTTP ${xhr.status})`;
        try {
          const errorData = JSON.parse(xhr.responseText) as { message?: string };
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Ignore parse error
        }
        reject(new Error(errorMessage));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new DOMException('Upload aborted', 'AbortError'));
    });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('targetPath', targetPath);

    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  });
}

/**
 * Reads a text file and creates a note via API.
 */
async function createNoteFromFile(
  file: File,
  workspaceId: string,
  token: string,
  targetPath: string,
  onProgress: (percent: number) => void,
): Promise<{ noteId: string }> {
  onProgress(10);

  const content = await file.text();
  onProgress(30);

  const title = file.name.replace(/\.(md|txt)$/, '');
  const notePath = targetPath ? `${targetPath}/${title}.md` : `${title}.md`;

  onProgress(50);

  const response = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      title,
      path: notePath,
      content,
    }),
  });

  onProgress(90);

  if (!response.ok) {
    let errorMessage = `Failed to create note (HTTP ${response.status})`;
    try {
      const errorData = (await response.json()) as { message?: string };
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore parse error
    }
    throw new Error(errorMessage);
  }

  const data = (await response.json()) as { id: string };
  onProgress(100);

  return { noteId: data.id };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseFileImportOptions {
  /** Target folder path within the workspace (e.g. "Projects/2026"). */
  targetPath?: string;
  /**
   * Callback invoked when an image is successfully uploaded.
   * Useful for inserting a markdown image link into an open editor.
   */
  onImageUploaded?: (fileName: string, url: string) => void;
  /** Callback invoked when a note is successfully created from an imported file. */
  onNoteCreated?: (noteId: string, fileName: string) => void;
  /** Callback invoked when the entire batch completes. */
  onBatchComplete?: (results: ImportFileEntry[]) => void;
}

export interface UseFileImportReturn {
  /** Import an array of files. Typically called from a drop handler. */
  importFiles: (files: File[]) => void;
  /** Cancel all pending/active uploads. */
  cancelAll: () => void;
  /** Whether files are accepted based on extension. */
  isAcceptedFile: (file: File) => boolean;
  /** Current import state from the store. */
  entries: ImportFileEntry[];
  isImporting: boolean;
  overallProgress: number;
  /** Clear completed/errored entries from the list. */
  clearCompleted: () => void;
}

export function useFileImport(options: UseFileImportOptions = {}): UseFileImportReturn {
  const { targetPath = '', onImageUploaded, onNoteCreated, onBatchComplete } = options;

  const abortControllerRef = useRef<AbortController | null>(null);

  const entries = useFileImportStore((s) => s.entries);
  const isImporting = useFileImportStore((s) => s.isImporting);
  const overallProgress = useFileImportStore((s) => s.overallProgress);

  const isAcceptedFile = useCallback((file: File): boolean => {
    const ext = getFileExtension(file.name);
    return ACCEPTED_EXTENSIONS.has(ext);
  }, []);

  const importFiles = useCallback(
    (files: File[]) => {
      const rawToken = useAuthStore.getState().accessToken;
      const rawWorkspaceId = useWorkspaceStore.getState().activeWorkspaceId;

      if (!rawToken || !rawWorkspaceId) {
        return;
      }

      // Narrow for use in closures below
      const token: string = rawToken;
      const workspaceId: string = rawWorkspaceId;

      const { valid, rejected } = validateFiles(files);

      if (valid.length === 0 && rejected.length === 0) {
        return;
      }

      const allEntries = [...valid.map((v) => v.entry), ...rejected];

      useFileImportStore.getState().startBatch(allEntries);

      // Set up abort controller for this batch
      abortControllerRef.current?.abort();
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Process valid files with concurrency control
      const queue = [...valid];
      let activeCount = 0;

      function processNext() {
        if (abortController.signal.aborted) return;
        if (queue.length === 0) {
          if (activeCount === 0) {
            // Batch complete
            const finalEntries = useFileImportStore.getState().entries;
            onBatchComplete?.(finalEntries);
          }
          return;
        }
        if (activeCount >= MAX_CONCURRENT_UPLOADS) return;

        const item = queue.shift();
        if (!item) return;

        activeCount++;
        const { file, entry } = item;
        const { updateEntry } = useFileImportStore.getState();

        updateEntry(entry.id, { status: 'uploading' });

        const onProgress = (percent: number) => {
          updateEntry(entry.id, { progress: percent });
        };

        let uploadPromise: Promise<void>;

        if (entry.fileType === 'note') {
          uploadPromise = createNoteFromFile(file, workspaceId, token, targetPath, onProgress).then(
            (result) => {
              updateEntry(entry.id, {
                status: 'done',
                progress: 100,
                resultNoteId: result.noteId,
              });
              onNoteCreated?.(result.noteId, entry.fileName);
            },
          );
        } else {
          const uploadUrl = `${API_BASE_URL}/api/workspaces/${workspaceId}/files/upload`;
          uploadPromise = uploadFileWithProgress(
            uploadUrl,
            file,
            token,
            targetPath,
            onProgress,
            abortController.signal,
          ).then((result) => {
            updateEntry(entry.id, {
              status: 'done',
              progress: 100,
              resultUrl: result.url,
            });
            if (entry.fileType === 'image' && result.url) {
              onImageUploaded?.(entry.fileName, result.url);
            }
          });
        }

        uploadPromise
          .catch((err: unknown) => {
            if (err instanceof DOMException && err.name === 'AbortError') {
              updateEntry(entry.id, {
                status: 'error',
                error: 'Upload cancelled',
              });
              return;
            }
            const message = err instanceof Error ? err.message : 'Unknown error';
            updateEntry(entry.id, {
              status: 'error',
              error: message,
            });
          })
          .finally(() => {
            activeCount--;
            processNext();
          });

        // Try to fill up to MAX_CONCURRENT_UPLOADS
        processNext();
      }

      // Kick off the queue
      processNext();
    },
    [targetPath, onImageUploaded, onNoteCreated, onBatchComplete],
  );

  const cancelAll = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    const { entries: currentEntries } = useFileImportStore.getState();
    for (const entry of currentEntries) {
      if (entry.status === 'pending' || entry.status === 'uploading') {
        useFileImportStore.getState().updateEntry(entry.id, {
          status: 'error',
          error: 'Upload cancelled',
        });
      }
    }
  }, []);

  const clearCompleted = useFileImportStore((s) => s.clearCompleted);

  return {
    importFiles,
    cancelAll,
    isAcceptedFile,
    entries,
    isImporting,
    overallProgress,
    clearCompleted,
  };
}
