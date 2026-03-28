/**
 * quick-capture-store.ts
 *
 * Zustand store for quick capture feature.
 *
 * Persists user preferences only (defaultFolder, defaultMode).
 * Transient capture state (content, title, tags) is managed here as well
 * since it's tightly coupled to the capture workflow and must survive
 * potential re-renders during the capture flow.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CaptureMode = 'new-note' | 'daily-note';

export interface QuickCaptureState {
  // Modal visibility
  isOpen: boolean;

  // Capture content (transient)
  content: string;
  title: string;
  tags: string[];
  targetFolderId: string;
  captureMode: CaptureMode;

  // Persisted preferences
  defaultFolderId: string;
  defaultMode: CaptureMode;

  // Operation state
  isSaving: boolean;
  saveError: string | null;

  // Actions
  open: () => void;
  close: () => void;
  setContent: (content: string) => void;
  setTitle: (title: string) => void;
  setTags: (tags: string[]) => void;
  addTag: (tag: string) => void;
  removeTag: (tag: string) => void;
  setTargetFolderId: (folderId: string) => void;
  setCaptureMode: (mode: CaptureMode) => void;
  setDefaultFolderId: (folderId: string) => void;
  setDefaultMode: (mode: CaptureMode) => void;
  setIsSaving: (saving: boolean) => void;
  setSaveError: (error: string | null) => void;
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
        targetFolderId: '',
        captureMode: 'new-note',
        defaultFolderId: '',
        defaultMode: 'new-note',
        isSaving: false,
        saveError: null,

        // Actions
        open: () => {
          const state = get();
          set(
            {
              isOpen: true,
              targetFolderId: state.defaultFolderId,
              captureMode: state.defaultMode,
              content: '',
              title: '',
              tags: [],
              saveError: null,
            },
            false,
            'quickCapture/open',
          );
        },

        close: () => set({ isOpen: false }, false, 'quickCapture/close'),

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

        setTargetFolderId: (targetFolderId) =>
          set({ targetFolderId }, false, 'quickCapture/setTargetFolderId'),

        setCaptureMode: (captureMode) => set({ captureMode }, false, 'quickCapture/setCaptureMode'),

        setDefaultFolderId: (defaultFolderId) =>
          set({ defaultFolderId }, false, 'quickCapture/setDefaultFolderId'),

        setDefaultMode: (defaultMode) => set({ defaultMode }, false, 'quickCapture/setDefaultMode'),

        setIsSaving: (isSaving) => set({ isSaving }, false, 'quickCapture/setIsSaving'),
        setSaveError: (saveError) => set({ saveError }, false, 'quickCapture/setSaveError'),

        resetCapture: () =>
          set(
            {
              content: '',
              title: '',
              tags: [],
              saveError: null,
            },
            false,
            'quickCapture/reset',
          ),
      }),
      {
        name: 'notesaner-quick-capture',
        partialize: (state) => ({
          defaultFolderId: state.defaultFolderId,
          defaultMode: state.defaultMode,
        }),
      },
    ),
    { name: 'QuickCaptureStore' },
  ),
);
