'use client';

/**
 * KeyCaptureInput -- Reusable key combination capture component.
 *
 * Renders an inline element that, when active, listens for the next keydown
 * event and converts it into a KeyCombo. Supports:
 *   - Modifier-only filtering (waits for a real key alongside modifiers)
 *   - Escape to cancel capture
 *   - Visual feedback for active/inactive states
 *
 * No useEffect: capture is driven entirely by the onKeyDown event handler.
 * Uses Ant Design Tag for display, Box for layout.
 */

import { useCallback } from 'react';
import { Tag, Typography } from 'antd';
import { Box } from '@/shared/ui';
import { formatCombo, type KeyCombo } from '@/shared/lib/keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyCaptureInputProps {
  /** Whether the component is actively capturing key input. */
  capturing: boolean;
  /** Current effective combo to display when not capturing. */
  currentCombo: KeyCombo;
  /** Whether this combo has been overridden from the default. */
  isOverridden?: boolean;
  /** Whether this combo has conflicts with other shortcuts. */
  hasConflict?: boolean;
  /** Optional pending combo to display while confirming (e.g. during conflict). */
  pendingCombo?: KeyCombo | null;
  /** Called when a valid key combo is pressed during capture. */
  onCapture: (combo: KeyCombo) => void;
  /** Called when the user presses Escape during capture. */
  onCancel: () => void;
  /** Label for the associated shortcut (used in aria-label). */
  shortcutLabel: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MODIFIER_KEYS = new Set(['Meta', 'Control', 'Alt', 'Shift']);

function captureComboFromEvent(e: React.KeyboardEvent): KeyCombo | null {
  // Ignore modifier-only keypresses -- wait for a real key
  if (MODIFIER_KEYS.has(e.key)) return null;

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  return {
    key: e.key,
    mod: (isMac ? e.metaKey : e.ctrlKey) || undefined,
    shift: e.shiftKey || undefined,
    alt: e.altKey || undefined,
    ctrl: !isMac && e.ctrlKey ? true : undefined,
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function KeyCaptureInput({
  capturing,
  currentCombo,
  isOverridden = false,
  hasConflict = false,
  pendingCombo,
  onCapture,
  onCancel,
  shortcutLabel,
}: KeyCaptureInputProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      const combo = captureComboFromEvent(e);
      if (combo) {
        onCapture(combo);
      }
    },
    [onCapture, onCancel],
  );

  if (capturing) {
    return (
      <Box
        role="textbox"
        tabIndex={0}
        aria-label={`Press new shortcut for ${shortcutLabel}. Press Escape to cancel.`}
        onKeyDown={handleKeyDown}
        autoFocus
        className="inline-flex items-center gap-1 rounded-md px-3 py-1 text-sm font-mono cursor-text select-none"
        style={{
          backgroundColor: 'var(--ns-color-primary)',
          color: 'var(--ns-color-primary-foreground, #fff)',
          minWidth: 100,
          outline: 'none',
        }}
      >
        <Typography.Text
          style={{
            color: 'inherit',
            fontSize: 12,
            fontFamily: 'monospace',
          }}
        >
          {pendingCombo ? formatCombo(pendingCombo) : 'Press shortcut...'}
        </Typography.Text>
      </Box>
    );
  }

  // Determine visual styling based on state
  const tagColor = hasConflict ? 'error' : isOverridden ? 'processing' : 'default';

  return (
    <Tag
      color={tagColor}
      style={{
        fontFamily: 'monospace',
        fontSize: 12,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {formatCombo(currentCombo)}
    </Tag>
  );
}
