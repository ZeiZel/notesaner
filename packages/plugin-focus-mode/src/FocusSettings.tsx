/**
 * FocusSettings — Settings panel for the Focus Mode plugin.
 *
 * Controls:
 *   - Word count goal (number input)
 *   - Typewriter mode toggle
 *   - Zen mode toggle
 *   - Dim inactive paragraphs toggle
 *   - Ambient sounds selector
 *
 * Rendered as a slide-in panel from the right. Opens when the user clicks
 * the settings gear icon in the FocusToolbar (external toggle control).
 */

import React, { useCallback } from 'react';
import type { AmbientSound } from './focus-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FocusSettingsProps {
  /** Whether the settings panel is open. */
  isOpen: boolean;
  /** Called when the user closes the panel. */
  onClose: () => void;

  // --- Current values ---
  wordCountGoal: number;
  typewriterMode: boolean;
  isZenMode: boolean;
  dimInactiveParagraphs: boolean;
  musicEnabled: boolean;
  ambientSound: AmbientSound;

  // --- Change handlers ---
  onWordCountGoalChange: (goal: number) => void;
  onTypewriterModeChange: (enabled: boolean) => void;
  onZenModeChange: (enabled: boolean) => void;
  onDimInactiveParagraphsChange: (enabled: boolean) => void;
  onMusicEnabledChange: (enabled: boolean) => void;
  onAmbientSoundChange: (sound: AmbientSound) => void;
}

// ---------------------------------------------------------------------------
// Ambient sound options
// ---------------------------------------------------------------------------

const AMBIENT_SOUNDS: { value: AmbientSound; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'rain', label: 'Rain' },
  { value: 'forest', label: 'Forest' },
  { value: 'cafe', label: 'Cafe' },
  { value: 'waves', label: 'Ocean Waves' },
  { value: 'white-noise', label: 'White Noise' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ToggleRowProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: ToggleRowProps): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '12px',
        padding: '12px 0',
        borderBottom: '1px solid var(--color-border, #f1f5f9)',
      }}
    >
      <div style={{ flex: 1 }}>
        <label
          htmlFor={id}
          style={{
            display: 'block',
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--color-text, #1e293b)',
            cursor: 'pointer',
            marginBottom: description ? '2px' : 0,
          }}
        >
          {label}
        </label>
        {description && (
          <p
            style={{
              fontSize: '11px',
              color: 'var(--color-text-muted, #94a3b8)',
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        style={{
          flexShrink: 0,
          width: '36px',
          height: '20px',
          borderRadius: '10px',
          border: 'none',
          background: checked ? '#6366f1' : 'var(--color-border, #cbd5e1)',
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 0.2s',
          padding: 0,
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: '2px',
            left: checked ? '18px' : '2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: '#ffffff',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }}
          aria-hidden="true"
        />
        <span className="sr-only">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FocusSettings
// ---------------------------------------------------------------------------

export function FocusSettings({
  isOpen,
  onClose,
  wordCountGoal,
  typewriterMode,
  isZenMode,
  dimInactiveParagraphs,
  musicEnabled,
  ambientSound,
  onWordCountGoalChange,
  onTypewriterModeChange,
  onZenModeChange,
  onDimInactiveParagraphsChange,
  onMusicEnabledChange,
  onAmbientSoundChange,
}: FocusSettingsProps): React.ReactElement {
  const handleGoalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      onWordCountGoalChange(isNaN(val) ? 0 : Math.max(0, val));
    },
    [onWordCountGoalChange],
  );

  const handleSoundChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onAmbientSoundChange(e.target.value as AmbientSound);
    },
    [onAmbientSoundChange],
  );

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 10001,
            background: 'transparent',
          }}
        />
      )}

      {/* Panel */}
      <div
        role="dialog"
        aria-label="Focus mode settings"
        aria-modal="true"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '300px',
          background: 'var(--color-bg, #ffffff)',
          borderLeft: '1px solid var(--color-border, #e2e8f0)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
          zIndex: 10002,
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--color-border, #e2e8f0)',
            flexShrink: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '15px',
              fontWeight: 600,
              color: 'var(--color-text, #1e293b)',
            }}
          >
            Focus Settings
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              border: 'none',
              borderRadius: '6px',
              background: 'transparent',
              cursor: 'pointer',
              color: 'var(--color-text-muted, #94a3b8)',
              fontSize: '18px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Scrollable settings body */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 20px 24px' }}>
          {/* Word count goal */}
          <section style={{ paddingTop: '16px' }}>
            <h3
              style={{
                margin: '0 0 12px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            >
              Writing Goal
            </h3>
            <div>
              <label
                htmlFor="fm-word-goal"
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 500,
                  marginBottom: '6px',
                  color: 'var(--color-text, #1e293b)',
                }}
              >
                Word count goal
              </label>
              <p
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-muted, #94a3b8)',
                  margin: '0 0 8px',
                  lineHeight: 1.4,
                }}
              >
                Set a target number of words for this session. Leave at 0 to disable.
              </p>
              <input
                id="fm-word-goal"
                type="number"
                min={0}
                max={100000}
                step={50}
                value={wordCountGoal === 0 ? '' : wordCountGoal}
                placeholder="0 (no goal)"
                onChange={handleGoalChange}
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  fontSize: '13px',
                  border: '1px solid var(--color-border, #e2e8f0)',
                  borderRadius: '6px',
                  background: 'var(--color-bg-input, #f8fafc)',
                  color: 'var(--color-text, #1e293b)',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>
          </section>

          {/* Mode toggles */}
          <section style={{ paddingTop: '20px' }}>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            >
              Writing Mode
            </h3>

            <ToggleRow
              id="fm-typewriter"
              label="Typewriter scrolling"
              description="Keeps the cursor line vertically centred while you type."
              checked={typewriterMode}
              onChange={onTypewriterModeChange}
            />

            <ToggleRow
              id="fm-zen-mode"
              label="Zen mode"
              description="Full screen, only text visible. Press Esc to exit."
              checked={isZenMode}
              onChange={onZenModeChange}
            />

            <ToggleRow
              id="fm-dim-paragraphs"
              label="Dim inactive paragraphs"
              description="Reduces opacity of paragraphs the cursor is not in."
              checked={dimInactiveParagraphs}
              onChange={onDimInactiveParagraphsChange}
            />
          </section>

          {/* Ambient sounds */}
          <section style={{ paddingTop: '20px' }}>
            <h3
              style={{
                margin: '0 0 4px',
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: 'var(--color-text-muted, #94a3b8)',
              }}
            >
              Ambient Sound
            </h3>

            <ToggleRow
              id="fm-music-enabled"
              label="Enable ambient sound"
              description="Play background audio to help you focus."
              checked={musicEnabled}
              onChange={onMusicEnabledChange}
            />

            {musicEnabled && (
              <div style={{ paddingTop: '8px' }}>
                <label
                  htmlFor="fm-ambient-sound"
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 500,
                    marginBottom: '6px',
                    color: 'var(--color-text, #1e293b)',
                  }}
                >
                  Sound track
                </label>
                <select
                  id="fm-ambient-sound"
                  value={ambientSound}
                  onChange={handleSoundChange}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: '13px',
                    border: '1px solid var(--color-border, #e2e8f0)',
                    borderRadius: '6px',
                    background: 'var(--color-bg-input, #f8fafc)',
                    color: 'var(--color-text, #1e293b)',
                    boxSizing: 'border-box',
                    cursor: 'pointer',
                  }}
                >
                  {AMBIENT_SOUNDS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
