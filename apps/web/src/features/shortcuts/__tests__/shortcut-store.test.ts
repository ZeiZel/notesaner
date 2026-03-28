/**
 * Tests for shortcut-store.ts — Zustand store for user keybinding overrides.
 *
 * Covers:
 *   - setOverride — persists an override and syncs to keyboard manager
 *   - resetOverride — removes a single override
 *   - resetAll — clears all overrides
 *   - checkConflict — detects conflicts before assignment
 *   - Disable shortcut (null override)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useShortcutStore } from '@/shared/stores/shortcut-store';
import { keyboardManager } from '@/shared/lib/keyboard-manager';
import type { KeyCombo } from '@/shared/lib/keyboard-shortcuts';

describe('ShortcutStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the store between tests
    useShortcutStore.setState({ overrides: {} });
    keyboardManager.setOverrides({});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -----------------------------------------------------------------------
  // setOverride
  // -----------------------------------------------------------------------

  it('sets an override and syncs to keyboard manager', () => {
    const combo: KeyCombo = { key: 'r', mod: true };
    useShortcutStore.getState().setOverride('new-note', combo);

    const state = useShortcutStore.getState();
    expect(state.overrides['new-note']).toEqual(combo);

    // Verify the keyboard manager has the override
    const effectiveCombo = keyboardManager.getEffectiveCombo('new-note');
    expect(effectiveCombo?.key).toBe('r');
  });

  it('disables a shortcut by setting null override', () => {
    useShortcutStore.getState().setOverride('save-note', null);

    const state = useShortcutStore.getState();
    expect(state.overrides['save-note']).toBeNull();

    // Keyboard manager should return null for disabled shortcut
    const effectiveCombo = keyboardManager.getEffectiveCombo('save-note');
    expect(effectiveCombo).toBeNull();
  });

  // -----------------------------------------------------------------------
  // resetOverride
  // -----------------------------------------------------------------------

  it('resets a single override back to default', () => {
    const combo: KeyCombo = { key: 'r', mod: true };
    useShortcutStore.getState().setOverride('new-note', combo);

    expect(useShortcutStore.getState().overrides['new-note']).toBeDefined();

    useShortcutStore.getState().resetOverride('new-note');

    expect(useShortcutStore.getState().overrides['new-note']).toBeUndefined();

    // Keyboard manager should return the default combo
    const effectiveCombo = keyboardManager.getEffectiveCombo('new-note');
    expect(effectiveCombo?.key).toBe('n');
  });

  // -----------------------------------------------------------------------
  // resetAll
  // -----------------------------------------------------------------------

  it('resets all overrides', () => {
    useShortcutStore.getState().setOverride('new-note', { key: 'r', mod: true });
    useShortcutStore.getState().setOverride('save-note', null);

    expect(Object.keys(useShortcutStore.getState().overrides).length).toBe(2);

    useShortcutStore.getState().resetAll();

    expect(Object.keys(useShortcutStore.getState().overrides).length).toBe(0);
  });

  // -----------------------------------------------------------------------
  // checkConflict
  // -----------------------------------------------------------------------

  it('detects conflict when assigning combo already used by another shortcut', () => {
    // 'n' + mod is already used by 'new-note'
    const conflicts = useShortcutStore
      .getState()
      .checkConflict('save-note', { key: 'n', mod: true });

    expect(conflicts).toContain('new-note');
  });

  it('returns empty array when no conflict', () => {
    const conflicts = useShortcutStore
      .getState()
      .checkConflict('save-note', { key: 'r', mod: true, shift: true, alt: true });

    expect(conflicts).toEqual([]);
  });
});
