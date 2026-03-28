/**
 * SessionStats — Bottom-right HUD showing live session metrics.
 *
 * Displayed items:
 *   - Session time elapsed (MM:SS / H:MM:SS)
 *   - Words written this session
 *   - Words per minute (WPM) — hidden during the first 10 seconds
 *   - Goal progress indicator (WordGoalProgress ring)
 *
 * Placed in the bottom-right corner of the viewport.
 * Hidden in zen mode.
 * Fades in when focus mode becomes active.
 */

import React, { useEffect, useState } from 'react';
import { computeSessionStats } from './focus-mode';
import { WordGoalProgress } from './WordGoalProgress';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SessionStatsProps {
  /** Whether focus mode is currently active. */
  isActive: boolean;
  /** Whether zen mode is active (stats are hidden). */
  isZenMode: boolean;
  /** Words written since the session started. */
  sessionWordCount: number;
  /** Unix timestamp (ms) when the session started. null when not active. */
  sessionStartTime: number | null;
  /** Word count goal. 0 = no goal. */
  wordCountGoal: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SessionStats({
  isActive,
  isZenMode,
  sessionWordCount,
  sessionStartTime,
  wordCountGoal,
}: SessionStatsProps): React.ReactElement | null {
  // Tick every second to update elapsed time / WPM
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!isActive || isZenMode) return;

    const interval = window.setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isActive, isZenMode]);

  if (!isActive || isZenMode) return null;

  const stats = computeSessionStats(sessionWordCount, sessionStartTime, wordCountGoal);

  return (
    <div
      aria-live="polite"
      aria-label="Session statistics"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        background: 'var(--color-bg-elevated, rgba(255,255,255,0.9))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--color-border, rgba(0,0,0,0.08))',
        borderRadius: '10px',
        padding: '8px 14px',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        zIndex: 9995,
        fontSize: '12px',
        color: 'var(--color-text-muted, #64748b)',
        userSelect: 'none',
        // Force tick to re-evaluate — the variable is referenced to satisfy
        // the linter's "no-unused-vars" rule without affecting the render output.
        // React calls this function on every state change, so the timer re-render
        // is the actual mechanism for updating elapsed time.
      }}
      data-tick={tick}
    >
      {/* Elapsed time */}
      <StatItem label="Time" value={stats.elapsedFormatted} />

      <Divider />

      {/* Words written */}
      <StatItem label="Words" value={String(stats.wordsWritten)} />

      {/* WPM (shown only after 10 seconds) */}
      {stats.wordsPerMinute > 0 && (
        <>
          <Divider />
          <StatItem label="WPM" value={String(stats.wordsPerMinute)} />
        </>
      )}

      {/* Goal progress ring */}
      {wordCountGoal > 0 && (
        <>
          <Divider />
          <WordGoalProgress wordsWritten={stats.wordsWritten} wordCountGoal={wordCountGoal} />
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function StatItem({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1px',
        minWidth: '36px',
      }}
    >
      <span
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text, #1e293b)',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          lineHeight: 1,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Divider(): React.ReactElement {
  return (
    <div
      aria-hidden="true"
      style={{
        width: '1px',
        height: '24px',
        background: 'var(--color-border, rgba(0,0,0,0.08))',
        flexShrink: 0,
      }}
    />
  );
}
