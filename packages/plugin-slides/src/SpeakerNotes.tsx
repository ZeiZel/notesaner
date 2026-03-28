/**
 * SpeakerNotes — displays current and next slide speaker notes in the
 * presenter view.
 *
 * Intended to be rendered alongside the fullscreen SlidePresenter so the
 * presenter can see notes without them appearing on the audience display.
 * In the exported single-window mode, it renders as a compact bottom panel.
 */

import React from 'react';
import { useSlideStore, selectCurrentSlide, selectNextSlide } from './slide-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SpeakerNotesProps {
  /** Optional additional CSS class. */
  className?: string;
  /** Optional inline style overrides. */
  style?: React.CSSProperties;
  /**
   * Layout variant.
   * - "panel"    — compact bottom strip, suitable for single-window use
   * - "window"   — full notes view meant for a second display
   */
  variant?: 'panel' | 'window';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Renders the speaker notes for the current and optionally the next slide.
 *
 * Consumes `useSlideStore` — must be rendered within the same React tree as
 * `SlidePresenter` / `SlidePreview`.
 */
export function SpeakerNotes({
  className,
  style,
  variant = 'panel',
}: SpeakerNotesProps): React.ReactElement | null {
  const currentSlide = useSlideStore(selectCurrentSlide);
  const nextSlide = useSlideStore(selectNextSlide);
  const {
    currentSlide: currentIndex,
    totalSlides,
    speakerNotesVisible,
  } = useSlideStore((s) => ({
    currentSlide: s.currentSlide,
    totalSlides: s.totalSlides,
    speakerNotesVisible: s.speakerNotesVisible,
  }));

  if (!speakerNotesVisible) return null;

  const currentNotes = currentSlide?.speakerNotes ?? '';
  const nextNotes = nextSlide?.speakerNotes ?? '';
  const nextTitle = nextSlide?.title ?? `Slide ${currentIndex + 2}`;

  const isWindow = variant === 'window';

  return (
    <aside
      className={className}
      aria-label="Speaker notes"
      style={{
        background: 'var(--slide-notes-bg, #f8fafc)',
        color: 'var(--slide-notes-text, #475569)',
        fontFamily: 'var(--slide-font-body, system-ui, sans-serif)',
        fontSize: isWindow ? '1.1rem' : '0.875rem',
        lineHeight: 1.6,
        padding: isWindow ? '1.5rem 2rem' : '0.75rem 1.25rem',
        display: 'flex',
        flexDirection: isWindow ? 'column' : 'row',
        gap: isWindow ? '1.5rem' : '2rem',
        ...(isWindow
          ? { minHeight: '100%', overflowY: 'auto' }
          : { borderTop: '1px solid var(--slide-indicator, #94a3b8)' }),
        ...style,
      }}
    >
      {/* Slide counter */}
      <div
        style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          opacity: 0.5,
          flexShrink: 0,
          alignSelf: 'flex-start',
        }}
      >
        {currentIndex + 1}&nbsp;/&nbsp;{totalSlides}
      </div>

      {/* Current slide notes */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: '0.7rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            opacity: 0.5,
            marginBottom: '0.4rem',
          }}
        >
          Current Notes
        </div>
        {currentNotes ? (
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{currentNotes}</p>
        ) : (
          <p style={{ margin: 0, opacity: 0.4, fontStyle: 'italic' }}>No notes for this slide.</p>
        )}
      </div>

      {/* Next slide preview (only when not on the last slide) */}
      {nextSlide && (
        <div
          style={{
            flex: 1,
            minWidth: 0,
            paddingLeft: isWindow ? 0 : '1.5rem',
            borderLeft: isWindow ? 'none' : '1px solid var(--slide-indicator, #94a3b8)',
            borderTop: isWindow ? '1px solid var(--slide-indicator, #94a3b8)' : 'none',
            paddingTop: isWindow ? '1rem' : 0,
            opacity: 0.7,
          }}
        >
          <div
            style={{
              fontSize: '0.7rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '0.25rem',
            }}
          >
            Next: {nextTitle || `Slide ${currentIndex + 2}`}
          </div>
          {nextNotes ? (
            <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{nextNotes}</p>
          ) : (
            <p style={{ margin: 0, opacity: 0.4, fontStyle: 'italic' }}>No notes.</p>
          )}
        </div>
      )}
    </aside>
  );
}
