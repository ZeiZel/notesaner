'use client';

/**
 * useClipboard -- React hook for clipboard operations with Ant Design message feedback.
 *
 * Provides typed copy functions for all clipboard use cases in Notesaner:
 *   - Plain text, rich text, code blocks
 *   - Note links, block references, share links
 *   - Markdown content, frontmatter YAML, note paths
 *
 * Every copy action displays an Ant Design message (toast) on success or error.
 * The `copied` boolean resets after a configurable timeout for inline indicators.
 *
 * No useEffect for the timeout -- uses the callback pattern from the copy
 * event handler to schedule the reset. The only effect is the cleanup of
 * a pending timeout on unmount.
 *
 * Usage:
 * ```tsx
 * const { copy, copyNoteAsLink, copyNoteFrontmatter, copied } = useClipboard();
 *
 * <button onClick={() => copyNoteAsLink('My Note', '/share/abc')}>
 *   {copied ? 'Copied!' : 'Copy Link'}
 * </button>
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { message } from 'antd';
import {
  copyText,
  copyRichText,
  copyCodeBlock,
  copyNoteLink,
  copyBlockReference,
  copyMarkdownContent,
  copyShareLink,
  copyFrontmatterAsYaml,
  copyNotePath,
} from '@/shared/lib/clipboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseClipboardOptions {
  /**
   * Duration in ms before the `copied` state resets to false.
   * @default 2000
   */
  resetMs?: number;

  /** Optional callback fired after a successful copy. */
  onSuccess?: (text: string) => void;

  /** Optional callback fired after a failed copy. */
  onError?: (error: unknown) => void;

  /**
   * When true, suppress Ant Design message toasts.
   * Useful for components that handle feedback themselves (e.g. CodeBlockView).
   * @default false
   */
  silent?: boolean;
}

export interface UseClipboardReturn {
  /** Copy plain text to the clipboard. */
  copy: (text: string) => Promise<boolean>;

  /** Copy rich text (plain + HTML) to the clipboard. */
  copyRich: (plain: string, html: string) => Promise<boolean>;

  /** Copy a code block (with normalization). */
  copyCode: (code: string) => Promise<boolean>;

  /** Copy a note link as [[Title]] with optional URL for rich paste. */
  copyNoteAsLink: (noteTitle: string, noteUrl?: string) => Promise<boolean>;

  /** Copy a block reference as [[Title#^blockId]]. */
  copyBlockRef: (noteTitle: string, blockId: string, noteUrl?: string) => Promise<boolean>;

  /** Copy note content as Markdown. */
  copyMarkdown: (markdown: string) => Promise<boolean>;

  /** Copy a share link URL. */
  copyShare: (url: string, noteTitle?: string) => Promise<boolean>;

  /** Copy frontmatter as YAML string. */
  copyFrontmatter: (yaml: string) => Promise<boolean>;

  /** Copy a note's file path (Cmd+Shift+C). */
  copyPath: (path: string) => Promise<boolean>;

  /** True for `resetMs` milliseconds after a successful copy. */
  copied: boolean;

  /** True while a copy operation is in progress. */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { resetMs = 2000, onSuccess, onError, silent = false } = options;

  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup pending timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const scheduleReset = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
    }
    setCopied(true);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      timeoutRef.current = null;
    }, resetMs);
  }, [resetMs]);

  /**
   * Wraps a clipboard operation with loading state, success/error callbacks,
   * and Ant Design message toast feedback.
   */
  const withFeedback = useCallback(
    async (
      operation: () => Promise<boolean>,
      successMessage: string,
      errorMessage: string,
      feedbackText?: string,
    ): Promise<boolean> => {
      setIsLoading(true);
      try {
        const success = await operation();
        if (success) {
          scheduleReset();
          if (!silent) {
            void message.success(successMessage);
          }
          onSuccess?.(feedbackText ?? '');
        } else {
          if (!silent) {
            void message.error(errorMessage);
          }
          onError?.(new Error(errorMessage));
        }
        return success;
      } catch (error) {
        if (!silent) {
          void message.error(errorMessage);
        }
        onError?.(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleReset, onSuccess, onError, silent],
  );

  // -------------------------------------------------------------------------
  // Copy functions
  // -------------------------------------------------------------------------

  const copy = useCallback(
    (text: string) =>
      withFeedback(
        () => copyText(text),
        'Copied to clipboard',
        'Failed to copy to clipboard',
        text,
      ),
    [withFeedback],
  );

  const copyRich = useCallback(
    (plain: string, html: string) =>
      withFeedback(
        () => copyRichText(plain, html),
        'Copied to clipboard',
        'Failed to copy rich text',
        plain,
      ),
    [withFeedback],
  );

  const copyCode = useCallback(
    (code: string) =>
      withFeedback(
        () => copyCodeBlock(code),
        'Code copied to clipboard',
        'Failed to copy code',
        code,
      ),
    [withFeedback],
  );

  const copyNoteAsLink = useCallback(
    (noteTitle: string, noteUrl?: string) =>
      withFeedback(
        () => copyNoteLink(noteTitle, noteUrl),
        'Note link copied',
        'Failed to copy note link',
        `[[${noteTitle}]]`,
      ),
    [withFeedback],
  );

  const copyBlockRef = useCallback(
    (noteTitle: string, blockId: string, noteUrl?: string) =>
      withFeedback(
        () => copyBlockReference(noteTitle, blockId, noteUrl),
        'Block reference copied',
        'Failed to copy block reference',
        `[[${noteTitle}#^${blockId}]]`,
      ),
    [withFeedback],
  );

  const copyMarkdown = useCallback(
    (markdown: string) =>
      withFeedback(
        () => copyMarkdownContent(markdown),
        'Markdown content copied',
        'Failed to copy markdown',
        markdown,
      ),
    [withFeedback],
  );

  const copyShare = useCallback(
    (url: string, noteTitle?: string) =>
      withFeedback(
        () => copyShareLink(url, noteTitle),
        'Share link copied',
        'Failed to copy share link',
        url,
      ),
    [withFeedback],
  );

  const copyFrontmatter = useCallback(
    (yaml: string) =>
      withFeedback(
        () => copyFrontmatterAsYaml(yaml),
        'Frontmatter copied as YAML',
        'Failed to copy frontmatter',
        yaml,
      ),
    [withFeedback],
  );

  const copyPath = useCallback(
    (path: string) =>
      withFeedback(() => copyNotePath(path), 'Note path copied', 'Failed to copy note path', path),
    [withFeedback],
  );

  return {
    copy,
    copyRich,
    copyCode,
    copyNoteAsLink,
    copyBlockRef,
    copyMarkdown,
    copyShare,
    copyFrontmatter,
    copyPath,
    copied,
    isLoading,
  };
}
