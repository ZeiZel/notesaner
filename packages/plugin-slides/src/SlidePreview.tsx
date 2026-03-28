/**
 * SlidePreview — side panel showing a rendered thumbnail of each slide with
 * navigation dots and a mini slide strip.
 *
 * The component reads state from `useSlideStore` and delegates markdown
 * rendering to a lightweight inline renderer (no external deps).
 */

import React, { useCallback } from 'react';
import { useSlideStore } from './slide-store';
import { getTheme, themeVarsToReactStyle } from './slide-themes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlidePreviewProps {
  /** Optional additional CSS class for the outer container. */
  className?: string;
  /**
   * Called when the user clicks a slide thumbnail.
   * The component also calls `goToSlide` internally, so this is purely
   * for external side-effects (e.g. scrolling the editor to the slide).
   */
  onSlideClick?: (index: number) => void;
}

// ---------------------------------------------------------------------------
// Mini slide renderer (static HTML via dangerouslySetInnerHTML)
// ---------------------------------------------------------------------------

/**
 * Very small markdown stripper that returns the first 200 chars of plain text
 * from a slide's content — used for thumbnail label fallback.
 */
function getSlidePreviewText(markdown: string): string {
  return markdown
    .replace(/^#{1,6}\s+/gm, '') // strip headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // strip bold/italic
    .replace(/`([^`]+)`/g, '$1') // strip inline code
    .replace(/<!--[\s\S]*?-->/g, '') // strip comments
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 200);
}

// ---------------------------------------------------------------------------
// Individual slide thumbnail
// ---------------------------------------------------------------------------

interface SlideThumbnailProps {
  index: number;
  title: string;
  content: string;
  isActive: boolean;
  themeId: string;
  onClick: (index: number) => void;
}

function SlideThumbnail({
  index,
  title,
  content,
  isActive,
  themeId,
  onClick,
}: SlideThumbnailProps): React.ReactElement {
  const theme = getTheme(themeId);
  const vars = themeVarsToReactStyle(theme);
  const previewText = getSlidePreviewText(content);
  const displayTitle = title || previewText.slice(0, 40) || `Slide ${index + 1}`;

  return (
    <button
      type="button"
      aria-label={`Go to slide ${index + 1}: ${displayTitle}`}
      aria-pressed={isActive}
      onClick={() => onClick(index)}
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '0.75rem',
        alignItems: 'flex-start',
        width: '100%',
        padding: '0.5rem 0.75rem',
        borderRadius: '0.4rem',
        border: isActive ? '2px solid #6366f1' : '2px solid transparent',
        background: isActive ? '#eef2ff' : 'transparent',
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 0.1s, border-color 0.1s',
        outline: 'none',
      }}
    >
      {/* Slide number badge */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: '1.5rem',
          height: '1.5rem',
          borderRadius: '50%',
          background: isActive ? '#6366f1' : '#e2e8f0',
          color: isActive ? '#fff' : '#64748b',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          marginTop: '0.1rem',
        }}
      >
        {index + 1}
      </span>

      {/* Mini slide card */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Thumbnail */}
        <div
          aria-hidden="true"
          style={{
            ...vars,
            width: '100%',
            aspectRatio: '16 / 9',
            borderRadius: '0.25rem',
            background: vars['--slide-bg'],
            border: `1px solid ${vars['--slide-indicator']}`,
            overflow: 'hidden',
            padding: '0.5rem 0.6rem',
            marginBottom: '0.3rem',
            fontSize: '5px',
            lineHeight: 1.4,
            color: vars['--slide-text'],
            fontFamily: vars['--slide-font-body'],
          }}
        >
          {/* Mock heading line */}
          {displayTitle && (
            <div
              style={{
                fontWeight: 700,
                color: vars['--slide-heading'],
                fontSize: '7px',
                marginBottom: '3px',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {displayTitle}
            </div>
          )}
          {/* Mock content lines */}
          {previewText && (
            <div
              style={{
                opacity: 0.6,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {previewText}
            </div>
          )}
        </div>

        {/* Slide title label */}
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: isActive ? 600 : 400,
            color: isActive ? '#3730a3' : '#475569',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            textOverflow: 'ellipsis',
            display: 'block',
          }}
        >
          {displayTitle}
        </span>
      </div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Navigation dots
// ---------------------------------------------------------------------------

interface NavDotsProps {
  total: number;
  current: number;
  onDotClick: (index: number) => void;
}

function NavDots({ total, current, onDotClick }: NavDotsProps): React.ReactElement | null {
  if (total === 0) return null;

  return (
    <div
      role="navigation"
      aria-label="Slide navigation dots"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.35rem',
        justifyContent: 'center',
        padding: '0.75rem 0.5rem',
        borderBottom: '1px solid #e2e8f0',
      }}
    >
      {Array.from({ length: total }).map((_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Slide ${i + 1}`}
          aria-pressed={i === current}
          onClick={() => onDotClick(i)}
          style={{
            width: i === current ? '1.25rem' : '0.5rem',
            height: '0.5rem',
            borderRadius: '0.25rem',
            border: 'none',
            background: i === current ? '#6366f1' : '#cbd5e1',
            cursor: 'pointer',
            padding: 0,
            transition: 'width 0.2s, background 0.15s',
            outline: 'none',
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * Slide preview panel — renders a scrollable thumbnail strip of all slides
 * with navigation dots at the top.
 */
export function SlidePreview({ className, onSlideClick }: SlidePreviewProps): React.ReactElement {
  const { slides, currentSlide, totalSlides, selectedTheme, goToSlide } = useSlideStore((s) => ({
    slides: s.slides,
    currentSlide: s.currentSlide,
    totalSlides: s.totalSlides,
    selectedTheme: s.selectedTheme,
    goToSlide: s.goToSlide,
  }));

  const handleThumbnailClick = useCallback(
    (index: number) => {
      goToSlide(index);
      onSlideClick?.(index);
    },
    [goToSlide, onSlideClick],
  );

  return (
    <aside
      className={className}
      aria-label="Slide preview panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#f8fafc',
        borderLeft: '1px solid #e2e8f0',
        minWidth: '200px',
        maxWidth: '260px',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderBottom: '1px solid #e2e8f0',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: '#475569',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>Slides</span>
        {totalSlides > 0 && (
          <span style={{ fontWeight: 400, opacity: 0.6 }}>
            {currentSlide + 1}&nbsp;/&nbsp;{totalSlides}
          </span>
        )}
      </div>

      {/* Navigation dots */}
      <NavDots total={totalSlides} current={currentSlide} onDotClick={handleThumbnailClick} />

      {/* Slide thumbnail list */}
      <div
        role="list"
        aria-label="Slide list"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.25rem',
        }}
      >
        {slides.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '0.8rem',
              padding: '2rem 1rem',
            }}
          >
            No slides loaded.
          </div>
        ) : (
          slides.map((slide) => (
            <div key={slide.index} role="listitem">
              <SlideThumbnail
                index={slide.index}
                title={slide.title}
                content={slide.content}
                isActive={slide.index === currentSlide}
                themeId={selectedTheme}
                onClick={handleThumbnailClick}
              />
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
