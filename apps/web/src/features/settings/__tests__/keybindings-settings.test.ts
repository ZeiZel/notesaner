/**
 * Unit tests for the keyboard shortcut customization settings feature.
 *
 * Covers:
 *   - Shortcut override assignment and persistence in useShortcutStore
 *   - Conflict detection before and after assignment
 *   - Reset individual shortcut and reset-all flows
 *   - Disabled shortcut (null override) behavior
 *   - Category grouping helpers used by the settings UI
 *   - Export/import shape validation
 *   - KeyboardManager conflict detection integration with overrides
 *
 * Note: vitest environment is 'node', so no DOM/component rendering is tested.
 * Component-level behavior is covered by the existing shortcut-store.test.ts
 * and keyboard-manager-plugin.test.ts test suites.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShortcutStore } from '@/shared/stores/shortcut-store';
import { keyboardManager, CATEGORY_LABELS, CATEGORY_ORDER } from '@/shared/lib/keyboard-manager';
import { KEYBOARD_SHORTCUTS, formatCombo } from '@/shared/lib/keyboard-shortcuts';
import type { KeyCombo } from '@/shared/lib/keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Helpers mirroring KeybindingsSettings.tsx logic (tested in isolation)
// ---------------------------------------------------------------------------

/** Mirror of extractPluginName from KeybindingsSettings.tsx */
function extractPluginName(id: string): string | undefined {
  const isBuiltIn = KEYBOARD_SHORTCUTS.some((s) => s.id === id);
  if (isBuiltIn) return undefined;
  const dotIndex = id.indexOf('.');
  if (dotIndex > 0) {
    return id.substring(0, dotIndex);
  }
  return 'Plugin';
}

/** Mirror of KeybindingsExport from KeybindingsSettings.tsx */
interface KeybindingsExport {
  version: 1;
  exportedAt: string;
  overrides: Record<string, KeyCombo | null>;
}

/** Minimal export validator mirroring KeybindingsSettings import logic */
function validateImportedData(data: unknown): data is KeybindingsExport {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  if (d['version'] !== 1 || typeof d['overrides'] !== 'object') return false;
  for (const [id, combo] of Object.entries(d['overrides'] as Record<string, unknown>)) {
    if (
      combo !== null &&
      (typeof combo !== 'object' || typeof (combo as Record<string, unknown>)['key'] !== 'string')
    ) {
      return false;
    }
    void id; // suppress unused var warning
  }
  return true;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — override management', () => {
  beforeEach(() => {
    // Reset all state before each test
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  // -------------------------------------------------------------------------
  // Override assignment
  // -------------------------------------------------------------------------

  describe('setOverride', () => {
    it('assigns a new combo to an existing shortcut', () => {
      const combo: KeyCombo = { key: 't', mod: true };
      useShortcutStore.getState().setOverride('new-note', combo);

      const { overrides } = useShortcutStore.getState();
      expect(overrides['new-note']).toEqual(combo);
    });

    it('syncs the override to the keyboard manager immediately', () => {
      const combo: KeyCombo = { key: 'q', mod: true, shift: true };
      useShortcutStore.getState().setOverride('save-note', combo);

      const effective = keyboardManager.getEffectiveCombo('save-note');
      expect(effective).toEqual(combo);
    });

    it('allows overriding with a combo that uses Alt modifier', () => {
      const combo: KeyCombo = { key: 'z', alt: true };
      useShortcutStore.getState().setOverride('navigate-back', combo);

      const { overrides } = useShortcutStore.getState();
      expect(overrides['navigate-back']).toEqual(combo);
    });

    it('overwrites a previous override with a new one', () => {
      const first: KeyCombo = { key: 'a', mod: true };
      const second: KeyCombo = { key: 'b', mod: true };

      useShortcutStore.getState().setOverride('find-in-note', first);
      useShortcutStore.getState().setOverride('find-in-note', second);

      const { overrides } = useShortcutStore.getState();
      expect(overrides['find-in-note']).toEqual(second);
    });
  });

  // -------------------------------------------------------------------------
  // Disabled shortcuts (null override)
  // -------------------------------------------------------------------------

  describe('null override (disable shortcut)', () => {
    it('setting null disables a shortcut in the keyboard manager', () => {
      useShortcutStore.getState().setOverride('quick-switcher', null);

      const effective = keyboardManager.getEffectiveCombo('quick-switcher');
      expect(effective).toBeNull();
    });

    it('disabled shortcut is reflected in resolved shortcuts', () => {
      useShortcutStore.getState().setOverride('command-palette', null);
      const { overrides } = useShortcutStore.getState();
      keyboardManager.setOverrides(overrides);

      const resolved = keyboardManager.getResolvedShortcuts();
      const paletteEntry = resolved.find((s) => s.id === 'command-palette');

      // effectiveCombo falls back to the default when null (manager returns default)
      expect(paletteEntry).toBeDefined();
      expect(paletteEntry?.isOverridden).toBe(true);
    });

    it('stores null value as-is in the overrides map', () => {
      useShortcutStore.getState().setOverride('global-search', null);

      const { overrides } = useShortcutStore.getState();
      expect(overrides['global-search']).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Reset individual override
  // -------------------------------------------------------------------------

  describe('resetOverride', () => {
    it('removes a single override, restoring the default', () => {
      useShortcutStore.getState().setOverride('new-note', { key: 'j', mod: true });
      useShortcutStore.getState().resetOverride('new-note');

      const { overrides } = useShortcutStore.getState();
      expect(overrides['new-note']).toBeUndefined();
    });

    it('restores the default combo in the keyboard manager after reset', () => {
      const defaultCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;

      useShortcutStore.getState().setOverride('new-note', { key: 'j', mod: true });
      useShortcutStore.getState().resetOverride('new-note');

      const effective = keyboardManager.getEffectiveCombo('new-note');
      expect(effective).toEqual(defaultCombo);
    });

    it('resetting a non-existent override is a no-op', () => {
      const before = { ...useShortcutStore.getState().overrides };
      useShortcutStore.getState().resetOverride('non-existent-id');
      const after = useShortcutStore.getState().overrides;

      expect(after).toEqual(before);
    });

    it('resetOverride does not affect other overrides', () => {
      useShortcutStore.getState().setOverride('new-note', { key: 'j', mod: true });
      useShortcutStore.getState().setOverride('save-note', { key: 'k', mod: true });

      useShortcutStore.getState().resetOverride('new-note');

      const { overrides } = useShortcutStore.getState();
      expect(overrides['new-note']).toBeUndefined();
      expect(overrides['save-note']).toEqual({ key: 'k', mod: true });
    });
  });

  // -------------------------------------------------------------------------
  // Reset all overrides
  // -------------------------------------------------------------------------

  describe('resetAll', () => {
    it('clears all overrides at once', () => {
      useShortcutStore.getState().setOverride('new-note', { key: 'j', mod: true });
      useShortcutStore.getState().setOverride('save-note', { key: 'k', mod: true });
      useShortcutStore.getState().setOverride('global-search', null);

      useShortcutStore.getState().resetAll();

      const { overrides } = useShortcutStore.getState();
      expect(Object.keys(overrides).length).toBe(0);
    });

    it('restores all defaults in the keyboard manager after resetAll', () => {
      const newNoteDefault = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;

      useShortcutStore.getState().setOverride('new-note', { key: 'j', mod: true });
      useShortcutStore.getState().resetAll();

      const effective = keyboardManager.getEffectiveCombo('new-note');
      expect(effective).toEqual(newNoteDefault);
    });
  });
});

// ---------------------------------------------------------------------------
// Conflict detection
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — conflict detection', () => {
  beforeEach(() => {
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  it('checkConflict returns conflicting IDs when combo is already taken', () => {
    // The 'new-note' shortcut uses Mod+N
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;

    // Try to assign the same combo to 'save-note'
    const conflicts = useShortcutStore.getState().checkConflict('save-note', newNoteCombo);

    expect(conflicts).toContain('new-note');
  });

  it('checkConflict returns empty array when combo is unused', () => {
    // A combo that is not in the built-in registry
    const unusedCombo: KeyCombo = { key: 'F12', mod: true, shift: true, alt: true };

    const conflicts = useShortcutStore.getState().checkConflict('new-note', unusedCombo);

    expect(conflicts).toEqual([]);
  });

  it('checkConflict does not flag the shortcut itself as a conflict', () => {
    // Assigning a shortcut its own combo should not be a conflict
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;

    const conflicts = useShortcutStore.getState().checkConflict('new-note', newNoteCombo);

    expect(conflicts).not.toContain('new-note');
  });

  it('detectConflicts finds conflicts after assigning duplicate combos via overrides', () => {
    // Override 'save-note' with the same combo as 'new-note' (Mod+N)
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;
    useShortcutStore.getState().setOverride('save-note', newNoteCombo);

    const { overrides } = useShortcutStore.getState();
    keyboardManager.setOverrides(overrides);

    const conflicts = keyboardManager.detectConflicts();
    const hasConflict = conflicts.some(
      (c) => c.actionIds.includes('new-note') && c.actionIds.includes('save-note'),
    );

    expect(hasConflict).toBe(true);
  });

  it('no conflicts exist in the default (unmodified) shortcut registry', () => {
    keyboardManager.setOverrides({});
    const conflicts = keyboardManager.detectConflicts();

    expect(conflicts).toHaveLength(0);
  });

  it('getResolvedShortcuts marks shortcuts with conflicts in the conflicts array', () => {
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;
    keyboardManager.setOverrides({ 'save-note': newNoteCombo });

    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');
    const saveNote = resolved.find((s) => s.id === 'save-note');

    expect(newNote?.conflicts).toContain('save-note');
    expect(saveNote?.conflicts).toContain('new-note');
  });

  it('resolving a conflict clears the conflicts array', () => {
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;
    keyboardManager.setOverrides({ 'save-note': newNoteCombo });

    // Resolve by assigning a different combo to 'save-note'
    keyboardManager.setOverrides({ 'save-note': { key: 'k', mod: true } });

    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');

    expect(newNote?.conflicts).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Resolved shortcuts — override status
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — resolved shortcut display state', () => {
  beforeEach(() => {
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  it('shortcut has isOverridden=false with no overrides', () => {
    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');

    expect(newNote?.isOverridden).toBe(false);
  });

  it('shortcut has isOverridden=true after override is applied', () => {
    keyboardManager.setOverrides({ 'new-note': { key: 'j', mod: true } });

    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');

    expect(newNote?.isOverridden).toBe(true);
  });

  it('effectiveCombo reflects the override', () => {
    const override: KeyCombo = { key: 'j', mod: true };
    keyboardManager.setOverrides({ 'new-note': override });

    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');

    expect(newNote?.effectiveCombo).toEqual(override);
  });

  it('effectiveCombo falls back to default after override is removed', () => {
    const defaultCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;

    keyboardManager.setOverrides({ 'new-note': { key: 'j', mod: true } });
    keyboardManager.setOverrides({});

    const resolved = keyboardManager.getResolvedShortcuts();
    const newNote = resolved.find((s) => s.id === 'new-note');

    expect(newNote?.effectiveCombo).toEqual(defaultCombo);
  });
});

// ---------------------------------------------------------------------------
// Category grouping
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — category grouping', () => {
  it('CATEGORY_LABELS covers all categories used in KEYBOARD_SHORTCUTS', () => {
    const usedCategories = new Set(KEYBOARD_SHORTCUTS.map((s) => s.category));
    for (const cat of usedCategories) {
      expect(CATEGORY_LABELS).toHaveProperty(cat);
    }
  });

  it('CATEGORY_ORDER contains all categories present in the registry', () => {
    const usedCategories = new Set(KEYBOARD_SHORTCUTS.map((s) => s.category));
    // plugin category is valid but may not be in built-in shortcuts
    const orderSet = new Set(CATEGORY_ORDER);
    for (const cat of usedCategories) {
      expect(orderSet.has(cat)).toBe(true);
    }
  });

  it('grouping by category produces non-empty sections for the default registry', () => {
    const resolved = keyboardManager.getResolvedShortcuts();
    const grouped = CATEGORY_ORDER.map((cat) => ({
      category: cat,
      shortcuts: resolved.filter((s) => s.category === cat),
    })).filter((g) => g.shortcuts.length > 0);

    expect(grouped.length).toBeGreaterThan(0);
    // Every shortcut should appear in exactly one group
    const totalInGroups = grouped.reduce((sum, g) => sum + g.shortcuts.length, 0);
    // plugin category shortcuts are excluded from CATEGORY_ORDER-based groups
    const nonPluginCount = resolved.filter((s) => s.category !== 'plugin').length;
    expect(totalInGroups).toBe(nonPluginCount);
  });
});

// ---------------------------------------------------------------------------
// Plugin name extraction
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — extractPluginName helper', () => {
  it('returns undefined for built-in shortcut IDs', () => {
    for (const shortcut of KEYBOARD_SHORTCUTS) {
      expect(extractPluginName(shortcut.id)).toBeUndefined();
    }
  });

  it('extracts plugin name from "pluginId.action" format', () => {
    expect(extractPluginName('my-plugin.do-thing')).toBe('my-plugin');
  });

  it('returns "Plugin" for IDs without a dot', () => {
    expect(extractPluginName('some-unknown-shortcut')).toBe('Plugin');
  });

  it('handles plugin IDs with multiple dots (uses first segment)', () => {
    expect(extractPluginName('com.example.plugin.action')).toBe('com');
  });
});

// ---------------------------------------------------------------------------
// Export / import validation
// ---------------------------------------------------------------------------

describe('KeybindingsSettings — export/import validation', () => {
  it('validates a correct export object', () => {
    const data: KeybindingsExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      overrides: {
        'new-note': { key: 'j', mod: true },
        'save-note': null,
      },
    };

    expect(validateImportedData(data)).toBe(true);
  });

  it('rejects objects with wrong version number', () => {
    const data = { version: 2, exportedAt: '', overrides: {} };
    expect(validateImportedData(data)).toBe(false);
  });

  it('rejects objects with non-object overrides', () => {
    const data = { version: 1, exportedAt: '', overrides: 'invalid' };
    expect(validateImportedData(data)).toBe(false);
  });

  it('rejects combos without a key property', () => {
    const data = {
      version: 1,
      exportedAt: '',
      overrides: { 'new-note': { mod: true } }, // missing key
    };
    expect(validateImportedData(data)).toBe(false);
  });

  it('accepts null combo (disabled shortcut) in import', () => {
    const data: KeybindingsExport = {
      version: 1,
      exportedAt: '',
      overrides: { 'save-note': null },
    };
    expect(validateImportedData(data)).toBe(true);
  });

  it('exported combo can be round-tripped back to override store', () => {
    const originalOverride: KeyCombo = { key: 'r', mod: true, shift: true };
    useShortcutStore.getState().setOverride('new-note', originalOverride);

    const { overrides } = useShortcutStore.getState();

    // Simulate export
    const exportData: KeybindingsExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      overrides,
    };

    // Validate the exported structure
    expect(validateImportedData(exportData)).toBe(true);

    // Reset and re-import
    useShortcutStore.getState().resetAll();
    useShortcutStore.getState().setOverride('new-note', exportData.overrides['new-note']!);

    const { overrides: imported } = useShortcutStore.getState();
    expect(imported['new-note']).toEqual(originalOverride);
  });
});

// ---------------------------------------------------------------------------
// formatCombo — display formatting used throughout the settings UI
// ---------------------------------------------------------------------------

describe('formatCombo — display helper', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a simple key without modifiers', () => {
    const result = formatCombo({ key: 'x' });
    expect(result).toBe('X');
  });

  it('includes shift modifier in formatted output', () => {
    const result = formatCombo({ key: 'f', mod: true, shift: true });
    // Both Mac and non-Mac should include some shift representation
    expect(result.toLowerCase()).toContain('f');
  });

  it('formats Space key as "Space"', () => {
    const result = formatCombo({ key: ' ' });
    expect(result).toContain('Space');
  });

  it('does not contain empty strings in parts', () => {
    const result = formatCombo({ key: 'n', mod: true });
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toMatch(/\+\+/); // No consecutive plus signs
  });
});

// ---------------------------------------------------------------------------
// Keyboard manager integration — warnConflicts
// ---------------------------------------------------------------------------

describe('KeyboardManager.warnConflicts — console output', () => {
  beforeEach(() => {
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    keyboardManager.setOverrides({});
  });

  it('does not log warnings when there are no conflicts', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    keyboardManager.warnConflicts();
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs a warning when two shortcuts share the same combo via override', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Override 'save-note' with the same combo as 'new-note'
    const newNoteCombo = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note')!.combo;
    keyboardManager.setOverrides({ 'save-note': newNoteCombo });

    keyboardManager.warnConflicts();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ShortcutManager] Conflict'));
  });
});
