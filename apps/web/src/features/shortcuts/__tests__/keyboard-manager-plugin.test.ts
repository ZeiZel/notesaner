/**
 * Tests for KeyboardManager plugin/dynamic shortcut registration.
 *
 * Covers:
 *   - registerKeybinding — registers dynamic shortcuts for plugins
 *   - unregisterKeybinding — removes dynamic shortcuts
 *   - getAllShortcuts — returns built-in + dynamic shortcuts
 *   - Conflict detection includes dynamic shortcuts
 *   - Console warnings on conflicts
 *   - Duplicate ID warning
 *   - getEffectiveCombo returns dynamic shortcut combos
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { keyboardManager } from '@/shared/lib/keyboard-manager';
import { KEYBOARD_SHORTCUTS } from '@/shared/lib/keyboard-shortcuts';

describe('KeyboardManager — dynamic shortcut registration', () => {
  beforeEach(() => {
    // Reset overrides
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // registerKeybinding
  // -----------------------------------------------------------------------

  it('registers a dynamic shortcut that appears in getAllShortcuts', () => {
    const callback = vi.fn();
    const unregister = keyboardManager.registerKeybinding(
      'test-plugin.action',
      { key: 'g', mod: true, shift: true },
      callback,
      { label: 'Test Plugin Action' },
    );

    const allShortcuts = keyboardManager.getAllShortcuts();
    const registered = allShortcuts.find((s) => s.id === 'test-plugin.action');

    expect(registered).toBeDefined();
    expect(registered?.label).toBe('Test Plugin Action');
    expect(registered?.category).toBe('plugin');
    expect(registered?.combo.key).toBe('g');
    expect(registered?.combo.mod).toBe(true);
    expect(registered?.combo.shift).toBe(true);

    // Cleanup
    unregister();
  });

  it('uses "plugin" category by default', () => {
    const unregister = keyboardManager.registerKeybinding(
      'my-plugin.cmd',
      { key: 'j', mod: true },
      vi.fn(),
    );

    const allShortcuts = keyboardManager.getAllShortcuts();
    const shortcut = allShortcuts.find((s) => s.id === 'my-plugin.cmd');
    expect(shortcut?.category).toBe('plugin');

    unregister();
  });

  it('allows custom category', () => {
    const unregister = keyboardManager.registerKeybinding(
      'my-plugin.nav',
      { key: 'j', alt: true },
      vi.fn(),
      { label: 'Jump to note', category: 'navigation' },
    );

    const allShortcuts = keyboardManager.getAllShortcuts();
    const shortcut = allShortcuts.find((s) => s.id === 'my-plugin.nav');
    expect(shortcut?.category).toBe('navigation');

    unregister();
  });

  it('unregister function removes the dynamic shortcut', () => {
    const unregister = keyboardManager.registerKeybinding(
      'remove-me',
      { key: 'x', mod: true },
      vi.fn(),
    );

    expect(keyboardManager.getAllShortcuts().find((s) => s.id === 'remove-me')).toBeDefined();

    unregister();

    expect(keyboardManager.getAllShortcuts().find((s) => s.id === 'remove-me')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // unregisterKeybinding
  // -----------------------------------------------------------------------

  it('unregisterKeybinding removes a dynamic shortcut by ID', () => {
    keyboardManager.registerKeybinding('to-remove', { key: 'y', mod: true }, vi.fn());

    expect(keyboardManager.getAllShortcuts().find((s) => s.id === 'to-remove')).toBeDefined();

    keyboardManager.unregisterKeybinding('to-remove');

    expect(keyboardManager.getAllShortcuts().find((s) => s.id === 'to-remove')).toBeUndefined();
  });

  // -----------------------------------------------------------------------
  // getEffectiveCombo for dynamic shortcuts
  // -----------------------------------------------------------------------

  it('getEffectiveCombo returns combo for dynamic shortcuts', () => {
    const unregister = keyboardManager.registerKeybinding(
      'dynamic-combo-test',
      { key: 'q', mod: true, shift: true },
      vi.fn(),
    );

    const combo = keyboardManager.getEffectiveCombo('dynamic-combo-test');
    expect(combo).toEqual({ key: 'q', mod: true, shift: true });

    unregister();
  });

  it('getEffectiveCombo respects overrides for dynamic shortcuts', () => {
    const unregister = keyboardManager.registerKeybinding(
      'override-test',
      { key: 'a', mod: true },
      vi.fn(),
    );

    keyboardManager.setOverrides({ 'override-test': { key: 'b', mod: true } });

    const combo = keyboardManager.getEffectiveCombo('override-test');
    expect(combo?.key).toBe('b');

    keyboardManager.setOverrides({});
    unregister();
  });

  it('getEffectiveCombo returns null for disabled dynamic shortcut', () => {
    const unregister = keyboardManager.registerKeybinding(
      'disabled-test',
      { key: 'a', mod: true },
      vi.fn(),
    );

    keyboardManager.setOverrides({ 'disabled-test': null });

    const combo = keyboardManager.getEffectiveCombo('disabled-test');
    expect(combo).toBeNull();

    keyboardManager.setOverrides({});
    unregister();
  });

  // -----------------------------------------------------------------------
  // Conflict detection with dynamic shortcuts
  // -----------------------------------------------------------------------

  it('detectConflicts includes dynamic shortcut conflicts', () => {
    // Register a dynamic shortcut with same combo as a built-in one
    const builtIn = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note');
    expect(builtIn).toBeDefined();

    const unregister = keyboardManager.registerKeybinding(
      'conflict-test',
      builtIn!.combo,
      vi.fn(),
      { label: 'Conflicting shortcut' },
    );

    const conflicts = keyboardManager.detectConflicts();
    const hasConflict = conflicts.some(
      (c) => c.actionIds.includes('new-note') && c.actionIds.includes('conflict-test'),
    );
    expect(hasConflict).toBe(true);

    unregister();
  });

  it('wouldConflict detects dynamic shortcut conflicts', () => {
    const unregister = keyboardManager.registerKeybinding(
      'would-conflict-test',
      { key: 'r', mod: true, shift: true, alt: true },
      vi.fn(),
    );

    const conflicts = keyboardManager.wouldConflict(
      { key: 'r', mod: true, shift: true, alt: true },
      'global',
      'some-other-id',
    );

    expect(conflicts).toContain('would-conflict-test');

    unregister();
  });

  // -----------------------------------------------------------------------
  // Console warnings
  // -----------------------------------------------------------------------

  it('warnConflicts logs to console when conflicts exist', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const builtIn = KEYBOARD_SHORTCUTS.find((s) => s.id === 'new-note');
    const unregister = keyboardManager.registerKeybinding('warn-test', builtIn!.combo, vi.fn());

    // warnConflicts is called by registerKeybinding, but let's call it explicitly
    keyboardManager.warnConflicts();

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('[ShortcutManager] Conflict'));

    consoleSpy.mockRestore();
    unregister();
  });

  it('warns on duplicate shortcut ID', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const unregister1 = keyboardManager.registerKeybinding(
      'dup-id',
      { key: 'a', alt: true },
      vi.fn(),
    );

    const unregister2 = keyboardManager.registerKeybinding(
      'dup-id',
      { key: 'b', alt: true },
      vi.fn(),
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Duplicate shortcut ID "dup-id"'),
    );

    consoleSpy.mockRestore();
    unregister1();
    unregister2();
  });

  // -----------------------------------------------------------------------
  // getAllShortcuts
  // -----------------------------------------------------------------------

  it('getAllShortcuts returns both built-in and dynamic shortcuts', () => {
    const builtInCount = KEYBOARD_SHORTCUTS.length;

    const unregister1 = keyboardManager.registerKeybinding(
      'dynamic-1',
      { key: 'a', alt: true },
      vi.fn(),
    );
    const unregister2 = keyboardManager.registerKeybinding(
      'dynamic-2',
      { key: 'b', alt: true },
      vi.fn(),
    );

    const all = keyboardManager.getAllShortcuts();
    expect(all.length).toBe(builtInCount + 2);

    unregister1();
    unregister2();
  });

  // -----------------------------------------------------------------------
  // getResolvedShortcuts includes dynamic
  // -----------------------------------------------------------------------

  it('getResolvedShortcuts includes dynamic shortcuts', () => {
    const unregister = keyboardManager.registerKeybinding(
      'resolved-dynamic',
      { key: 'r', alt: true },
      vi.fn(),
      { label: 'Resolved Dynamic' },
    );

    const resolved = keyboardManager.getResolvedShortcuts();
    const found = resolved.find((s) => s.id === 'resolved-dynamic');

    expect(found).toBeDefined();
    expect(found?.label).toBe('Resolved Dynamic');
    expect(found?.effectiveCombo.key).toBe('r');

    unregister();
  });
});
