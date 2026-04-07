'use client';

/**
 * ShortcutCheatsheet — Modal overlay showing all keyboard shortcuts grouped by category.
 *
 * Opened via Cmd+/ (or Ctrl+/ on Windows/Linux).
 * Shows effective combos (after user overrides), disabled shortcuts are dimmed.
 * Supports filtering by label or combo.
 *
 * Uses Ant Design Modal for consistent UI.
 * No useEffect: visibility is controlled via props; filtering is derived state.
 */

import { useState, useMemo } from 'react';
import { Modal, Input, Typography, Tag, Empty } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { formatCombo } from '@/shared/lib/keyboard-shortcuts';
import {
  keyboardManager,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ResolvedShortcut,
} from '@/shared/lib/keyboard-manager';
import { useShortcutStore } from '@/shared/stores/shortcut-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ShortcutCheatsheetProps {
  open: boolean;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Platform detection helper
// ---------------------------------------------------------------------------

function getModLabel(): string {
  if (typeof navigator === 'undefined') return 'Ctrl';
  return navigator.platform.toUpperCase().includes('MAC') ? 'Cmd' : 'Ctrl';
}

// ---------------------------------------------------------------------------
// Combo kbd renderer
// ---------------------------------------------------------------------------

function ComboKbd({ shortcut }: { shortcut: ResolvedShortcut }) {
  const isDisabled = useShortcutStore((s) => s.overrides[shortcut.id] === null);

  return (
    <kbd
      className="inline-flex items-center gap-0.5 rounded px-2 py-0.5 text-xs font-mono select-none"
      style={{
        backgroundColor: isDisabled
          ? 'var(--ns-color-background-surface)'
          : shortcut.isOverridden
            ? 'var(--ns-color-primary-subtle, rgba(99, 102, 241, 0.1))'
            : 'var(--ns-color-background-surface)',
        color: isDisabled
          ? 'var(--ns-color-foreground-muted)'
          : shortcut.isOverridden
            ? 'var(--ns-color-primary)'
            : 'var(--ns-color-foreground-secondary)',
        border: `1px solid ${
          isDisabled
            ? 'var(--ns-color-border)'
            : shortcut.isOverridden
              ? 'var(--ns-color-primary)'
              : 'var(--ns-color-border)'
        }`,
        textDecoration: isDisabled ? 'line-through' : 'none',
        opacity: isDisabled ? 0.5 : 1,
      }}
    >
      {formatCombo(shortcut.effectiveCombo)}
    </kbd>
  );
}

// ---------------------------------------------------------------------------
// Scope badge
// ---------------------------------------------------------------------------

function ScopeBadge({ scope }: { scope: 'global' | 'editor' }) {
  if (scope === 'global') return null;

  return (
    <Tag
      style={{
        fontSize: 10,
        lineHeight: '16px',
        marginInlineEnd: 0,
        padding: '0 4px',
      }}
    >
      editor
    </Tag>
  );
}

// ---------------------------------------------------------------------------
// Category section
// ---------------------------------------------------------------------------

function CategorySection({
  category,
  shortcuts,
}: {
  category: string;
  shortcuts: ResolvedShortcut[];
}) {
  return (
    <Box as="section" className="mb-5 last:mb-0">
      <Typography.Text
        type="secondary"
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          display: 'block',
          marginBottom: 6,
        }}
      >
        {category}
      </Typography.Text>
      <Box
        className="rounded-lg border"
        style={{
          borderColor: 'var(--ns-color-border)',
          backgroundColor: 'var(--ns-color-background-surface)',
        }}
      >
        {shortcuts.map((shortcut, idx) => (
          <Box
            key={shortcut.id}
            className="flex items-center justify-between px-3 py-2"
            style={{
              borderBottom:
                idx < shortcuts.length - 1 ? '1px solid var(--ns-color-border)' : 'none',
            }}
          >
            <Box className="flex items-center gap-2 min-w-0">
              <Typography.Text
                style={{
                  fontSize: 13,
                  color: 'var(--ns-color-foreground)',
                }}
              >
                {shortcut.label}
              </Typography.Text>
              <ScopeBadge scope={shortcut.scope} />
            </Box>
            <ComboKbd shortcut={shortcut} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// ShortcutCheatsheet
// ---------------------------------------------------------------------------

export function ShortcutCheatsheet({ open, onClose }: ShortcutCheatsheetProps) {
  const [filter, setFilter] = useState('');
  const overrides = useShortcutStore((s) => s.overrides);

  // Resolve all shortcuts with effective combos
  const resolved = useMemo(() => {
    keyboardManager.setOverrides(overrides);
    return keyboardManager.getResolvedShortcuts();
  }, [overrides]);

  // Filter by search term
  const filtered = useMemo(() => {
    if (!filter.trim()) return resolved;
    const term = filter.toLowerCase();
    return resolved.filter(
      (s) =>
        s.label.toLowerCase().includes(term) ||
        s.id.toLowerCase().includes(term) ||
        formatCombo(s.effectiveCombo).toLowerCase().includes(term),
    );
  }, [resolved, filter]);

  // Group by category in defined order
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: CATEGORY_LABELS[cat],
    categoryKey: cat,
    shortcuts: filtered.filter((s) => s.category === cat),
  })).filter((g) => g.shortcuts.length > 0);

  const modLabel = getModLabel();

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title="Keyboard Shortcuts"
      footer={null}
      width={560}
      centered
      styles={{
        body: {
          maxHeight: '70vh',
          overflow: 'auto',
          paddingTop: 16,
        },
      }}
      destroyOnHidden
    >
      <Input
        placeholder="Filter shortcuts..."
        prefix={<SearchOutlined />}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        allowClear
        size="middle"
        aria-label="Filter keyboard shortcuts"
        style={{ marginBottom: 16 }}
        autoFocus
      />

      {grouped.length > 0 ? (
        grouped.map(({ category, categoryKey, shortcuts }) => (
          <CategorySection key={categoryKey} category={category} shortcuts={shortcuts} />
        ))
      ) : (
        <Empty
          description={filter.trim() ? `No shortcuts match "${filter}"` : 'No shortcuts registered'}
          style={{ padding: '32px 0' }}
        />
      )}

      <Box
        className="mt-4 pt-3 text-center"
        style={{ borderTop: '1px solid var(--ns-color-border)' }}
      >
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          Press {modLabel}+/ to toggle this panel. Customize shortcuts in Settings.
        </Typography.Text>
      </Box>
    </Modal>
  );
}
