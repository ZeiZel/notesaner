/**
 * ai-store — Zustand store for the AI Writing Assistant plugin.
 *
 * Manages provider configuration, streaming state, chat history,
 * link suggestions, and tag suggestions. All UI state lives here
 * so components remain stateless.
 */

import { create } from 'zustand';
import type { ProviderConfig } from './ai-provider';
import type { AIActionId } from './ai-actions';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry in the AI conversation history */
export interface HistoryEntry {
  id: string;
  /** The action that produced this entry */
  actionId: AIActionId;
  /** Prompt sent to the model */
  prompt: string;
  /** Generated response text (partial while streaming) */
  response: string;
  /** Whether this entry is still being streamed */
  isStreaming: boolean;
  /** ISO timestamp when the request was made */
  createdAt: string;
  /** Error message if the request failed, null otherwise */
  error: string | null;
}

/** A wiki-link suggestion based on current note content */
export interface LinkSuggestion {
  /** Title of the note to link to */
  noteTitle: string;
  /** Note identifier */
  noteId: string;
  /** Score 0–1 indicating relevance */
  relevance: number;
  /** The matching keyword/phrase found in the current note */
  matchedPhrase: string;
}

/** An auto-tag suggestion extracted from current note content */
export interface TagSuggestion {
  tag: string;
  /** Score 0–1 indicating confidence */
  confidence: number;
}

/** The action currently pending user submission */
export interface PendingAction {
  actionId: AIActionId;
  /** Selected text for actions that operate on a selection */
  selection?: string;
  /** Additional parameters e.g. target language for translate */
  params?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface AIStoreState {
  // Provider
  config: ProviderConfig;

  // Streaming
  isStreaming: boolean;
  activeEntryId: string | null;

  // History
  history: HistoryEntry[];

  // Suggestions
  linkSuggestions: LinkSuggestion[];
  tagSuggestions: TagSuggestion[];

  // Pending action (staged but not yet sent)
  pendingAction: PendingAction | null;

  // Sidebar visibility
  isSidebarOpen: boolean;

  // Actions
  actions: AIStoreActions;
}

export interface AIStoreActions {
  /** Update provider configuration */
  setConfig(config: Partial<ProviderConfig>): void;

  /** Stage a pending action */
  setPendingAction(action: PendingAction | null): void;

  /** Add a new history entry, returns its id */
  addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt' | 'isStreaming' | 'error'>): string;

  /** Append a text chunk to a streaming entry */
  appendStreamChunk(entryId: string, chunk: string): void;

  /** Mark a streaming entry as complete */
  finalizeEntry(entryId: string): void;

  /** Mark an entry as failed */
  setEntryError(entryId: string, error: string): void;

  /** Replace an entry's response (e.g. for retries) */
  setEntryResponse(entryId: string, response: string): void;

  /** Remove a single history entry */
  removeEntry(entryId: string): void;

  /** Clear the full history */
  clearHistory(): void;

  /** Replace the current link suggestions */
  setLinkSuggestions(suggestions: LinkSuggestion[]): void;

  /** Replace the current tag suggestions */
  setTagSuggestions(suggestions: TagSuggestion[]): void;

  /** Toggle sidebar open/closed */
  toggleSidebar(): void;

  /** Set sidebar open state explicitly */
  setSidebarOpen(open: boolean): void;

  /** Set overall streaming flag */
  setStreaming(value: boolean): void;
}

// ---------------------------------------------------------------------------
// Default config
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG: ProviderConfig = {
  provider: 'openai',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
  maxTokens: 1024,
  customEndpoint: '',
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

let _nextId = 0;
function generateId(): string {
  return `ai-entry-${Date.now()}-${++_nextId}`;
}

export const useAIStore = create<AIStoreState>((set) => ({
  config: DEFAULT_CONFIG,
  isStreaming: false,
  activeEntryId: null,
  history: [],
  linkSuggestions: [],
  tagSuggestions: [],
  pendingAction: null,
  isSidebarOpen: false,

  actions: {
    setConfig(config) {
      set((state) => ({
        config: { ...state.config, ...config },
      }));
    },

    setPendingAction(action) {
      set({ pendingAction: action });
    },

    addHistoryEntry(entry) {
      const id = generateId();
      const newEntry: HistoryEntry = {
        ...entry,
        id,
        createdAt: new Date().toISOString(),
        isStreaming: true,
        error: null,
      };

      set((state) => ({
        history: [newEntry, ...state.history],
        activeEntryId: id,
        isStreaming: true,
      }));

      return id;
    },

    appendStreamChunk(entryId, chunk) {
      set((state) => ({
        history: state.history.map((entry) =>
          entry.id === entryId ? { ...entry, response: entry.response + chunk } : entry,
        ),
      }));
    },

    finalizeEntry(entryId) {
      set((state) => ({
        history: state.history.map((entry) =>
          entry.id === entryId ? { ...entry, isStreaming: false } : entry,
        ),
        isStreaming: false,
        activeEntryId: null,
      }));
    },

    setEntryError(entryId, error) {
      set((state) => ({
        history: state.history.map((entry) =>
          entry.id === entryId ? { ...entry, isStreaming: false, error } : entry,
        ),
        isStreaming: false,
        activeEntryId: null,
      }));
    },

    setEntryResponse(entryId, response) {
      set((state) => ({
        history: state.history.map((entry) =>
          entry.id === entryId ? { ...entry, response } : entry,
        ),
      }));
    },

    removeEntry(entryId) {
      set((state) => ({
        history: state.history.filter((entry) => entry.id !== entryId),
      }));
    },

    clearHistory() {
      set({ history: [] });
    },

    setLinkSuggestions(suggestions) {
      set({ linkSuggestions: suggestions });
    },

    setTagSuggestions(suggestions) {
      set({ tagSuggestions: suggestions });
    },

    toggleSidebar() {
      set((state) => ({ isSidebarOpen: !state.isSidebarOpen }));
    },

    setSidebarOpen(open) {
      set({ isSidebarOpen: open });
    },

    setStreaming(value) {
      set({ isStreaming: value });
    },
  },
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

/** Returns the latest non-streaming history entry, or null */
export function selectLatestEntry(state: AIStoreState): HistoryEntry | null {
  return state.history.find((e) => !e.isStreaming) ?? state.history[0] ?? null;
}

/** Returns the currently streaming entry, or null */
export function selectActiveEntry(state: AIStoreState): HistoryEntry | null {
  if (!state.activeEntryId) return null;
  return state.history.find((e) => e.id === state.activeEntryId) ?? null;
}

/** Returns link suggestions sorted by relevance descending */
export function selectTopLinkSuggestions(state: AIStoreState, limit = 5): LinkSuggestion[] {
  return [...state.linkSuggestions].sort((a, b) => b.relevance - a.relevance).slice(0, limit);
}

/** Returns tag suggestions sorted by confidence descending */
export function selectTopTagSuggestions(state: AIStoreState, limit = 8): TagSuggestion[] {
  return [...state.tagSuggestions].sort((a, b) => b.confidence - a.confidence).slice(0, limit);
}
