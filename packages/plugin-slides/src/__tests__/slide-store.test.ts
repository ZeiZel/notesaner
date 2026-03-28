/**
 * Tests for slide-store Zustand store.
 *
 * Coverage:
 * - setPresentation — load slides, reset index
 * - clearPresentation — reset state
 * - nextSlide / prevSlide — boundary conditions
 * - goToSlide — clamping
 * - startPresenting / stopPresenting — mode toggle
 * - openPreview / closePreview / togglePreview
 * - setTheme — theme selection
 * - toggleSpeakerNotes / showSpeakerNotes / hideSpeakerNotes
 * - Selectors: selectCurrentSlide, selectNextSlide, selectIsFirstSlide,
 *              selectIsLastSlide, selectSlideCountLabel
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { useSlideStore } from '../slide-store';
import {
  selectCurrentSlide,
  selectNextSlide,
  selectIsFirstSlide,
  selectIsLastSlide,
  selectSlideCountLabel,
} from '../slide-store';
import type { Slide, PresentationFrontmatter } from '../slide-parser';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeSlide(index: number, overrides: Partial<Slide> = {}): Slide {
  return {
    index,
    title: `Slide ${index + 1}`,
    content: `# Slide ${index + 1}\n\nContent for slide ${index + 1}`,
    speakerNotes: '',
    ...overrides,
  };
}

const THREE_SLIDES = [makeSlide(0), makeSlide(1), makeSlide(2)];

const DEFAULT_FM: PresentationFrontmatter = {
  title: 'Test Presentation',
  theme: undefined,
  transition: undefined,
};

// ---------------------------------------------------------------------------
// Store reset helper
// ---------------------------------------------------------------------------

function resetStore(): void {
  useSlideStore.setState({
    slides: [],
    frontmatter: null,
    currentSlide: 0,
    totalSlides: 0,
    isPresenting: false,
    isPreviewing: false,
    selectedTheme: 'default',
    speakerNotesVisible: true,
    hasPresentation: false,
  });
}

// ---------------------------------------------------------------------------
// setPresentation
// ---------------------------------------------------------------------------

describe('setPresentation', () => {
  beforeEach(resetStore);

  it('loads slides and updates totalSlides', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    const state = useSlideStore.getState();
    expect(state.slides).toHaveLength(3);
    expect(state.totalSlides).toBe(3);
    expect(state.hasPresentation).toBe(true);
  });

  it('resets currentSlide to 0 on new presentation', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().nextSlide();
    expect(useSlideStore.getState().currentSlide).toBe(1);

    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    expect(useSlideStore.getState().currentSlide).toBe(0);
  });

  it('stores the frontmatter', () => {
    const fm: PresentationFrontmatter = { title: 'My Talk', theme: 'dark', transition: 'fade' };
    useSlideStore.getState().setPresentation(THREE_SLIDES, fm);
    expect(useSlideStore.getState().frontmatter).toEqual(fm);
  });

  it('applies theme from frontmatter if provided', () => {
    const fm: PresentationFrontmatter = { title: 'T', theme: 'dark' };
    useSlideStore.getState().setPresentation(THREE_SLIDES, fm);
    expect(useSlideStore.getState().selectedTheme).toBe('dark');
  });

  it('keeps current theme when frontmatter has no theme', () => {
    useSlideStore.setState({ selectedTheme: 'neon' });
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    expect(useSlideStore.getState().selectedTheme).toBe('neon');
  });

  it('sets hasPresentation to false for an empty slides array', () => {
    useSlideStore.getState().setPresentation([], DEFAULT_FM);
    expect(useSlideStore.getState().hasPresentation).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// clearPresentation
// ---------------------------------------------------------------------------

describe('clearPresentation', () => {
  beforeEach(resetStore);

  it('clears slides, frontmatter, and totalSlides', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().clearPresentation();

    const state = useSlideStore.getState();
    expect(state.slides).toHaveLength(0);
    expect(state.frontmatter).toBeNull();
    expect(state.totalSlides).toBe(0);
    expect(state.hasPresentation).toBe(false);
  });

  it('preserves the selected theme after clear', () => {
    useSlideStore.getState().setTheme('academic');
    useSlideStore.getState().clearPresentation();
    expect(useSlideStore.getState().selectedTheme).toBe('academic');
  });

  it('resets currentSlide to 0', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().goToSlide(2);
    useSlideStore.getState().clearPresentation();
    expect(useSlideStore.getState().currentSlide).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Navigation — nextSlide / prevSlide / goToSlide
// ---------------------------------------------------------------------------

describe('nextSlide', () => {
  beforeEach(() => {
    resetStore();
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
  });

  it('advances to the next slide', () => {
    useSlideStore.getState().nextSlide();
    expect(useSlideStore.getState().currentSlide).toBe(1);
  });

  it('does not advance past the last slide', () => {
    useSlideStore.getState().goToSlide(2);
    useSlideStore.getState().nextSlide();
    expect(useSlideStore.getState().currentSlide).toBe(2);
  });

  it('advances sequentially from first to last', () => {
    useSlideStore.getState().nextSlide();
    useSlideStore.getState().nextSlide();
    expect(useSlideStore.getState().currentSlide).toBe(2);
    useSlideStore.getState().nextSlide();
    expect(useSlideStore.getState().currentSlide).toBe(2); // clamped
  });
});

describe('prevSlide', () => {
  beforeEach(() => {
    resetStore();
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
  });

  it('goes back to the previous slide', () => {
    useSlideStore.getState().goToSlide(2);
    useSlideStore.getState().prevSlide();
    expect(useSlideStore.getState().currentSlide).toBe(1);
  });

  it('does not go before slide 0', () => {
    useSlideStore.getState().prevSlide();
    expect(useSlideStore.getState().currentSlide).toBe(0);
  });
});

describe('goToSlide', () => {
  beforeEach(() => {
    resetStore();
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
  });

  it('navigates to the given index', () => {
    useSlideStore.getState().goToSlide(2);
    expect(useSlideStore.getState().currentSlide).toBe(2);
  });

  it('clamps negative indices to 0', () => {
    useSlideStore.getState().goToSlide(-5);
    expect(useSlideStore.getState().currentSlide).toBe(0);
  });

  it('clamps out-of-range indices to last slide', () => {
    useSlideStore.getState().goToSlide(999);
    expect(useSlideStore.getState().currentSlide).toBe(2);
  });

  it('is a no-op when no presentation is loaded', () => {
    resetStore();
    useSlideStore.getState().goToSlide(1);
    expect(useSlideStore.getState().currentSlide).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Presentation mode
// ---------------------------------------------------------------------------

describe('startPresenting / stopPresenting', () => {
  beforeEach(resetStore);

  it('sets isPresenting to true on startPresenting', () => {
    useSlideStore.getState().startPresenting();
    expect(useSlideStore.getState().isPresenting).toBe(true);
  });

  it('sets isPresenting to false on stopPresenting', () => {
    useSlideStore.getState().startPresenting();
    useSlideStore.getState().stopPresenting();
    expect(useSlideStore.getState().isPresenting).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Preview panel
// ---------------------------------------------------------------------------

describe('preview panel actions', () => {
  beforeEach(resetStore);

  it('openPreview sets isPreviewing to true', () => {
    useSlideStore.getState().openPreview();
    expect(useSlideStore.getState().isPreviewing).toBe(true);
  });

  it('closePreview sets isPreviewing to false', () => {
    useSlideStore.getState().openPreview();
    useSlideStore.getState().closePreview();
    expect(useSlideStore.getState().isPreviewing).toBe(false);
  });

  it('togglePreview flips the value', () => {
    expect(useSlideStore.getState().isPreviewing).toBe(false);
    useSlideStore.getState().togglePreview();
    expect(useSlideStore.getState().isPreviewing).toBe(true);
    useSlideStore.getState().togglePreview();
    expect(useSlideStore.getState().isPreviewing).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Theme selection
// ---------------------------------------------------------------------------

describe('setTheme', () => {
  beforeEach(resetStore);

  it('updates selectedTheme', () => {
    useSlideStore.getState().setTheme('dark');
    expect(useSlideStore.getState().selectedTheme).toBe('dark');
  });

  it('accepts any string (no validation in store)', () => {
    useSlideStore.getState().setTheme('custom-theme');
    expect(useSlideStore.getState().selectedTheme).toBe('custom-theme');
  });

  it('starts with the default theme', () => {
    expect(useSlideStore.getState().selectedTheme).toBe('default');
  });
});

// ---------------------------------------------------------------------------
// Speaker notes
// ---------------------------------------------------------------------------

describe('speaker notes actions', () => {
  beforeEach(resetStore);

  it('speakerNotesVisible is true by default', () => {
    expect(useSlideStore.getState().speakerNotesVisible).toBe(true);
  });

  it('hideSpeakerNotes sets speakerNotesVisible to false', () => {
    useSlideStore.getState().hideSpeakerNotes();
    expect(useSlideStore.getState().speakerNotesVisible).toBe(false);
  });

  it('showSpeakerNotes sets speakerNotesVisible to true', () => {
    useSlideStore.getState().hideSpeakerNotes();
    useSlideStore.getState().showSpeakerNotes();
    expect(useSlideStore.getState().speakerNotesVisible).toBe(true);
  });

  it('toggleSpeakerNotes flips the value', () => {
    useSlideStore.getState().toggleSpeakerNotes();
    expect(useSlideStore.getState().speakerNotesVisible).toBe(false);
    useSlideStore.getState().toggleSpeakerNotes();
    expect(useSlideStore.getState().speakerNotesVisible).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

describe('selectCurrentSlide', () => {
  beforeEach(resetStore);

  it('returns null when no presentation is loaded', () => {
    expect(selectCurrentSlide(useSlideStore.getState())).toBeNull();
  });

  it('returns the current slide object', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    const slide = selectCurrentSlide(useSlideStore.getState());
    expect(slide).not.toBeNull();
    expect(slide?.index).toBe(0);
  });

  it('returns the correct slide after navigation', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().goToSlide(2);
    const slide = selectCurrentSlide(useSlideStore.getState());
    expect(slide?.index).toBe(2);
  });
});

describe('selectNextSlide', () => {
  beforeEach(resetStore);

  it('returns the next slide object', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    const next = selectNextSlide(useSlideStore.getState());
    expect(next?.index).toBe(1);
  });

  it('returns null when on the last slide', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().goToSlide(2);
    expect(selectNextSlide(useSlideStore.getState())).toBeNull();
  });
});

describe('selectIsFirstSlide', () => {
  beforeEach(resetStore);

  it('returns true when on slide 0', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    expect(selectIsFirstSlide(useSlideStore.getState())).toBe(true);
  });

  it('returns false when past slide 0', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().nextSlide();
    expect(selectIsFirstSlide(useSlideStore.getState())).toBe(false);
  });
});

describe('selectIsLastSlide', () => {
  beforeEach(resetStore);

  it('returns true when on the last slide', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().goToSlide(2);
    expect(selectIsLastSlide(useSlideStore.getState())).toBe(true);
  });

  it('returns false when not on the last slide', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    expect(selectIsLastSlide(useSlideStore.getState())).toBe(false);
  });

  it('returns false when no presentation is loaded', () => {
    expect(selectIsLastSlide(useSlideStore.getState())).toBe(false);
  });
});

describe('selectSlideCountLabel', () => {
  beforeEach(resetStore);

  it('returns "0 / 0" when no presentation is loaded', () => {
    expect(selectSlideCountLabel(useSlideStore.getState())).toBe('0 / 0');
  });

  it('returns "1 / 3" for first slide of a 3-slide deck', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    expect(selectSlideCountLabel(useSlideStore.getState())).toBe('1 / 3');
  });

  it('updates label after navigation', () => {
    useSlideStore.getState().setPresentation(THREE_SLIDES, DEFAULT_FM);
    useSlideStore.getState().goToSlide(2);
    expect(selectSlideCountLabel(useSlideStore.getState())).toBe('3 / 3');
  });
});
