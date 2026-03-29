/**
 * Unit tests for the features/settings theme store module.
 *
 * Covers:
 *   - getSystemColorScheme() — system preference detection
 *   - resolveThemeMode() — ThemePreference -> 'dark' | 'light' resolution
 *   - useThemeStore — preference persistence and state transitions
 *   - Store migration from legacy string values
 *
 * Note: vitest environment is 'node' so no DOM/window available by default.
 * matchMedia is mocked where needed.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getSystemColorScheme, resolveThemeMode } from '../model/theme-store';
import { useThemeStore } from '@/shared/lib/theme/theme-store';

// ---------------------------------------------------------------------------
// getSystemColorScheme
// ---------------------------------------------------------------------------

describe('getSystemColorScheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "dark" when window is undefined (SSR)', () => {
    // In node environment window is not defined
    const result = getSystemColorScheme();
    // Node environment: window is undefined, so should return 'dark'
    expect(result).toBe('dark');
  });

  it('returns "dark" when matchMedia reports dark preference', () => {
    const original = global.window;
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      },
      writable: true,
      configurable: true,
    });

    expect(getSystemColorScheme()).toBe('dark');

    Object.defineProperty(global, 'window', {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  it('returns "light" when matchMedia reports light preference', () => {
    const original = global.window;
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      writable: true,
      configurable: true,
    });

    expect(getSystemColorScheme()).toBe('light');

    Object.defineProperty(global, 'window', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// resolveThemeMode
// ---------------------------------------------------------------------------

describe('resolveThemeMode', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves "light" to "light"', () => {
    expect(resolveThemeMode('light')).toBe('light');
  });

  it('resolves "dark" to "dark"', () => {
    expect(resolveThemeMode('dark')).toBe('dark');
  });

  it('resolves "system" by calling getSystemColorScheme (defaults to dark in node)', () => {
    const result = resolveThemeMode('system');
    // In node (no window), getSystemColorScheme returns 'dark'
    expect(result).toBe('dark');
  });

  it('resolves unknown string (custom theme id) to "dark"', () => {
    expect(resolveThemeMode('nord')).toBe('dark');
    expect(resolveThemeMode('dracula')).toBe('dark');
    expect(resolveThemeMode('my-custom-theme')).toBe('dark');
  });

  it('resolves "system" to "light" when system preference is light', () => {
    const original = global.window;
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
      },
      writable: true,
      configurable: true,
    });

    expect(resolveThemeMode('system')).toBe('light');

    Object.defineProperty(global, 'window', {
      value: original,
      writable: true,
      configurable: true,
    });
  });

  it('resolves "system" to "dark" when system preference is dark', () => {
    const original = global.window;
    Object.defineProperty(global, 'window', {
      value: {
        matchMedia: vi.fn().mockReturnValue({ matches: true }),
      },
      writable: true,
      configurable: true,
    });

    expect(resolveThemeMode('system')).toBe('dark');

    Object.defineProperty(global, 'window', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

// ---------------------------------------------------------------------------
// useThemeStore — preference state
// ---------------------------------------------------------------------------

describe('useThemeStore — setPreference', () => {
  beforeEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  afterEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  it('starts with the default preference', () => {
    const { preference } = useThemeStore.getState();
    expect(preference).toBe('dark');
  });

  it('updates preference to "light"', () => {
    useThemeStore.getState().setPreference('light');
    expect(useThemeStore.getState().preference).toBe('light');
  });

  it('updates preference to "system"', () => {
    useThemeStore.getState().setPreference('system');
    expect(useThemeStore.getState().preference).toBe('system');
  });

  it('updates preference to a custom theme id', () => {
    useThemeStore.getState().setPreference('nord');
    expect(useThemeStore.getState().preference).toBe('nord');
  });

  it('allows toggling between dark and light', () => {
    useThemeStore.getState().setPreference('light');
    expect(useThemeStore.getState().preference).toBe('light');
    useThemeStore.getState().setPreference('dark');
    expect(useThemeStore.getState().preference).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// useThemeStore — community themes
// ---------------------------------------------------------------------------

describe('useThemeStore — community themes', () => {
  const mockTheme = {
    id: 'test-theme',
    name: 'Test Theme',
    isDark: true,
    sourceUrl: 'https://example.com/test-theme.json',
    downloadedAt: '2026-01-01T00:00:00.000Z',
    colors: {} as never,
  };

  beforeEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  afterEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  it('adds a community theme', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    const { communityThemes } = useThemeStore.getState();
    expect(communityThemes).toHaveLength(1);
    expect(communityThemes[0]?.id).toBe('test-theme');
  });

  it('does not add duplicates — replaces on re-add', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    useThemeStore.getState().addCommunityTheme({ ...mockTheme, name: 'Updated Name' });
    const { communityThemes } = useThemeStore.getState();
    expect(communityThemes).toHaveLength(1);
    expect(communityThemes[0]?.name).toBe('Updated Name');
  });

  it('removes a community theme by id', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    useThemeStore.getState().removeCommunityTheme('test-theme');
    const { communityThemes } = useThemeStore.getState();
    expect(communityThemes).toHaveLength(0);
  });

  it('removing a non-existent theme is a no-op', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    useThemeStore.getState().removeCommunityTheme('non-existent');
    const { communityThemes } = useThemeStore.getState();
    expect(communityThemes).toHaveLength(1);
  });

  it('getAllThemes includes both built-in and community themes', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    const all = useThemeStore.getState().getAllThemes();
    const ids = all.map((t) => t.id);
    expect(ids).toContain('dark');
    expect(ids).toContain('light');
    expect(ids).toContain('test-theme');
  });

  it('getThemeById returns the correct theme for a community id', () => {
    useThemeStore.getState().addCommunityTheme(mockTheme);
    const found = useThemeStore.getState().getThemeById('test-theme');
    expect(found?.name).toBe('Test Theme');
  });

  it('getThemeById returns undefined for unknown ids', () => {
    const found = useThemeStore.getState().getThemeById('unknown-theme');
    expect(found).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// useThemeStore — custom CSS
// ---------------------------------------------------------------------------

describe('useThemeStore — custom CSS', () => {
  beforeEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  afterEach(() => {
    useThemeStore.setState({ preference: 'dark', communityThemes: [], customCss: '' });
  });

  it('starts with empty custom CSS', () => {
    expect(useThemeStore.getState().customCss).toBe('');
  });

  it('sets custom CSS', () => {
    const css = ':root { --ns-color-primary: hotpink; }';
    useThemeStore.getState().setCustomCss(css);
    expect(useThemeStore.getState().customCss).toBe(css);
  });

  it('clears custom CSS by setting empty string', () => {
    useThemeStore.getState().setCustomCss('.foo { color: red; }');
    useThemeStore.getState().setCustomCss('');
    expect(useThemeStore.getState().customCss).toBe('');
  });

  it('updates custom CSS when set multiple times', () => {
    useThemeStore.getState().setCustomCss('.a { color: red; }');
    useThemeStore.getState().setCustomCss('.b { color: blue; }');
    expect(useThemeStore.getState().customCss).toBe('.b { color: blue; }');
  });
});
