/**
 * SlidePresenter — fullscreen presentation mode component.
 *
 * Features:
 * - Fullscreen overlay that covers the entire viewport
 * - Keyboard navigation: ArrowLeft / ArrowRight, Escape (exit), F (fullscreen API)
 * - Slide transitions (fade or slide — CSS-based)
 * - Slide counter (current / total)
 * - Speaker notes panel (toggle with N key)
 * - Theme application via CSS custom properties
 * - Touch/swipe support
 */

import React, { useEffect, useCallback, useRef } from 'react';
import {
  useSlideStore,
  selectCurrentSlide,
  selectIsFirstSlide,
  selectIsLastSlide,
  selectSlideCountLabel,
} from './slide-store';
import { getTheme, themeVarsToReactStyle } from './slide-themes';
import { SpeakerNotes } from './SpeakerNotes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SlidePresenterProps {
  /** Called when the user exits presentation mode (Escape key or close button). */
  onClose?: () => void;
  /** Optional additional CSS class for the root element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Minimal markdown-to-JSX renderer for slide content
// ---------------------------------------------------------------------------

/**
 * Renders the plain-text content of a slide as JSX.
 *
 * For production quality you would use a full markdown renderer.
 * This implementation handles the core cases needed for slide content.
 */
function renderMarkdownToJsx(markdown: string): React.ReactNode {
  if (!markdown.trim()) return null;

  // Process fenced code blocks
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let blockKey = 0;
  let match: RegExpExecArray | null;

  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    // Render text before the code block as paragraphs
    if (match.index > lastIndex) {
      parts.push(renderBlocks(markdown.slice(lastIndex, match.index), blockKey++));
    }
    parts.push(
      <pre key={`code-${blockKey++}`} style={{ overflowX: 'auto', margin: '0.75em 0' }}>
        <code>{match[2].trimEnd()}</code>
      </pre>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < markdown.length) {
    parts.push(renderBlocks(markdown.slice(lastIndex), blockKey++));
  }

  return <>{parts}</>;
}

function renderBlocks(text: string, startKey: number): React.ReactNode {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    const key = startKey + bi;

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1].length as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag = `h${level}` as keyof React.JSX.IntrinsicElements;
      return <Tag key={key}>{renderInline(headingMatch[2])}</Tag>;
    }

    // Blockquote
    if (trimmed.startsWith('> ')) {
      const content = trimmed
        .split('\n')
        .map((l) => l.replace(/^>\s?/, ''))
        .join('\n');
      return <blockquote key={key}>{renderInline(content)}</blockquote>;
    }

    // Unordered list
    if (/^[-*+]\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^[-*+]\s/.test(l))
        .map((l, i) => <li key={i}>{renderInline(l.replace(/^[-*+]\s+/, ''))}</li>);
      return <ul key={key}>{items}</ul>;
    }

    // Ordered list
    if (/^\d+\.\s/.test(trimmed)) {
      const items = trimmed
        .split('\n')
        .filter((l) => /^\d+\.\s/.test(l))
        .map((l, i) => <li key={i}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</li>);
      return <ol key={key}>{items}</ol>;
    }

    // Horizontal rule
    if (/^[-*_]{3,}$/.test(trimmed)) {
      return <hr key={key} />;
    }

    // Paragraph
    const lines = trimmed.split('\n').map((l, i) => (
      <React.Fragment key={i}>
        {i > 0 && <br />}
        {renderInline(l)}
      </React.Fragment>
    ));
    return <p key={key}>{lines}</p>;
  });
}

function renderInline(text: string): React.ReactNode {
  // Split on bold+italic, bold, italic, code
  const segments: React.ReactNode[] = [];
  const re = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|__(.+?)__|`([^`]+)`|\*([^*]+)\*|_([^_]+)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    if (m.index > last) segments.push(text.slice(last, m.index));
    if (m[2])
      segments.push(
        <strong key={m.index}>
          <em>{m[2]}</em>
        </strong>,
      );
    else if (m[3]) segments.push(<strong key={m.index}>{m[3]}</strong>);
    else if (m[4]) segments.push(<strong key={m.index}>{m[4]}</strong>);
    else if (m[5]) segments.push(<code key={m.index}>{m[5]}</code>);
    else if (m[6]) segments.push(<em key={m.index}>{m[6]}</em>);
    else if (m[7]) segments.push(<em key={m.index}>{m[7]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) segments.push(text.slice(last));
  return segments.length === 1 ? segments[0] : <>{segments}</>;
}

// ---------------------------------------------------------------------------
// SlidePresenter component
// ---------------------------------------------------------------------------

export function SlidePresenter({
  onClose,
  className,
}: SlidePresenterProps): React.ReactElement | null {
  const {
    isPresenting,
    slides,
    currentSlide: currentIndex,
    totalSlides,
    selectedTheme,
    speakerNotesVisible,
    nextSlide,
    prevSlide,
    stopPresenting,
    toggleSpeakerNotes,
  } = useSlideStore((s) => ({
    isPresenting: s.isPresenting,
    slides: s.slides,
    currentSlide: s.currentSlide,
    totalSlides: s.totalSlides,
    selectedTheme: s.selectedTheme,
    speakerNotesVisible: s.speakerNotesVisible,
    nextSlide: s.nextSlide,
    prevSlide: s.prevSlide,
    stopPresenting: s.stopPresenting,
    toggleSpeakerNotes: s.toggleSpeakerNotes,
  }));

  const currentSlideData = useSlideStore(selectCurrentSlide);
  const isFirst = useSlideStore(selectIsFirstSlide);
  const isLast = useSlideStore(selectIsLastSlide);
  const countLabel = useSlideStore(selectSlideCountLabel);

  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartXRef = useRef<number>(0);

  // Keyboard handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isPresenting) return;
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Escape':
          e.preventDefault();
          stopPresenting();
          onClose?.();
          break;
        case 'f':
        case 'F':
          if (document.fullscreenElement) {
            void document.exitFullscreen();
          } else {
            void containerRef.current?.requestFullscreen();
          }
          break;
        case 'n':
        case 'N':
          toggleSpeakerNotes();
          break;
      }
    },
    [isPresenting, nextSlide, prevSlide, stopPresenting, toggleSpeakerNotes, onClose],
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Touch/swipe handler
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const dx = e.changedTouches[0].clientX - touchStartXRef.current;
      if (Math.abs(dx) > 50) {
        if (dx < 0) nextSlide();
        else prevSlide();
      }
    },
    [nextSlide, prevSlide],
  );

  if (!isPresenting || slides.length === 0) return null;

  const theme = getTheme(selectedTheme);
  const themeVars = themeVarsToReactStyle(theme);

  const handleClose = () => {
    stopPresenting();
    onClose?.();
  };

  return (
    <div
      ref={containerRef}
      className={className}
      role="presentation"
      aria-label="Slide presentation"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{
        ...themeVars,
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        background: themeVars['--slide-bg'],
        color: themeVars['--slide-text'],
        fontFamily: themeVars['--slide-font-body'],
        fontSize: themeVars['--slide-font-size'],
      }}
    >
      {/* Slides area */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {slides.map((slide, i) => {
          const isActive = i === currentIndex;
          const isPrev = i < currentIndex;
          return (
            <div
              key={slide.index}
              aria-hidden={!isActive}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'flex-start',
                padding: '4rem 6rem',
                opacity: isActive ? 1 : 0,
                transform: isPrev
                  ? 'translateX(-100%)'
                  : isActive
                    ? 'translateX(0)'
                    : 'translateX(100%)',
                transition: 'opacity 0.35s ease, transform 0.35s ease',
                pointerEvents: isActive ? 'auto' : 'none',
              }}
            >
              <div
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  // Slide content styles
                  lineHeight: 1.65,
                }}
                className="slide-content"
              >
                {renderMarkdownToJsx(slide.content)}
              </div>
            </div>
          );
        })}

        {/* Progress bar */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            height: '3px',
            background: themeVars['--slide-accent'],
            width: `${totalSlides > 0 ? ((currentIndex + 1) / totalSlides) * 100 : 0}%`,
            transition: 'width 0.35s ease',
          }}
        />
      </div>

      {/* Speaker notes */}
      {speakerNotesVisible && (
        <SpeakerNotes
          variant="panel"
          style={{ maxHeight: '22vh', overflowY: 'auto' } as React.CSSProperties}
        />
      )}

      {/* Controls overlay */}
      <div
        aria-label="Presentation controls"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.25), transparent)',
          opacity: 0,
          transition: 'opacity 0.2s',
          pointerEvents: 'none',
        }}
        className="controls-bar"
      >
        <span
          style={{
            color: '#fff',
            fontSize: '0.8rem',
            fontWeight: 600,
            textShadow: '0 1px 2px rgba(0,0,0,0.5)',
          }}
        >
          {currentSlideData?.title || `Slide ${currentIndex + 1}`}
        </span>
      </div>

      {/* Bottom bar: counter + nav buttons */}
      <div
        aria-label="Slide navigation"
        style={{
          position: 'absolute',
          bottom: speakerNotesVisible ? 'calc(22vh + 3px)' : '3px',
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.5rem 1.25rem',
          pointerEvents: 'none',
        }}
      >
        {/* Prev button */}
        <button
          type="button"
          aria-label="Previous slide"
          disabled={isFirst}
          onClick={prevSlide}
          style={{
            pointerEvents: 'auto',
            background: 'rgba(0,0,0,0.4)',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '2.25rem',
            height: '2.25rem',
            cursor: isFirst ? 'not-allowed' : 'pointer',
            opacity: isFirst ? 0.3 : 0.8,
            fontSize: '1.1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'opacity 0.15s',
          }}
        >
          &#8592;
        </button>

        {/* Slide counter */}
        <span
          aria-live="polite"
          style={{
            color: themeVars['--slide-indicator'],
            fontSize: '0.85rem',
            fontFamily: themeVars['--slide-font-body'],
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {countLabel}
        </span>

        {/* Right side: notes toggle + close + next */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', pointerEvents: 'auto' }}
        >
          <button
            type="button"
            aria-label={speakerNotesVisible ? 'Hide speaker notes' : 'Show speaker notes'}
            aria-pressed={speakerNotesVisible}
            onClick={toggleSpeakerNotes}
            style={{
              background: speakerNotesVisible ? 'rgba(99,102,241,0.6)' : 'rgba(0,0,0,0.4)',
              color: '#fff',
              border: 'none',
              borderRadius: '0.3rem',
              padding: '0.3rem 0.5rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
              opacity: 0.8,
            }}
          >
            Notes
          </button>

          <button
            type="button"
            aria-label="Exit presentation"
            onClick={handleClose}
            style={{
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '2.25rem',
              height: '2.25rem',
              cursor: 'pointer',
              fontSize: '1rem',
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            &#10005;
          </button>

          <button
            type="button"
            aria-label="Next slide"
            disabled={isLast}
            onClick={nextSlide}
            style={{
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              border: 'none',
              borderRadius: '50%',
              width: '2.25rem',
              height: '2.25rem',
              cursor: isLast ? 'not-allowed' : 'pointer',
              opacity: isLast ? 0.3 : 0.8,
              fontSize: '1.1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'opacity 0.15s',
            }}
          >
            &#8594;
          </button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: speakerNotesVisible ? 'calc(22vh + 2.75rem)' : '2.75rem',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '0.7rem',
          color: themeVars['--slide-indicator'],
          opacity: 0.6,
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        ← → navigate &nbsp;·&nbsp; Esc exit &nbsp;·&nbsp; F fullscreen &nbsp;·&nbsp; N notes
      </div>
    </div>
  );
}
