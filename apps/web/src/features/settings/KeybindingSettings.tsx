'use client';

/**
 * KeybindingSettings — displays all keyboard shortcuts and allows per-user overrides.
 *
 * Layout:
 *   - Grouped by category (navigation, workspace, editor, view)
 *   - Each row shows: label, current combo, [Edit] button
 *   - Clicking Edit puts the row into "capture" mode — next keydown recorded
 *   - Overrides stored in useSettingsStore.shortcutOverrides
 *
 * No useEffect: capture mode is pure event handler state.
 */

import { useState } from 'react';
import {
  KEYBOARD_SHORTCUTS,
  formatCombo,
  type KeyboardShortcut,
  type KeyCombo,
  type ShortcutCategory,
} from '@/shared/lib/keyboard-shortcuts';
import { useSettingsStore } from './settings-store';

// ---------------------------------------------------------------------------
// Category labels
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<ShortcutCategory, string> = {
  navigation: 'Navigation',
  workspace: 'Workspace',
  editor: 'Editor',
  view: 'View',
};

const CATEGORY_ORDER: ShortcutCategory[] = ['navigation', 'workspace', 'editor', 'view'];

// ---------------------------------------------------------------------------
// Capture key combo from a keyboard event
// ---------------------------------------------------------------------------

function captureComboFromEvent(e: React.KeyboardEvent): KeyCombo | null {
  // Ignore modifier-only keypresses
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  return {
    key: e.key,
    mod: isMac ? e.metaKey : e.ctrlKey,
    shift: e.shiftKey || undefined,
    alt: e.altKey || undefined,
    ctrl: !isMac && e.ctrlKey ? true : undefined,
  };
}

// ---------------------------------------------------------------------------
// ShortcutRow
// ---------------------------------------------------------------------------

interface ShortcutRowProps {
  shortcut: KeyboardShortcut;
  effectiveCombo: KeyCombo;
  isOverridden: boolean;
  isCapturing: boolean;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onCaptured: (combo: KeyCombo) => void;
  onReset: () => void;
}

function ShortcutRow({
  shortcut,
  effectiveCombo,
  isOverridden,
  isCapturing,
  onStartCapture,
  onCancelCapture,
  onCaptured,
  onReset,
}: ShortcutRowProps) {
  function handleKeyDown(e: React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      onCancelCapture();
      return;
    }

    const combo = captureComboFromEvent(e);
    if (combo) onCaptured(combo);
  }

  return (
    <div
      className="flex items-center gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      {/* Label + scope badge */}
      <div className="flex-1 min-w-0">
        <span className="text-sm" style={{ color: 'var(--ns-color-foreground)' }}>
          {shortcut.label}
        </span>
        {shortcut.scope === 'editor' && (
          <span
            className="ml-2 text-xs rounded px-1 py-0.5"
            style={{
              backgroundColor: 'var(--ns-color-background-surface)',
              color: 'var(--ns-color-foreground-muted)',
              border: '1px solid var(--ns-color-border)',
            }}
          >
            editor
          </span>
        )}
      </div>

      {/* Key combo display / capture input */}
      {isCapturing ? (
        <div
          role="textbox"
          tabIndex={0}
          aria-label={`Press new shortcut for ${shortcut.label}. Press Escape to cancel.`}
          onKeyDown={handleKeyDown}
          autoFocus
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-mono cursor-text"
          style={{
            backgroundColor: 'var(--ns-color-primary)',
            color: 'var(--ns-color-primary-foreground)',
            minWidth: 100,
          }}
        >
          Press shortcut…
        </div>
      ) : (
        <kbd
          className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-mono"
          style={{
            backgroundColor: isOverridden
              ? 'var(--ns-color-primary-subtle)'
              : 'var(--ns-color-background-surface)',
            color: isOverridden
              ? 'var(--ns-color-primary)'
              : 'var(--ns-color-foreground-secondary)',
            border: `1px solid ${isOverridden ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
          }}
        >
          {formatCombo(effectiveCombo)}
        </kbd>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1">
        {isCapturing ? (
          <button
            type="button"
            onClick={onCancelCapture}
            className="text-xs px-2 py-1 rounded"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Cancel
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartCapture}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-background-hover"
            style={{ color: 'var(--ns-color-primary)' }}
          >
            Edit
          </button>
        )}
        {isOverridden && !isCapturing && (
          <button
            type="button"
            onClick={onReset}
            aria-label={`Reset ${shortcut.label} to default`}
            className="text-xs px-2 py-1 rounded transition-colors hover:bg-background-hover"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeybindingSettings
// ---------------------------------------------------------------------------

export function KeybindingSettings() {
  const shortcutOverrides = useSettingsStore((s) => s.shortcutOverrides);
  const setShortcutOverride = useSettingsStore((s) => s.setShortcutOverride);
  const resetShortcutOverride = useSettingsStore((s) => s.resetShortcutOverride);
  const resetAllShortcuts = useSettingsStore((s) => s.resetAllShortcuts);

  const [capturingId, setCapturingId] = useState<string | null>(null);

  const hasOverrides = Object.keys(shortcutOverrides).length > 0;

  // Group by category in defined order
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    shortcuts: KEYBOARD_SHORTCUTS.filter((s) => s.category === cat),
  }));

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Click Edit on any shortcut to assign a new key combination. Overridden shortcuts are
          highlighted.
        </p>
        {hasOverrides && (
          <button
            type="button"
            onClick={resetAllShortcuts}
            className="text-xs shrink-0 ml-4"
            style={{ color: 'var(--ns-color-destructive)' }}
          >
            Reset all
          </button>
        )}
      </div>

      {grouped.map(({ category, shortcuts }) => (
        <section key={category}>
          <h3
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            {CATEGORY_LABELS[category]}
          </h3>
          <div
            className="rounded-lg border"
            style={{
              borderColor: 'var(--ns-color-border)',
              backgroundColor: 'var(--ns-color-background-surface)',
              padding: '0 12px',
            }}
          >
            {shortcuts.map((shortcut) => {
              const override = shortcutOverrides[shortcut.id];
              const effectiveCombo =
                override !== undefined && override !== null ? override : shortcut.combo;
              const isOverridden = override !== undefined;

              return (
                <ShortcutRow
                  key={shortcut.id}
                  shortcut={shortcut}
                  effectiveCombo={effectiveCombo}
                  isOverridden={isOverridden}
                  isCapturing={capturingId === shortcut.id}
                  onStartCapture={() => setCapturingId(shortcut.id)}
                  onCancelCapture={() => setCapturingId(null)}
                  onCaptured={(combo) => {
                    setShortcutOverride(shortcut.id, combo);
                    setCapturingId(null);
                  }}
                  onReset={() => resetShortcutOverride(shortcut.id)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
