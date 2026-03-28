'use client';

/**
 * KeybindingSettings -- displays all keyboard shortcuts and allows per-user overrides.
 *
 * Layout:
 *   - Grouped by category (navigation, workspace, editor, view)
 *   - Each row shows: label, current combo, [Edit] button
 *   - Clicking Edit puts the row into "capture" mode -- next keydown recorded
 *   - Overrides stored in useSettingsStore.shortcutOverrides
 *
 * No useEffect: capture mode is pure event handler state.
 * Styled with Ant Design Button, Tag, Typography, Card.
 */

import { useState } from 'react';
import { Button, Tag, Typography, Card, Space } from 'antd';
import { Box } from '@/shared/ui';
import {
  KEYBOARD_SHORTCUTS,
  formatCombo,
  type KeyboardShortcut,
  type KeyCombo,
  type ShortcutCategory,
} from '@/shared/lib/keyboard-shortcuts';
import { useSettingsStore } from '../model/settings-store';

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
    <Box
      className="flex items-center gap-3 py-2.5 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      {/* Label + scope badge */}
      <Box className="flex-1 min-w-0">
        <Typography.Text style={{ fontSize: 14 }}>{shortcut.label}</Typography.Text>
        {shortcut.scope === 'editor' && <Tag style={{ marginLeft: 8, fontSize: 11 }}>editor</Tag>}
      </Box>

      {/* Key combo display / capture input */}
      {isCapturing ? (
        <Box
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
          Press shortcut...
        </Box>
      ) : (
        <Tag
          color={isOverridden ? 'processing' : 'default'}
          style={{ fontFamily: 'monospace', fontSize: 12 }}
        >
          {formatCombo(effectiveCombo)}
        </Tag>
      )}

      {/* Actions */}
      <Space size={4}>
        {isCapturing ? (
          <Button type="text" size="small" onClick={onCancelCapture}>
            Cancel
          </Button>
        ) : (
          <Button type="link" size="small" onClick={onStartCapture}>
            Edit
          </Button>
        )}
        {isOverridden && !isCapturing && (
          <Button
            type="text"
            size="small"
            onClick={onReset}
            aria-label={`Reset ${shortcut.label} to default`}
          >
            Reset
          </Button>
        )}
      </Space>
    </Box>
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
    <Box className="max-w-2xl" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Box className="flex items-center justify-between">
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Click Edit on any shortcut to assign a new key combination. Overridden shortcuts are
          highlighted.
        </Typography.Text>
        {hasOverrides && (
          <Button type="link" danger size="small" onClick={resetAllShortcuts}>
            Reset all
          </Button>
        )}
      </Box>

      {grouped.map(({ category, shortcuts }) => (
        <Box as="section" key={category}>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              display: 'block',
              marginBottom: 8,
            }}
          >
            {CATEGORY_LABELS[category]}
          </Typography.Text>
          <Card size="small" styles={{ body: { padding: '0 12px' } }}>
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
          </Card>
        </Box>
      ))}
    </Box>
  );
}
