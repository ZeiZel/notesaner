'use client';

/**
 * useQuickCapture -- orchestrates the quick capture workflow.
 *
 * Manages save operations (new note / daily note append), URL title
 * extraction, and auto-save scheduling. All side effects are triggered
 * from event handlers -- no useEffect for business logic.
 */

import { useRef, useCallback } from 'react';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import { quickCaptureApi } from '@/shared/api/quick-capture';
import { useQuickCaptureStore } from '../model/quick-capture-store';

// ---------------------------------------------------------------------------
// URL detection helpers
// ---------------------------------------------------------------------------

const URL_REGEX = /^https?:\/\/[^\s]+$/;

function isUrl(text: string): boolean {
  return URL_REGEX.test(text.trim());
}

// ---------------------------------------------------------------------------
// Title generation helper
// ---------------------------------------------------------------------------

function generateTitleFromContent(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';
  const withoutHeading = firstLine.replace(/^#{1,6}\s+/, '');

  if (withoutHeading.length > 60) {
    return withoutHeading.substring(0, 57) + '...';
  }

  return (
    withoutHeading ||
    `Quick note ${new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })}`
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useQuickCapture() {
  const store = useQuickCaptureStore();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const accessToken = useAuthStore((s) => s.accessToken);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Save the current capture as a new note via the quick-capture endpoint.
   */
  const saveAsNewNote = useCallback(async () => {
    if (!workspaceId || !accessToken) return;

    const state = useQuickCaptureStore.getState();
    if (!state.content.trim() && !state.title.trim()) return;

    store.setIsSaving(true);
    store.setSaveError(null);

    try {
      const response = await quickCaptureApi.capture(accessToken, workspaceId, {
        title: state.title.trim() || generateTitleFromContent(state.content),
        content: state.content,
        folderId: state.targetFolderId || undefined,
        tags: state.tags.length > 0 ? state.tags : undefined,
      });

      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note';
      store.setSaveError(message);
      throw error;
    } finally {
      store.setIsSaving(false);
    }
  }, [workspaceId, accessToken, store]);

  /**
   * Save based on current capture mode.
   * For daily-note mode, falls back to new-note since the daily-note
   * endpoint may not exist yet.
   */
  const save = useCallback(async () => {
    return saveAsNewNote();
  }, [saveAsNewNote]);

  /**
   * Cancel any pending auto-save timer.
   */
  const cancelAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
  }, []);

  /**
   * Handle content changes. If the pasted content looks like a URL,
   * attempt to extract a title from it.
   */
  const handleContentChange = useCallback(
    (content: string) => {
      store.setContent(content);

      // If the content looks like a single URL and there's no title yet,
      // auto-extract the page title in the background.
      const currentTitle = useQuickCaptureStore.getState().title;
      if (isUrl(content) && !currentTitle && workspaceId && accessToken) {
        quickCaptureApi
          .extractUrlTitle(accessToken, workspaceId, content.trim())
          .then((result) => {
            if (result?.title) {
              // Only set if user hasn't typed a title in the meantime
              const titleNow = useQuickCaptureStore.getState().title;
              if (!titleNow) {
                store.setTitle(result.title);
              }
            }
          })
          .catch(() => {
            // URL preview is best-effort, never block capture
          });
      }
    },
    [store, workspaceId, accessToken],
  );

  /**
   * Handle paste events -- detect URLs and trigger title extraction.
   */
  const handlePaste = useCallback(
    (pastedText: string) => {
      if (isUrl(pastedText) && workspaceId && accessToken) {
        const currentTitle = useQuickCaptureStore.getState().title;
        if (!currentTitle) {
          quickCaptureApi
            .extractUrlTitle(accessToken, workspaceId, pastedText.trim())
            .then((result) => {
              if (result?.title) {
                const titleNow = useQuickCaptureStore.getState().title;
                if (!titleNow) {
                  store.setTitle(result.title);
                }
              }
            })
            .catch(() => {
              // Best-effort
            });
        }
      }
    },
    [store, workspaceId, accessToken],
  );

  /**
   * Save and close the modal.
   */
  const saveAndClose = useCallback(async () => {
    cancelAutoSave();
    try {
      await save();
      store.resetCapture();
      store.close();
    } catch {
      // Error is in store -- modal stays open for the user to retry
    }
  }, [cancelAutoSave, save, store]);

  /**
   * Discard and close the modal.
   */
  const discardAndClose = useCallback(() => {
    cancelAutoSave();
    store.resetCapture();
    store.close();
  }, [cancelAutoSave, store]);

  return {
    // State
    isOpen: store.isOpen,
    content: store.content,
    title: store.title,
    tags: store.tags,
    targetFolderId: store.targetFolderId,
    captureMode: store.captureMode,
    isSaving: store.isSaving,
    saveError: store.saveError,

    // Setters
    setTitle: store.setTitle,
    setTags: store.setTags,
    addTag: store.addTag,
    removeTag: store.removeTag,
    setTargetFolderId: store.setTargetFolderId,
    setCaptureMode: store.setCaptureMode,

    // Actions
    open: store.open,
    close: store.close,
    handleContentChange,
    handlePaste,
    save,
    saveAndClose,
    discardAndClose,
  };
}
