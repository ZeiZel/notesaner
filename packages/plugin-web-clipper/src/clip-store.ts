/**
 * Zustand store for the web clipper plugin state.
 *
 * Responsibilities:
 * - Hold connection settings (serverUrl, authToken).
 * - Hold the current clip configuration (mode, destination, tags, template).
 * - Maintain clip history (last N clips for quick re-access).
 * - Expose actions for updating settings and recording new clips.
 *
 * The store does NOT perform network requests directly. The ClipperPopup
 * component coordinates clipping operations using the api-client and then
 * calls `addClipHistory` to record a completed clip.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Clip mode — determines how content is extracted from the page. */
export type ClipMode = 'full' | 'article' | 'selection' | 'screenshot';

/** Where the clipped note should be saved. */
export interface ClipDestination {
  /** 'inbox' saves to the workspace inbox (root), 'folder' saves to a specific folder. */
  type: 'inbox' | 'folder';
  /** Folder path when type is 'folder'. */
  folderPath?: string;
  /** Folder ID (server-side) when type is 'folder'. */
  folderId?: string;
}

/** Represents a single completed clip. */
export interface ClipHistoryEntry {
  /** Unique identifier for this history entry. */
  id: string;
  /** When the clip was created (ISO timestamp). */
  clippedAt: string;
  /** Page title at time of clipping. */
  title: string;
  /** Source URL. */
  url: string;
  /** Clip mode used. */
  mode: ClipMode;
  /** ID of the note created in Notesaner. */
  noteId?: string;
  /** Whether the clip succeeded or failed. */
  status: 'success' | 'error';
  /** Error message if the clip failed. */
  errorMessage?: string;
}

/** Connection state for Notesaner OAuth. */
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

// ---------------------------------------------------------------------------
// State and Actions shapes
// ---------------------------------------------------------------------------

export interface ClipperState {
  // Connection settings
  serverUrl: string;
  authToken: string | null;
  connectionStatus: ConnectionStatus;
  connectionError: string | null;

  // Clip configuration
  clipMode: ClipMode;
  destination: ClipDestination;
  tags: string[];
  templateId: string;

  // UI state
  isClipping: boolean;
  clipError: string | null;
  clipSuccess: boolean;

  // History
  clipHistory: ClipHistoryEntry[];
}

export interface ClipperActions {
  // Connection actions
  setServerUrl(url: string): void;
  setAuthToken(token: string | null): void;
  setConnectionStatus(status: ConnectionStatus, error?: string): void;
  disconnect(): void;

  // Clip configuration actions
  setClipMode(mode: ClipMode): void;
  setDestination(destination: ClipDestination): void;
  setTags(tags: string[]): void;
  addTag(tag: string): void;
  removeTag(tag: string): void;
  setTemplateId(id: string): void;

  // Clip lifecycle actions
  startClip(): void;
  finishClip(): void;
  setClipError(error: string): void;
  clearClipStatus(): void;

  // History actions
  addClipHistory(entry: ClipHistoryEntry): void;
  clearHistory(): void;
  removeHistoryEntry(id: string): void;
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_DESTINATION: ClipDestination = {
  type: 'inbox',
};

const MAX_HISTORY_ENTRIES = 50;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useClipperStore = create<ClipperState & ClipperActions>()(
  devtools(
    persist(
      (set, get) => ({
        // Initial state — connection
        serverUrl: '',
        authToken: null,
        connectionStatus: 'disconnected',
        connectionError: null,

        // Initial state — clip config
        clipMode: 'article',
        destination: { ...DEFAULT_DESTINATION },
        tags: [],
        templateId: 'article',

        // Initial state — UI
        isClipping: false,
        clipError: null,
        clipSuccess: false,

        // Initial state — history
        clipHistory: [],

        // -----------------------------------------------------------------------
        // Connection actions
        // -----------------------------------------------------------------------

        setServerUrl(url) {
          set({ serverUrl: url }, false, 'setServerUrl');
        },

        setAuthToken(token) {
          set(
            {
              authToken: token,
              connectionStatus: token ? 'connected' : 'disconnected',
              connectionError: null,
            },
            false,
            'setAuthToken',
          );
        },

        setConnectionStatus(status, error) {
          set(
            { connectionStatus: status, connectionError: error ?? null },
            false,
            'setConnectionStatus',
          );
        },

        disconnect() {
          set(
            {
              authToken: null,
              connectionStatus: 'disconnected',
              connectionError: null,
            },
            false,
            'disconnect',
          );
        },

        // -----------------------------------------------------------------------
        // Clip configuration actions
        // -----------------------------------------------------------------------

        setClipMode(mode) {
          set({ clipMode: mode }, false, 'setClipMode');
        },

        setDestination(destination) {
          set({ destination }, false, 'setDestination');
        },

        setTags(tags) {
          set({ tags: [...new Set(tags)] }, false, 'setTags');
        },

        addTag(tag) {
          const trimmed = tag.trim().toLowerCase();
          if (!trimmed) return;
          const { tags } = get();
          if (tags.includes(trimmed)) return;
          set({ tags: [...tags, trimmed] }, false, 'addTag');
        },

        removeTag(tag) {
          set((state) => ({ tags: state.tags.filter((t) => t !== tag) }), false, 'removeTag');
        },

        setTemplateId(id) {
          set({ templateId: id }, false, 'setTemplateId');
        },

        // -----------------------------------------------------------------------
        // Clip lifecycle actions
        // -----------------------------------------------------------------------

        startClip() {
          set({ isClipping: true, clipError: null, clipSuccess: false }, false, 'startClip');
        },

        finishClip() {
          set({ isClipping: false, clipSuccess: true }, false, 'finishClip');
        },

        setClipError(error) {
          set({ isClipping: false, clipError: error, clipSuccess: false }, false, 'setClipError');
        },

        clearClipStatus() {
          set({ clipError: null, clipSuccess: false }, false, 'clearClipStatus');
        },

        // -----------------------------------------------------------------------
        // History actions
        // -----------------------------------------------------------------------

        addClipHistory(entry) {
          set(
            (state) => {
              const next = [entry, ...state.clipHistory].slice(0, MAX_HISTORY_ENTRIES);
              return { clipHistory: next };
            },
            false,
            'addClipHistory',
          );
        },

        clearHistory() {
          set({ clipHistory: [] }, false, 'clearHistory');
        },

        removeHistoryEntry(id) {
          set(
            (state) => ({ clipHistory: state.clipHistory.filter((e) => e.id !== id) }),
            false,
            'removeHistoryEntry',
          );
        },
      }),
      {
        name: 'notesaner-web-clipper',
        // Only persist settings — not transient UI state
        partialize: (state) => ({
          serverUrl: state.serverUrl,
          authToken: state.authToken,
          clipMode: state.clipMode,
          destination: state.destination,
          tags: state.tags,
          templateId: state.templateId,
          clipHistory: state.clipHistory,
        }),
      },
    ),
    { name: 'clipper-store' },
  ),
);
