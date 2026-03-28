/**
 * Unit tests for the presence color palette and assignment logic.
 *
 * Tests:
 *   - Palette integrity (8 distinct colors, valid formats)
 *   - Deterministic color assignment from user IDs
 *   - Edge cases (empty string, long strings, unicode)
 *   - Constants (MAX_VISIBLE_CURSORS, timeouts)
 */

import { describe, it, expect } from 'vitest';
import {
  PRESENCE_CURSOR_COLORS,
  MAX_VISIBLE_CURSORS,
  CURSOR_FADE_TIMEOUT_MS,
  CURSOR_UPDATE_THROTTLE_MS,
  assignPresenceCursorColor,
  type PresenceColor,
} from '@/shared/lib/presence-colors';

// ---------------------------------------------------------------------------
// Palette Integrity
// ---------------------------------------------------------------------------

describe('PRESENCE_CURSOR_COLORS palette', () => {
  it('contains exactly 8 colors', () => {
    expect(PRESENCE_CURSOR_COLORS).toHaveLength(8);
  });

  it('has unique primary colors', () => {
    const primaries = PRESENCE_CURSOR_COLORS.map((c) => c.primary);
    const unique = new Set(primaries);
    expect(unique.size).toBe(8);
  });

  it('has unique color names', () => {
    const names = PRESENCE_CURSOR_COLORS.map((c) => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(8);
  });

  it('each color has valid hex primary', () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    for (const color of PRESENCE_CURSOR_COLORS) {
      expect(color.primary).toMatch(hexRegex);
    }
  });

  it('each color has valid rgba selection', () => {
    const rgbaRegex = /^rgba\(\d{1,3},\s*\d{1,3},\s*\d{1,3},\s*[\d.]+\)$/;
    for (const color of PRESENCE_CURSOR_COLORS) {
      expect(color.selection).toMatch(rgbaRegex);
    }
  });

  it('each color has a labelText for contrast', () => {
    for (const color of PRESENCE_CURSOR_COLORS) {
      expect(color.labelText).toBeTruthy();
      expect(color.labelText.startsWith('#')).toBe(true);
    }
  });

  it('each color has a non-empty name', () => {
    for (const color of PRESENCE_CURSOR_COLORS) {
      expect(color.name.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Color Assignment
// ---------------------------------------------------------------------------

describe('assignPresenceCursorColor()', () => {
  it('returns a PresenceColor from the palette', () => {
    const color = assignPresenceCursorColor('user-123');
    expect(PRESENCE_CURSOR_COLORS).toContainEqual(color);
  });

  it('is deterministic (same userId -> same color)', () => {
    const a = assignPresenceCursorColor('alice');
    const b = assignPresenceCursorColor('alice');
    expect(a).toStrictEqual(b);
  });

  it('distributes across the palette for different user IDs', () => {
    const userIds = [
      'alice',
      'bob',
      'charlie',
      'diana',
      'edgar',
      'fiona',
      'george',
      'hannah',
      'ivan',
      'julia',
    ];
    const colors = new Set(userIds.map((id) => assignPresenceCursorColor(id).primary));
    // With 10 IDs and 8 colors, hash collisions are possible but we should
    // see at least 2 distinct colors across these diverse inputs.
    expect(colors.size).toBeGreaterThanOrEqual(2);
  });

  it('handles empty string without throwing', () => {
    const color = assignPresenceCursorColor('');
    expect(PRESENCE_CURSOR_COLORS).toContainEqual(color);
  });

  it('handles very long user IDs', () => {
    const longId = 'u'.repeat(10000);
    const color = assignPresenceCursorColor(longId);
    expect(PRESENCE_CURSOR_COLORS).toContainEqual(color);
  });

  it('handles unicode user IDs', () => {
    const color = assignPresenceCursorColor('\u0410\u043B\u0438\u0441\u0430');
    expect(PRESENCE_CURSOR_COLORS).toContainEqual(color);
  });

  it('returns a complete PresenceColor object', () => {
    const color: PresenceColor = assignPresenceCursorColor('test-user');
    expect(color).toHaveProperty('name');
    expect(color).toHaveProperty('primary');
    expect(color).toHaveProperty('selection');
    expect(color).toHaveProperty('labelText');
  });
});

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('Presence constants', () => {
  it('MAX_VISIBLE_CURSORS is 10', () => {
    expect(MAX_VISIBLE_CURSORS).toBe(10);
  });

  it('CURSOR_FADE_TIMEOUT_MS is 10 seconds', () => {
    expect(CURSOR_FADE_TIMEOUT_MS).toBe(10_000);
  });

  it('CURSOR_UPDATE_THROTTLE_MS is 50ms (20 updates/sec)', () => {
    expect(CURSOR_UPDATE_THROTTLE_MS).toBe(50);
  });
});
