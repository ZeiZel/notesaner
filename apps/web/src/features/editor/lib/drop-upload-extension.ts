/**
 * drop-upload-extension.ts
 *
 * TipTap Extension for handling file drop and clipboard paste events in the editor.
 *
 * This extension intercepts:
 *   - File drops onto the editor (DragEvent with DataTransfer files)
 *   - Clipboard pastes containing image data (ClipboardEvent)
 *
 * When a file drop or image paste is detected, it calls the provided `onFiles`
 * callback with the list of File objects and the ProseMirror position at which
 * the drop occurred (or null for pastes). The caller (EditorDropZone) is
 * responsible for the actual upload and markdown insertion.
 *
 * Design decisions:
 *   - Extension does NOT upload directly — separation of concerns. Upload logic
 *     lives in the React layer so it can update UI state.
 *   - Returns `true` (handled) for drops containing files to prevent ProseMirror
 *     from processing them as text content.
 *   - Returns `true` for clipboard pastes containing image items.
 *   - Passes the drop position so the caller can insert the markdown link at the
 *     exact cursor location rather than at the current editor selection.
 *
 * Usage:
 *   import { DropUploadExtension } from '@/features/editor/lib/drop-upload-extension';
 *
 *   const editor = useEditor({
 *     extensions: [
 *       DropUploadExtension.configure({
 *         onFiles: (files, pos) => handleFilesFromEditor(files, pos),
 *       }),
 *       // ...other extensions
 *     ],
 *   });
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Image MIME types we handle from clipboard pastes. */
const CLIPBOARD_IMAGE_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
]);

/** File extensions accepted for file drops. */
const ACCEPTED_EXTENSIONS = new Set([
  'md',
  'txt',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'svg',
  'webp',
  'pdf',
]);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DropUploadOptions {
  /**
   * Called when files are dropped onto the editor or images are pasted.
   *
   * @param files  - The File objects from the drop/paste event.
   * @param pos    - ProseMirror document position at the drop point.
   *                 `null` when triggered by a clipboard paste (insert at
   *                 current selection head).
   */
  onFiles: (files: File[], pos: number | null) => void;

  /**
   * When true, the extension is disabled and events pass through normally.
   * @default false
   */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers (exported for testability)
// ---------------------------------------------------------------------------

/** @internal */
export function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex === -1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

/** Returns true if the file type is accepted by the extension. */
export function isAcceptedDropFile(file: File): boolean {
  // For clipboard pastes, check the MIME type
  if (CLIPBOARD_IMAGE_TYPES.has(file.type)) return true;
  // For drops, check the extension
  const ext = getFileExtension(file.name);
  return ACCEPTED_EXTENSIONS.has(ext);
}

/** Extracts image File objects from a ClipboardEvent's items. */
export function extractImageFilesFromClipboard(event: ClipboardEvent): File[] {
  const items = event.clipboardData?.items;
  if (!items) return [];

  const files: File[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item && item.kind === 'file' && CLIPBOARD_IMAGE_TYPES.has(item.type)) {
      const file = item.getAsFile();
      if (file) {
        // Give clipboard images a meaningful filename based on type
        const ext = item.type.split('/')[1] ?? 'png';
        const namedFile = new File([file], `pasted-image-${Date.now()}.${ext}`, {
          type: item.type,
        });
        files.push(namedFile);
      }
    }
  }
  return files;
}

// ---------------------------------------------------------------------------
// Plugin key for uniqueness
// ---------------------------------------------------------------------------

const dropUploadPluginKey = new PluginKey('dropUpload');

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * DropUploadExtension — TipTap Extension that intercepts file drops and
 * clipboard paste events, calling `onFiles` with the captured files and
 * the drop position.
 */
export const DropUploadExtension = Extension.create<DropUploadOptions>({
  name: 'dropUpload',

  addOptions() {
    return {
      onFiles: () => {},
      disabled: false,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: dropUploadPluginKey,

        props: {
          /**
           * Handle file drops onto the editor.
           *
           * ProseMirror calls this with the view, the event, and the document
           * position calculated from the mouse coordinates. Returning true
           * signals that we handled the event, preventing ProseMirror from
           * trying to insert the drag data as plain text.
           */
          handleDrop(view, event) {
            if (options.disabled) return false;

            const dragEvent = event as DragEvent;
            const files = dragEvent.dataTransfer?.files;
            if (!files || files.length === 0) return false;

            const acceptedFiles = Array.from(files).filter(isAcceptedDropFile);
            if (acceptedFiles.length === 0) return false;

            // Resolve ProseMirror position at the drop point.
            // posAtCoords returns { pos, inside } — we use pos as the insertion point.
            const coordinates = { left: dragEvent.clientX, top: dragEvent.clientY };
            const resolvedPos = view.posAtCoords(coordinates);
            const pos = resolvedPos?.pos ?? null;

            options.onFiles(acceptedFiles, pos);

            // Prevent ProseMirror default handling (would insert text representation)
            return true;
          },

          /**
           * Handle clipboard paste containing image data.
           *
           * Only handles pastes that have image items in the clipboard. Text
           * pastes are left for ProseMirror to process normally.
           */
          handlePaste(_view, event) {
            if (options.disabled) return false;

            const imageFiles = extractImageFilesFromClipboard(event);
            if (imageFiles.length === 0) return false;

            // Insert at current selection head
            options.onFiles(imageFiles, null);

            // Prevent ProseMirror from inserting the paste content
            return true;
          },
        },
      }),
    ];
  },
});
