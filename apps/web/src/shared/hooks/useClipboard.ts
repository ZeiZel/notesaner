'use client';

/**
 * useClipboard — React hook for clipboard operations with success feedback.
 *
 * Provides a `copy` function and a `copied` boolean that resets automatically
 * after a configurable timeout. Designed for use with CopyButton and inline
 * copy triggers throughout the UI.
 *
 * No useEffect for the timeout — uses the callback pattern from the copy
 * event handler to schedule the reset. The only effect is the cleanup of
 * a pending timeout on unmount.
 *
 * Usage:
 * ```tsx
 * const { copy, copied } = useClipboard({ resetMs: 2000 });
 *
 * <button onClick={() => copy('text to copy')}>
 *   {copied ? 'Copied!' : 'Copy'}
 * </button>
 * ```
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { copyText, copyRichText, copyCodeBlock } from '@/shared/lib/clipboard';

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
}

export interface UseClipboardReturn {
  /** Copy plain text to the clipboard. */
  copy: (text: string) => Promise<boolean>;

  /** Copy rich text (plain + HTML) to the clipboard. */
  copyRich: (plain: string, html: string) => Promise<boolean>;

  /** Copy a code block (with normalization). */
  copyCode: (code: string) => Promise<boolean>;

  /** True for `resetMs` milliseconds after a successful copy. */
  copied: boolean;

  /** True while a copy operation is in progress. */
  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { resetMs = 2000, onSuccess, onError } = options;

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

  const copy = useCallback(
    async (text: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const success = await copyText(text);
        if (success) {
          scheduleReset();
          onSuccess?.(text);
        } else {
          onError?.(new Error('Copy failed'));
        }
        return success;
      } catch (error) {
        onError?.(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleReset, onSuccess, onError],
  );

  const copyRich = useCallback(
    async (plain: string, html: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const success = await copyRichText(plain, html);
        if (success) {
          scheduleReset();
          onSuccess?.(plain);
        } else {
          onError?.(new Error('Rich copy failed'));
        }
        return success;
      } catch (error) {
        onError?.(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleReset, onSuccess, onError],
  );

  const copyCode = useCallback(
    async (code: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const success = await copyCodeBlock(code);
        if (success) {
          scheduleReset();
          onSuccess?.(code);
        } else {
          onError?.(new Error('Code copy failed'));
        }
        return success;
      } catch (error) {
        onError?.(error);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [scheduleReset, onSuccess, onError],
  );

  return { copy, copyRich, copyCode, copied, isLoading };
}
