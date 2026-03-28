/**
 * Tests for platform detection utilities.
 *
 * Covers:
 *   - isMacPlatform — detects macOS via navigator.platform
 *   - getModifierLabel — returns 'Cmd' on Mac, 'Ctrl' elsewhere
 *   - getModifierSymbol — returns unicode symbol on Mac, 'Ctrl' elsewhere
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  isMacPlatform,
  getModifierLabel,
  getModifierSymbol,
  getShiftSymbol,
  getAltSymbol,
} from '../lib/platform';

describe('Platform utilities', () => {
  const originalPlatform = Object.getOwnPropertyDescriptor(navigator, 'platform');

  function mockPlatform(value: string) {
    Object.defineProperty(navigator, 'platform', {
      value,
      configurable: true,
    });
  }

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(navigator, 'platform', originalPlatform);
    }
  });

  // -----------------------------------------------------------------------
  // isMacPlatform
  // -----------------------------------------------------------------------

  it('returns true for macOS platform strings', () => {
    mockPlatform('MacIntel');
    expect(isMacPlatform()).toBe(true);
  });

  it('returns true for MacArm64', () => {
    mockPlatform('MacArm64');
    expect(isMacPlatform()).toBe(true);
  });

  it('returns false for Windows', () => {
    mockPlatform('Win32');
    expect(isMacPlatform()).toBe(false);
  });

  it('returns false for Linux', () => {
    mockPlatform('Linux x86_64');
    expect(isMacPlatform()).toBe(false);
  });

  // -----------------------------------------------------------------------
  // getModifierLabel
  // -----------------------------------------------------------------------

  it('returns "Cmd" on Mac', () => {
    mockPlatform('MacIntel');
    expect(getModifierLabel()).toBe('Cmd');
  });

  it('returns "Ctrl" on non-Mac', () => {
    mockPlatform('Win32');
    expect(getModifierLabel()).toBe('Ctrl');
  });

  // -----------------------------------------------------------------------
  // getModifierSymbol
  // -----------------------------------------------------------------------

  it('returns command symbol on Mac', () => {
    mockPlatform('MacIntel');
    expect(getModifierSymbol()).toBe('\u2318');
  });

  it('returns "Ctrl" on non-Mac', () => {
    mockPlatform('Win32');
    expect(getModifierSymbol()).toBe('Ctrl');
  });

  // -----------------------------------------------------------------------
  // getShiftSymbol
  // -----------------------------------------------------------------------

  it('returns shift arrow on Mac', () => {
    mockPlatform('MacIntel');
    expect(getShiftSymbol()).toBe('\u21E7');
  });

  it('returns "Shift" on non-Mac', () => {
    mockPlatform('Linux x86_64');
    expect(getShiftSymbol()).toBe('Shift');
  });

  // -----------------------------------------------------------------------
  // getAltSymbol
  // -----------------------------------------------------------------------

  it('returns option symbol on Mac', () => {
    mockPlatform('MacIntel');
    expect(getAltSymbol()).toBe('\u2325');
  });

  it('returns "Alt" on non-Mac', () => {
    mockPlatform('Linux x86_64');
    expect(getAltSymbol()).toBe('Alt');
  });
});
