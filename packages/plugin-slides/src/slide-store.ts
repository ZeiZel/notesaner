/**
 * Zustand store for Slides plugin state.
 *
 * Responsibilities:
 * - Track current slide index, total slide count, and parsed slides
 * - Track whether presentation mode or preview panel is active
 * - Track the selected theme
 * - Track whether speaker notes are visible
 * - Expose navigation actions (next, prev, goTo)
 *
 * The store does NOT fetch note content or parse markdown. The host component
 * is responsible for parsing the note via `parseSlides()` and seeding the
 * store via `setPresentation()`.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { Slide, PresentationFrontmatter } from './slide-parser';
import { DEFAULT_THEME_ID } from './slide-themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlideState {
  /** Ordered list of parsed slides. Empty before a presentation is loaded. */
  slides: Slide[];

  /** Frontmatter metadata of the active presentation. */
  frontmatter: PresentationFrontmatter | null;

  /** Zero-based index of the currently displayed slide. */
  currentSlide: number;

  /** Total number of slides. Mirrors `slides.length` for convenience. */
  totalSlides: number;

  /** Whether fullscreen presentation mode is active. */
  isPresenting: boolean;

  /** Whether the slide preview side panel is open. */
  isPreviewing: boolean;

  /** Currently selected theme id. */
  selectedTheme: string;

  /** Whether speaker notes are visible in presenter view. */
  speakerNotesVisible: boolean;

  /** Whether a presentation is currently loaded. */
  hasPresentation: boolean;
}

export interface SlideActions {
  /**
   * Load a parsed presentation into the store.
   * Resets the current slide to index 0.
   */
  setPresentation(slides: Slide[], frontmatter: PresentationFrontmatter): void;

  /** Clear the current presentation and reset all state. */
  clearPresentation(): void;

  /** Navigate to the next slide. No-op at the last slide. */
  nextSlide(): void;

  /** Navigate to the previous slide. No-op at the first slide. */
  prevSlide(): void;

  /**
   * Navigate to a specific slide by zero-based index.
   * Clamps to valid range [0, totalSlides - 1].
   */
  goToSlide(index: number): void;

  /** Enter fullscreen presentation mode. */
  startPresenting(): void;

  /** Exit fullscreen presentation mode. */
  stopPresenting(): void;

  /** Toggle the slide preview panel. */
  togglePreview(): void;

  /** Open the slide preview panel. */
  openPreview(): void;

  /** Close the slide preview panel. */
  closePreview(): void;

  /** Set the active theme by id. */
  setTheme(themeId: string): void;

  /** Toggle the speaker notes visibility. */
  toggleSpeakerNotes(): void;

  /** Show speaker notes. */
  showSpeakerNotes(): void;

  /** Hide speaker notes. */
  hideSpeakerNotes(): void;
}

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

const INITIAL_STATE: SlideState = {
  slides: [],
  frontmatter: null,
  currentSlide: 0,
  totalSlides: 0,
  isPresenting: false,
  isPreviewing: false,
  selectedTheme: DEFAULT_THEME_ID,
  speakerNotesVisible: true,
  hasPresentation: false,
};

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSlideStore = create<SlideState & SlideActions>()(
  devtools(
    (set, get) => ({
      ...INITIAL_STATE,

      // -----------------------------------------------------------------------
      // Presentation lifecycle
      // -----------------------------------------------------------------------

      setPresentation(slides, frontmatter) {
        const themeFromFrontmatter = frontmatter.theme;
        set(
          (state) => ({
            slides,
            frontmatter,
            currentSlide: 0,
            totalSlides: slides.length,
            hasPresentation: slides.length > 0,
            // Apply theme from frontmatter if provided, else keep current
            selectedTheme: themeFromFrontmatter ?? state.selectedTheme,
          }),
          false,
          'setPresentation',
        );
      },

      clearPresentation() {
        set(
          {
            ...INITIAL_STATE,
            // Preserve theme selection across presentation loads
            selectedTheme: get().selectedTheme,
          },
          false,
          'clearPresentation',
        );
      },

      // -----------------------------------------------------------------------
      // Navigation
      // -----------------------------------------------------------------------

      nextSlide() {
        const { currentSlide, totalSlides } = get();
        if (currentSlide >= totalSlides - 1) return;
        set({ currentSlide: currentSlide + 1 }, false, 'nextSlide');
      },

      prevSlide() {
        const { currentSlide } = get();
        if (currentSlide <= 0) return;
        set({ currentSlide: currentSlide - 1 }, false, 'prevSlide');
      },

      goToSlide(index) {
        const { totalSlides } = get();
        if (totalSlides === 0) return;
        const clamped = Math.max(0, Math.min(index, totalSlides - 1));
        set({ currentSlide: clamped }, false, 'goToSlide');
      },

      // -----------------------------------------------------------------------
      // Presentation mode
      // -----------------------------------------------------------------------

      startPresenting() {
        set({ isPresenting: true }, false, 'startPresenting');
      },

      stopPresenting() {
        set({ isPresenting: false }, false, 'stopPresenting');
      },

      // -----------------------------------------------------------------------
      // Preview panel
      // -----------------------------------------------------------------------

      togglePreview() {
        set((state) => ({ isPreviewing: !state.isPreviewing }), false, 'togglePreview');
      },

      openPreview() {
        set({ isPreviewing: true }, false, 'openPreview');
      },

      closePreview() {
        set({ isPreviewing: false }, false, 'closePreview');
      },

      // -----------------------------------------------------------------------
      // Theme
      // -----------------------------------------------------------------------

      setTheme(themeId) {
        set({ selectedTheme: themeId }, false, 'setTheme');
      },

      // -----------------------------------------------------------------------
      // Speaker notes
      // -----------------------------------------------------------------------

      toggleSpeakerNotes() {
        set(
          (state) => ({ speakerNotesVisible: !state.speakerNotesVisible }),
          false,
          'toggleSpeakerNotes',
        );
      },

      showSpeakerNotes() {
        set({ speakerNotesVisible: true }, false, 'showSpeakerNotes');
      },

      hideSpeakerNotes() {
        set({ speakerNotesVisible: false }, false, 'hideSpeakerNotes');
      },
    }),
    { name: 'slides-store' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors (exported for convenience — use in components with useSlideStore)
// ---------------------------------------------------------------------------

/** Returns the current Slide object, or null when no presentation is loaded. */
export function selectCurrentSlide(state: SlideState): Slide | null {
  return state.slides[state.currentSlide] ?? null;
}

/** Returns the next Slide object for the speaker notes preview. */
export function selectNextSlide(state: SlideState): Slide | null {
  return state.slides[state.currentSlide + 1] ?? null;
}

/** Returns true when the current slide is the first slide. */
export function selectIsFirstSlide(state: SlideState): boolean {
  return state.currentSlide === 0;
}

/** Returns true when the current slide is the last slide. */
export function selectIsLastSlide(state: SlideState): boolean {
  return state.totalSlides > 0 && state.currentSlide === state.totalSlides - 1;
}

/** Returns a human-readable "N / total" slide count string. */
export function selectSlideCountLabel(state: SlideState): string {
  if (state.totalSlides === 0) return '0 / 0';
  return `${state.currentSlide + 1} / ${state.totalSlides}`;
}
