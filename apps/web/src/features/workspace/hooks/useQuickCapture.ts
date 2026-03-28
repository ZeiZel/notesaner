import { useRef, useCallback } from 'react';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { apiClient } from '@/shared/api/client';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureMode = 'new-note' | 'daily-note';

export interface QuickCaptureState {
  // Modal state
  isOpen: boolean;

  // Content
  content: string;
  title: string;
  tags: string[];
  targetFolder: string;
  captureMode: CaptureMode;

  // Preferences (persisted)
  defaultFolder: string;
  defaultMode: CaptureMode;

  // Operation state
  isSaving: boolean;
  saveError: string | null;
  lastSavedAt: string | null;

  // Actions
  setOpen: (open: boolean) => void;
  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setTargetFolder: (folder: string) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setDefaultFolder: (folder: string) => void;
  setDefaultMode: (mode: CaptureMode) => void;
  setIsSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
  setLastSavedAt: (timestamp: string | null) => void;
  resetCapture: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useQuickCaptureStore = create<QuickCaptureState>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state
        isOpen: false,
        content: '',
        title: '',
        tags: [],
        targetFolder: '',
        captureMode: 'new-note',
        defaultFolder: '',
        defaultMode: 'new-note',
        isSaving: false,
        saveError: null,
        lastSavedAt: null,

        // Actions
        setOpen: (isOpen) => {
          if (isOpen) {
            // Restore defaults when opening
            const state = get();
            set(
              {
                isOpen,
                targetFolder: state.defaultFolder,
                captureMode: state.defaultMode,
                content: '',
                title: '',
                tags: [],
                saveError: null,
                lastSavedAt: null,
              },
              false,
              'quickCapture/open',
            );
          } else {
            set({ isOpen }, false, 'quickCapture/close');
          }
        },

        setContent: (content) => set({ content }, false, 'quickCapture/setContent'),
        setTitle: (title) => set({ title }, false, 'quickCapture/setTitle'),
        setTags: (tags) => set({ tags }, false, 'quickCapture/setTags'),

        addTag: (tag) =>
          set(
            (state) => {
              const trimmed = tag.trim();
              if (!trimmed || state.tags.includes(trimmed)) return state;
              return { tags: [...state.tags, trimmed] };
            },
            false,
            'quickCapture/addTag',
          ),

        removeTag: (tag) =>
          set(
            (state) => ({ tags: state.tags.filter((t) => t !== tag) }),
            false,
            'quickCapture/removeTag',
          ),

        setTargetFolder: (targetFolder) =>
          set({ targetFolder }, false, 'quickCapture/setTargetFolder'),

        setCaptureMode: (captureMode) => set({ captureMode }, false, 'quickCapture/setCaptureMode'),

        setDefaultFolder: (defaultFolder) =>
          set({ defaultFolder }, false, 'quickCapture/setDefaultFolder'),

        setDefaultMode: (defaultMode) => set({ defaultMode }, false, 'quickCapture/setDefaultMode'),

        setIsSaving: (isSaving) => set({ isSaving }, false, 'quickCapture/setIsSaving'),
        setSaveError: (saveError) => set({ saveError }, false, 'quickCapture/setSaveError'),
        setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }, false, 'quickCapture/setLastSavedAt'),

        resetCapture: () =>
          set(
            {
              content: '',
              title: '',
              tags: [],
              saveError: null,
              lastSavedAt: null,
            },
            false,
            'quickCapture/reset',
          ),
      }),
      {
        name: 'notesaner-quick-capture',
        partialize: (state) => ({
          defaultFolder: state.defaultFolder,
          defaultMode: state.defaultMode,
        }),
      },
    ),
    { name: 'QuickCaptureStore' },
  ),
);

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

interface CreateNoteResponse {
  id: string;
  title: string;
  path: string;
}

interface AppendToDailyNoteResponse {
  noteId: string;
  path: string;
  appended: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useQuickCapture -- manages the quick capture modal state and actions.
 *
 * Provides auto-save via a debounce timer that resets on every content
 * change. The timer is managed by the caller through the returned
 * scheduleAutoSave / cancelAutoSave functions. No useEffect is used;
 * the auto-save timer is triggered from the handleContentChange event
 * handler.
 */
export function useQuickCapture() {
  const store = useQuickCaptureStore();
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Save the current capture as a new note.
   */
  const saveAsNewNote = useCallback(async () => {
    if (!workspaceId || (!store.content.trim() && !store.title.trim())) return;

    store.setIsSaving(true);
    store.setSaveError(null);

    try {
      const response = await apiClient.post<CreateNoteResponse>(
        `/api/workspaces/${workspaceId}/notes`,
        {
          title: store.title.trim() || generateTitleFromContent(store.content),
          content: store.content,
          folder: store.targetFolder || undefined,
          tags: store.tags.length > 0 ? store.tags : undefined,
        },
      );

      store.setLastSavedAt(new Date().toISOString());
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to save note';
      store.setSaveError(message);
      throw error;
    } finally {
      store.setIsSaving(false);
    }
  }, [workspaceId, store]);

  /**
   * Append the current capture content to today's daily note.
   */
  const appendToDailyNote = useCallback(async () => {
    if (!workspaceId || !store.content.trim()) return;

    store.setIsSaving(true);
    store.setSaveError(null);

    try {
      const response = await apiClient.post<AppendToDailyNoteResponse>(
        `/api/workspaces/${workspaceId}/daily-note/append`,
        {
          content: store.content,
          tags: store.tags.length > 0 ? store.tags : undefined,
        },
      );

      store.setLastSavedAt(new Date().toISOString());
      return response;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to append to daily note';
      store.setSaveError(message);
      throw error;
    } finally {
      store.setIsSaving(false);
    }
  }, [workspaceId, store]);

  /**
   * Save based on current capture mode.
   */
  const save = useCallback(async () => {
    if (store.captureMode === 'daily-note') {
      return appendToDailyNote();
    }
    return saveAsNewNote();
  }, [store.captureMode, saveAsNewNote, appendToDailyNote]);

  /**
   * Schedule an auto-save after 2 seconds of inactivity.
   * Called from the content change handler. Cancels any pending timer.
   */
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      // Only auto-save if there's content and the modal is still open
      const state = useQuickCaptureStore.getState();
      if (state.isOpen && state.content.trim()) {
        save().catch(() => {
          // Error is already captured in store
        });
      }
    }, 2000);
  }, [save]);

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
   * Handle content changes with auto-save scheduling.
   * This is the event-handler-based alternative to using useEffect
   * for watching content changes.
   */
  const handleContentChange = useCallback(
    (content: string) => {
      store.setContent(content);
      scheduleAutoSave();
    },
    [store, scheduleAutoSave],
  );

  /**
   * Save and close the modal.
   */
  const saveAndClose = useCallback(async () => {
    cancelAutoSave();
    try {
      await save();
      store.resetCapture();
      store.setOpen(false);
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
    store.setOpen(false);
  }, [cancelAutoSave, store]);

  /**
   * Open the quick capture modal (for use in keyboard shortcut handler).
   */
  const open = useCallback(() => {
    store.setOpen(true);
  }, [store]);

  /**
   * Close the modal.
   */
  const close = useCallback(() => {
    cancelAutoSave();
    store.setOpen(false);
  }, [cancelAutoSave, store]);

  return {
    // State
    isOpen: store.isOpen,
    content: store.content,
    title: store.title,
    tags: store.tags,
    targetFolder: store.targetFolder,
    captureMode: store.captureMode,
    defaultFolder: store.defaultFolder,
    defaultMode: store.defaultMode,
    isSaving: store.isSaving,
    saveError: store.saveError,
    lastSavedAt: store.lastSavedAt,

    // Setters
    setTitle: store.setTitle,
    setTags: store.setTags,
    addTag: store.addTag,
    removeTag: store.removeTag,
    setTargetFolder: store.setTargetFolder,
    setCaptureMode: store.setCaptureMode,
    setDefaultFolder: store.setDefaultFolder,
    setDefaultMode: store.setDefaultMode,

    // Actions
    open,
    close,
    handleContentChange,
    save,
    saveAndClose,
    discardAndClose,
    scheduleAutoSave,
    cancelAutoSave,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a title from the first line of content.
 */
function generateTitleFromContent(content: string): string {
  const firstLine = content.split('\n')[0]?.trim() ?? '';

  // Remove markdown heading markers
  const withoutHeading = firstLine.replace(/^#{1,6}\s+/, '');

  if (withoutHeading.length > 60) {
    return withoutHeading.substring(0, 57) + '...';
  }

  return (
    withoutHeading ||
    `Quick note ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  );
}
