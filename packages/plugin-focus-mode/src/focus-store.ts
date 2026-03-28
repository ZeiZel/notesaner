/**
 * focus-store — Zustand store for Focus Mode plugin state.
 *
 * Persists user preferences to localStorage so focus mode settings survive
 * page reloads and workspace switches.
 *
 * Persistence key: `notesaner-focus-mode`.
 *
 * Only serialisable preferences are persisted. Session-specific runtime data
 * (sessionWordCount, sessionStartTime, startWordCount) is excluded from
 * persistence — it resets on every focus session.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The ambient sound tracks available in focus mode. */
export type AmbientSound = 'none' | 'rain' | 'forest' | 'cafe' | 'waves' | 'white-noise';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface FocusModeState {
  // --- UI visibility state ---
  /** Whether focus mode is currently active (hides chrome). */
  isFocused: boolean;
  /** Whether zen mode is active (only text on screen, no UI whatsoever). */
  isZenMode: boolean;

  // --- Writing assistance ---
  /** Typewriter scrolling: keeps the cursor line vertically centred. */
  typewriterMode: boolean;
  /** Dims paragraphs other than the one the cursor is in. */
  dimInactiveParagraphs: boolean;

  // --- Word count goal ---
  /** Target word count for the current session. 0 = no goal. */
  wordCountGoal: number;

  // --- Ambient audio ---
  /** Whether the ambient sound player is enabled. */
  musicEnabled: boolean;
  /** Which ambient track is active. */
  ambientSound: AmbientSound;

  // --- Session data (not persisted) ---
  /** Words written since the session started. */
  sessionWordCount: number;
  /** Unix timestamp (ms) when the focus session started. null when not active. */
  sessionStartTime: number | null;
  /**
   * Word count of the note at the moment focus mode was entered.
   * Used to calculate net new words written in the session.
   */
  startWordCount: number;
}

export interface FocusModeActions {
  /** Enter focus mode, recording the current word count as the baseline. */
  enterFocusMode: (currentWordCount: number) => void;
  /** Exit focus mode and reset session data. */
  exitFocusMode: () => void;
  /** Toggle focus mode. */
  toggleFocusMode: (currentWordCount: number) => void;

  /** Enable zen mode (implies focus mode must already be active). */
  enterZenMode: () => void;
  /** Exit zen mode (returns to regular focus mode, not full exit). */
  exitZenMode: () => void;
  /** Toggle zen mode. */
  toggleZenMode: () => void;

  /** Update session word count with the current total word count of the note. */
  updateWordCount: (currentWordCount: number) => void;

  /** Set the word count goal. Pass 0 to disable the goal. */
  setWordCountGoal: (goal: number) => void;

  /** Toggle typewriter scrolling. */
  setTypewriterMode: (enabled: boolean) => void;
  /** Toggle dim inactive paragraphs. */
  setDimInactiveParagraphs: (enabled: boolean) => void;

  /** Toggle ambient sound player. */
  setMusicEnabled: (enabled: boolean) => void;
  /** Set the active ambient sound track. */
  setAmbientSound: (sound: AmbientSound) => void;

  /** Reset all settings to their defaults (does not exit focus mode). */
  resetSettings: () => void;
}

export type FocusModeStore = FocusModeState & FocusModeActions;

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_STATE: Omit<
  FocusModeState,
  'sessionWordCount' | 'sessionStartTime' | 'startWordCount'
> = {
  isFocused: false,
  isZenMode: false,
  typewriterMode: true,
  dimInactiveParagraphs: false,
  wordCountGoal: 0,
  musicEnabled: false,
  ambientSound: 'none',
};

// ---------------------------------------------------------------------------
// Storage guard (SSR-safe)
// ---------------------------------------------------------------------------

function safeLocalStorage() {
  if (typeof window === 'undefined') {
    return {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    };
  }
  return window.localStorage;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFocusModeStore = create<FocusModeStore>()(
  persist(
    (set, get) => ({
      // ---- Initial state ----
      ...DEFAULT_STATE,
      sessionWordCount: 0,
      sessionStartTime: null,
      startWordCount: 0,

      // ---- Actions ----

      enterFocusMode(currentWordCount: number): void {
        set({
          isFocused: true,
          sessionStartTime: Date.now(),
          startWordCount: currentWordCount,
          sessionWordCount: 0,
        });
      },

      exitFocusMode(): void {
        set({
          isFocused: false,
          isZenMode: false,
          sessionStartTime: null,
          sessionWordCount: 0,
          startWordCount: 0,
        });
      },

      toggleFocusMode(currentWordCount: number): void {
        const { isFocused, enterFocusMode, exitFocusMode } = get();
        if (isFocused) {
          exitFocusMode();
        } else {
          enterFocusMode(currentWordCount);
        }
      },

      enterZenMode(): void {
        set({ isZenMode: true });
      },

      exitZenMode(): void {
        set({ isZenMode: false });
      },

      toggleZenMode(): void {
        set((state) => ({ isZenMode: !state.isZenMode }));
      },

      updateWordCount(currentWordCount: number): void {
        const { startWordCount } = get();
        const sessionWordCount = Math.max(0, currentWordCount - startWordCount);
        set({ sessionWordCount });
      },

      setWordCountGoal(goal: number): void {
        set({ wordCountGoal: Math.max(0, Math.floor(goal)) });
      },

      setTypewriterMode(enabled: boolean): void {
        set({ typewriterMode: enabled });
      },

      setDimInactiveParagraphs(enabled: boolean): void {
        set({ dimInactiveParagraphs: enabled });
      },

      setMusicEnabled(enabled: boolean): void {
        set({ musicEnabled: enabled });
      },

      setAmbientSound(sound: AmbientSound): void {
        set({ ambientSound: sound });
      },

      resetSettings(): void {
        set({ ...DEFAULT_STATE });
      },
    }),
    {
      name: 'notesaner-focus-mode',
      storage: createJSONStorage(safeLocalStorage),
      // Only persist user preferences — never session data.
      partialize: (state) => ({
        typewriterMode: state.typewriterMode,
        dimInactiveParagraphs: state.dimInactiveParagraphs,
        wordCountGoal: state.wordCountGoal,
        musicEnabled: state.musicEnabled,
        ambientSound: state.ambientSound,
      }),
    },
  ),
);

// ---------------------------------------------------------------------------
// Selector helpers
// ---------------------------------------------------------------------------

/** Returns the progress toward the word count goal as a value between 0 and 1. */
export function selectGoalProgress(state: FocusModeState): number {
  if (state.wordCountGoal <= 0) return 0;
  return Math.min(1, state.sessionWordCount / state.wordCountGoal);
}

/** Returns true when the word count goal has been reached. */
export function selectGoalReached(state: FocusModeState): boolean {
  if (state.wordCountGoal <= 0) return false;
  return state.sessionWordCount >= state.wordCountGoal;
}
