/**
 * WordGoalProgress — Circular progress indicator for the word count goal.
 *
 * Renders a circular SVG progress ring. When the goal is met:
 *   - The ring turns green.
 *   - A subtle pulse animation plays to celebrate the milestone.
 *
 * Renders nothing when no goal is set (wordCountGoal === 0).
 */

import React, { useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RADIUS = 20;
const STROKE_WIDTH = 3;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface WordGoalProgressProps {
  /** Number of words written this session. */
  wordsWritten: number;
  /** Target word count. 0 = no goal (component renders nothing). */
  wordCountGoal: number;
  /** Optional extra className for the container element. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WordGoalProgress({
  wordsWritten,
  wordCountGoal,
  className,
}: WordGoalProgressProps): React.ReactElement | null {
  const containerRef = useRef<HTMLDivElement>(null);
  const prevGoalReached = useRef(false);

  if (wordCountGoal <= 0) return null;

  const progress = Math.min(1, wordsWritten / wordCountGoal);
  const goalReached = wordsWritten >= wordCountGoal;
  const strokeDashoffset = CIRCUMFERENCE * (1 - progress);

  const trackColor = 'rgba(148,163,184,0.25)';
  const progressColor = goalReached ? '#22c55e' : '#6366f1';
  const textColor = goalReached ? '#16a34a' : 'var(--color-text-muted, #64748b)';

  const percentText =
    progress >= 1
      ? '100%'
      : progress >= 0.1
        ? `${Math.round(progress * 100)}%`
        : `${Math.round(progress * 100)}%`;

  // Pulse animation on goal completion
  useEffect(() => {
    if (goalReached && !prevGoalReached.current && containerRef.current) {
      const el = containerRef.current;
      el.style.animation = 'none';
      // Trigger reflow to restart animation
      void el.offsetWidth;
      el.style.animation = 'fm-goal-pulse 0.6s ease-out';
    }
    prevGoalReached.current = goalReached;
  }, [goalReached]);

  return (
    <>
      <style>{`
        @keyframes fm-goal-pulse {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.2); }
          70%  { transform: scale(0.95); }
          100% { transform: scale(1); }
        }
      `}</style>
      <div
        ref={containerRef}
        className={className}
        title={`${wordsWritten} / ${wordCountGoal} words (${percentText})`}
        aria-label={`Word goal: ${wordsWritten} of ${wordCountGoal} words written`}
        role="progressbar"
        aria-valuenow={wordsWritten}
        aria-valuemin={0}
        aria-valuemax={wordCountGoal}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          width: SIZE,
          height: SIZE,
          flexShrink: 0,
        }}
      >
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
          style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
        >
          {/* Track (background ring) */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE_WIDTH}
          />
          {/* Progress ring */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke={progressColor}
            strokeWidth={STROKE_WIDTH}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 0.4s ease, stroke 0.4s ease' }}
          />
        </svg>

        {/* Percentage label in the centre */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            fontSize: '9px',
            fontWeight: 600,
            color: textColor,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            pointerEvents: 'none',
            transition: 'color 0.4s ease',
          }}
        >
          {goalReached ? '✓' : percentText}
        </span>
      </div>
    </>
  );
}
