'use client';

/**
 * KeyboardShortcuts — settings panel to view, customize, and detect conflicts
 * in keyboard shortcut bindings.
 *
 * Features:
 *   - All shortcuts grouped by category (navigation, workspace, editor, view)
 *   - Inline key combo capture: click "Edit" and press a new key combination
 *   - Conflict detection: warns when two actions share the same combo in overlapping scopes
 *   - Filter/search shortcuts by label
 *   - Reset individual overrides or all at once
 *
 * State lives in useShortcutStore (Zustand + localStorage).
 * No useEffect for UI state — capture mode uses event handlers only.
 */

import { useState, useMemo } from 'react';
import { KEYBOARD_SHORTCUTS, formatCombo, type KeyCombo } from '@/shared/lib/keyboard-shortcuts';
import {
  keyboardManager,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ResolvedShortcut,
} from '@/shared/lib/keyboard-manager';
import { useShortcutStore } from '@/shared/stores/shortcut-store';

// ---------------------------------------------------------------------------
// Capture combo from a keyboard event
// ---------------------------------------------------------------------------

function captureComboFromEvent(e: React.KeyboardEvent): KeyCombo | null {
  // Ignore modifier-only keypresses
  if (['Meta', 'Control', 'Alt', 'Shift'].includes(e.key)) return null;

  const isMac =
    typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');

  return {
    key: e.key,
    mod: isMac ? e.metaKey : e.ctrlKey || undefined,
    shift: e.shiftKey || undefined,
    alt: e.altKey || undefined,
    ctrl: !isMac && e.ctrlKey ? true : undefined,
  };
}

// ---------------------------------------------------------------------------
// ConflictBadge
// ---------------------------------------------------------------------------

function ConflictBadge({ conflictIds }: { conflictIds: string[] }) {
  // Look up labels for conflicting actions
  const labels = conflictIds
    .map((id) => KEYBOARD_SHORTCUTS.find((s) => s.id === id)?.label ?? id)
    .join(', ');

  return (
    <div
      className="flex items-center gap-1 text-xs mt-1"
      role="alert"
      style={{ color: 'var(--ns-color-destructive)' }}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="currentColor" aria-hidden="true">
        <path d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0M8 10.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2" />
      </svg>
      <span>Conflicts with: {labels}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShortcutRow
// ---------------------------------------------------------------------------

interface ShortcutRowProps {
  shortcut: ResolvedShortcut;
  isCapturing: boolean;
  onStartCapture: () => void;
  onCancelCapture: () => void;
  onCaptured: (combo: KeyCombo) => void;
  onReset: () => void;
}

function ShortcutRow({
  shortcut,
  isCapturing,
  onStartCapture,
  onCancelCapture,
  onCaptured,
  onReset,
}: ShortcutRowProps) {
  const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);
  const [pendingCombo, setPendingCombo] = useState<KeyCombo | null>(null);

  function handleKeyDown(e: React.KeyboardEvent) {
    e.preventDefault();
    e.stopPropagation();

    if (e.key === 'Escape') {
      setPendingConflicts([]);
      setPendingCombo(null);
      onCancelCapture();
      return;
    }

    const combo = captureComboFromEvent(e);
    if (!combo) return;

    // Check for conflicts before accepting
    const conflicts = keyboardManager.wouldConflict(combo, 'global', shortcut.id);
    if (conflicts.length > 0) {
      setPendingConflicts(conflicts);
      setPendingCombo(combo);
    } else {
      setPendingConflicts([]);
      setPendingCombo(null);
      onCaptured(combo);
    }
  }

  function handleForceAssign() {
    if (pendingCombo) {
      setPendingConflicts([]);
      setPendingCombo(null);
      onCaptured(pendingCombo);
    }
  }

  function handleCancelConflict() {
    setPendingConflicts([]);
    setPendingCombo(null);
    onCancelCapture();
  }

  const hasConflicts = shortcut.conflicts.length > 0;

  return (
    <div
      className="py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      <div className="flex items-center gap-3">
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
            {pendingCombo ? formatCombo(pendingCombo) : 'Press shortcut...'}
          </div>
        ) : (
          <kbd
            className="inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-mono"
            style={{
              backgroundColor: shortcut.isOverridden
                ? 'var(--ns-color-primary-subtle)'
                : hasConflicts
                  ? 'var(--ns-color-destructive-subtle, rgba(220, 38, 38, 0.1))'
                  : 'var(--ns-color-background-surface)',
              color: shortcut.isOverridden
                ? 'var(--ns-color-primary)'
                : hasConflicts
                  ? 'var(--ns-color-destructive)'
                  : 'var(--ns-color-foreground-secondary)',
              border: `1px solid ${
                shortcut.isOverridden
                  ? 'var(--ns-color-primary)'
                  : hasConflicts
                    ? 'var(--ns-color-destructive)'
                    : 'var(--ns-color-border)'
              }`,
            }}
          >
            {formatCombo(shortcut.effectiveCombo)}
          </kbd>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1">
          {isCapturing && pendingConflicts.length === 0 ? (
            <button
              type="button"
              onClick={() => {
                setPendingConflicts([]);
                setPendingCombo(null);
                onCancelCapture();
              }}
              className="text-xs px-2 py-1 rounded"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              Cancel
            </button>
          ) : isCapturing && pendingConflicts.length > 0 ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleForceAssign}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--ns-color-warning, #d97706)' }}
              >
                Assign anyway
              </button>
              <button
                type="button"
                onClick={handleCancelConflict}
                className="text-xs px-2 py-1 rounded"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                Cancel
              </button>
            </div>
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
          {shortcut.isOverridden && !isCapturing && (
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

      {/* Conflict warning for pending assignment */}
      {isCapturing && pendingConflicts.length > 0 && (
        <ConflictBadge conflictIds={pendingConflicts} />
      )}

      {/* Existing conflict warning */}
      {!isCapturing && hasConflicts && <ConflictBadge conflictIds={shortcut.conflicts} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KeyboardShortcuts (main component)
// ---------------------------------------------------------------------------

export function KeyboardShortcuts() {
  const overrides = useShortcutStore((s) => s.overrides);
  const setOverride = useShortcutStore((s) => s.setOverride);
  const resetOverride = useShortcutStore((s) => s.resetOverride);
  const resetAll = useShortcutStore((s) => s.resetAll);

  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const hasOverrides = Object.keys(overrides).length > 0;

  // Resolve all shortcuts with effective combos and conflicts
  const resolved = useMemo(() => {
    // Ensure overrides are synced to manager
    keyboardManager.setOverrides(overrides);
    return keyboardManager.getResolvedShortcuts();
  }, [overrides]);

  // Filter by search term
  const filteredResolved = useMemo(() => {
    if (!filter.trim()) return resolved;
    const term = filter.toLowerCase();
    return resolved.filter(
      (s) =>
        s.label.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        formatCombo(s.effectiveCombo).toLowerCase().includes(term),
    );
  }, [resolved, filter]);

  // Group by category
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    shortcuts: filteredResolved.filter((s) => s.category === cat),
  })).filter((g) => g.shortcuts.length > 0);

  // Conflict summary
  const totalConflicts = resolved.filter((s) => s.conflicts.length > 0).length;

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header with search and reset */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <input
            type="search"
            placeholder="Filter shortcuts..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full max-w-xs rounded-md border px-3 py-1.5 text-sm"
            style={{
              borderColor: 'var(--ns-color-border)',
              backgroundColor: 'var(--ns-color-background-surface)',
              color: 'var(--ns-color-foreground)',
            }}
            aria-label="Filter keyboard shortcuts"
          />
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {totalConflicts > 0 && (
            <span
              className="text-xs"
              style={{ color: 'var(--ns-color-destructive)' }}
              role="status"
            >
              {totalConflicts} conflict{totalConflicts !== 1 ? 's' : ''}
            </span>
          )}
          {hasOverrides && (
            <button
              type="button"
              onClick={resetAll}
              className="text-xs"
              style={{ color: 'var(--ns-color-destructive)' }}
            >
              Reset all
            </button>
          )}
        </div>
      </div>

      <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
        Click Edit on any shortcut to assign a new key combination. Conflicts are highlighted in
        red.
      </p>

      {/* Shortcut groups */}
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
            {shortcuts.map((shortcut) => (
              <ShortcutRow
                key={shortcut.id}
                shortcut={shortcut}
                isCapturing={capturingId === shortcut.id}
                onStartCapture={() => setCapturingId(shortcut.id)}
                onCancelCapture={() => setCapturingId(null)}
                onCaptured={(combo) => {
                  setOverride(shortcut.id, combo);
                  setCapturingId(null);
                }}
                onReset={() => resetOverride(shortcut.id)}
              />
            ))}
          </div>
        </section>
      ))}

      {/* No results */}
      {grouped.length === 0 && filter.trim() && (
        <p
          className="text-sm text-center py-8"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          No shortcuts match &ldquo;{filter}&rdquo;
        </p>
      )}
    </div>
  );
}
