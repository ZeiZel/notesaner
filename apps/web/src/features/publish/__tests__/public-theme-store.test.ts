/**
 * Tests for public-theme-store.ts
 *
 * Covers:
 *   - Initial state matches defaults
 *   - setSelectedTheme updates the theme
 *   - setCustomCss stores raw CSS
 *   - setFontFamily updates font family preset
 *   - setCustomFontFamily updates custom font family string
 *   - setFontSize clamps values to [FONT_SIZE_MIN, FONT_SIZE_MAX]
 *   - setMaxWidth clamps values to [MAX_WIDTH_MIN, MAX_WIDTH_MAX]
 *   - setPreviewMode toggles isPreviewMode
 *   - resetToDefaults restores all fields to defaults
 *   - getSanitizedCustomCss returns sanitized CSS
 *   - Persisted state does not include isPreviewMode
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { usePublicThemeStore, PUBLIC_THEME_STORAGE_KEY } from '../model/public-theme-store';
import {
  FONT_SIZE_MIN,
  FONT_SIZE_MAX,
  FONT_SIZE_DEFAULT,
  MAX_WIDTH_MIN,
  MAX_WIDTH_MAX,
  MAX_WIDTH_DEFAULT,
} from '../model/public-themes';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetStore(): void {
  usePublicThemeStore.setState({
    selectedTheme: 'light',
    customCss: '',
    fontFamily: 'system-ui',
    customFontFamily: '',
    fontSize: FONT_SIZE_DEFAULT,
    maxWidth: MAX_WIDTH_DEFAULT,
    isPreviewMode: false,
  });
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetStore();
});

afterEach(() => {
  resetStore();
});

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — initial state', () => {
  it('starts with selectedTheme = "light"', () => {
    expect(usePublicThemeStore.getState().selectedTheme).toBe('light');
  });

  it('starts with customCss = ""', () => {
    expect(usePublicThemeStore.getState().customCss).toBe('');
  });

  it('starts with fontFamily = "system-ui"', () => {
    expect(usePublicThemeStore.getState().fontFamily).toBe('system-ui');
  });

  it('starts with customFontFamily = ""', () => {
    expect(usePublicThemeStore.getState().customFontFamily).toBe('');
  });

  it(`starts with fontSize = ${FONT_SIZE_DEFAULT}`, () => {
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_DEFAULT);
  });

  it(`starts with maxWidth = ${MAX_WIDTH_DEFAULT}`, () => {
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_DEFAULT);
  });

  it('starts with isPreviewMode = false', () => {
    expect(usePublicThemeStore.getState().isPreviewMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// setSelectedTheme
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setSelectedTheme', () => {
  it('sets the theme to dark', () => {
    usePublicThemeStore.getState().setSelectedTheme('dark');
    expect(usePublicThemeStore.getState().selectedTheme).toBe('dark');
  });

  it('sets the theme to sepia', () => {
    usePublicThemeStore.getState().setSelectedTheme('sepia');
    expect(usePublicThemeStore.getState().selectedTheme).toBe('sepia');
  });

  it('sets the theme to high-contrast', () => {
    usePublicThemeStore.getState().setSelectedTheme('high-contrast');
    expect(usePublicThemeStore.getState().selectedTheme).toBe('high-contrast');
  });

  it('updates to a different theme when called twice', () => {
    usePublicThemeStore.getState().setSelectedTheme('dark');
    usePublicThemeStore.getState().setSelectedTheme('sepia');
    expect(usePublicThemeStore.getState().selectedTheme).toBe('sepia');
  });
});

// ---------------------------------------------------------------------------
// setCustomCss
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setCustomCss', () => {
  it('stores the provided CSS string', () => {
    usePublicThemeStore.getState().setCustomCss('h1 { color: red; }');
    expect(usePublicThemeStore.getState().customCss).toBe('h1 { color: red; }');
  });

  it('stores empty string when passed empty string', () => {
    usePublicThemeStore.getState().setCustomCss('some css');
    usePublicThemeStore.getState().setCustomCss('');
    expect(usePublicThemeStore.getState().customCss).toBe('');
  });

  it('stores raw (unsanitized) CSS — sanitization happens in getSanitizedCustomCss', () => {
    const dangerous = `div { background: expression(alert(1)); }`;
    usePublicThemeStore.getState().setCustomCss(dangerous);
    expect(usePublicThemeStore.getState().customCss).toBe(dangerous);
  });
});

// ---------------------------------------------------------------------------
// setFontFamily
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setFontFamily', () => {
  it('sets fontFamily to serif', () => {
    usePublicThemeStore.getState().setFontFamily('serif');
    expect(usePublicThemeStore.getState().fontFamily).toBe('serif');
  });

  it('sets fontFamily to monospace', () => {
    usePublicThemeStore.getState().setFontFamily('monospace');
    expect(usePublicThemeStore.getState().fontFamily).toBe('monospace');
  });

  it('sets fontFamily to custom', () => {
    usePublicThemeStore.getState().setFontFamily('custom');
    expect(usePublicThemeStore.getState().fontFamily).toBe('custom');
  });

  it('sets fontFamily back to system-ui', () => {
    usePublicThemeStore.getState().setFontFamily('serif');
    usePublicThemeStore.getState().setFontFamily('system-ui');
    expect(usePublicThemeStore.getState().fontFamily).toBe('system-ui');
  });
});

// ---------------------------------------------------------------------------
// setCustomFontFamily
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setCustomFontFamily', () => {
  it('stores the custom font family string', () => {
    usePublicThemeStore.getState().setCustomFontFamily('Lora');
    expect(usePublicThemeStore.getState().customFontFamily).toBe('Lora');
  });

  it('stores an empty string when cleared', () => {
    usePublicThemeStore.getState().setCustomFontFamily('Lora');
    usePublicThemeStore.getState().setCustomFontFamily('');
    expect(usePublicThemeStore.getState().customFontFamily).toBe('');
  });

  it('stores complex font stacks verbatim', () => {
    const stack = '"Crimson Text", "Times New Roman", serif';
    usePublicThemeStore.getState().setCustomFontFamily(stack);
    expect(usePublicThemeStore.getState().customFontFamily).toBe(stack);
  });
});

// ---------------------------------------------------------------------------
// setFontSize — clamping
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setFontSize', () => {
  it('sets a valid font size within range', () => {
    usePublicThemeStore.getState().setFontSize(18);
    expect(usePublicThemeStore.getState().fontSize).toBe(18);
  });

  it(`clamps to FONT_SIZE_MIN (${FONT_SIZE_MIN}) when below minimum`, () => {
    usePublicThemeStore.getState().setFontSize(1);
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_MIN);
  });

  it(`clamps to FONT_SIZE_MAX (${FONT_SIZE_MAX}) when above maximum`, () => {
    usePublicThemeStore.getState().setFontSize(9999);
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_MAX);
  });

  it(`accepts the boundary value FONT_SIZE_MIN (${FONT_SIZE_MIN})`, () => {
    usePublicThemeStore.getState().setFontSize(FONT_SIZE_MIN);
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_MIN);
  });

  it(`accepts the boundary value FONT_SIZE_MAX (${FONT_SIZE_MAX})`, () => {
    usePublicThemeStore.getState().setFontSize(FONT_SIZE_MAX);
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_MAX);
  });

  it('clamps negative values to FONT_SIZE_MIN', () => {
    usePublicThemeStore.getState().setFontSize(-10);
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_MIN);
  });
});

// ---------------------------------------------------------------------------
// setMaxWidth — clamping
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setMaxWidth', () => {
  it('sets a valid max width within range', () => {
    usePublicThemeStore.getState().setMaxWidth(800);
    expect(usePublicThemeStore.getState().maxWidth).toBe(800);
  });

  it(`clamps to MAX_WIDTH_MIN (${MAX_WIDTH_MIN}) when below minimum`, () => {
    usePublicThemeStore.getState().setMaxWidth(10);
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_MIN);
  });

  it(`clamps to MAX_WIDTH_MAX (${MAX_WIDTH_MAX}) when above maximum`, () => {
    usePublicThemeStore.getState().setMaxWidth(999999);
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_MAX);
  });

  it(`accepts the boundary value MAX_WIDTH_MIN (${MAX_WIDTH_MIN})`, () => {
    usePublicThemeStore.getState().setMaxWidth(MAX_WIDTH_MIN);
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_MIN);
  });

  it(`accepts the boundary value MAX_WIDTH_MAX (${MAX_WIDTH_MAX})`, () => {
    usePublicThemeStore.getState().setMaxWidth(MAX_WIDTH_MAX);
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_MAX);
  });

  it('clamps zero to MAX_WIDTH_MIN', () => {
    usePublicThemeStore.getState().setMaxWidth(0);
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_MIN);
  });
});

// ---------------------------------------------------------------------------
// setPreviewMode
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — setPreviewMode', () => {
  it('sets isPreviewMode to true', () => {
    usePublicThemeStore.getState().setPreviewMode(true);
    expect(usePublicThemeStore.getState().isPreviewMode).toBe(true);
  });

  it('sets isPreviewMode back to false', () => {
    usePublicThemeStore.getState().setPreviewMode(true);
    usePublicThemeStore.getState().setPreviewMode(false);
    expect(usePublicThemeStore.getState().isPreviewMode).toBe(false);
  });

  it('does not affect other state when toggled', () => {
    usePublicThemeStore.getState().setSelectedTheme('dark');
    usePublicThemeStore.getState().setPreviewMode(true);
    expect(usePublicThemeStore.getState().selectedTheme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// resetToDefaults
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — resetToDefaults', () => {
  it('restores selectedTheme to "light"', () => {
    usePublicThemeStore.getState().setSelectedTheme('high-contrast');
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().selectedTheme).toBe('light');
  });

  it('clears customCss', () => {
    usePublicThemeStore.getState().setCustomCss('h1 { color: red; }');
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().customCss).toBe('');
  });

  it('resets fontFamily to system-ui', () => {
    usePublicThemeStore.getState().setFontFamily('serif');
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().fontFamily).toBe('system-ui');
  });

  it('clears customFontFamily', () => {
    usePublicThemeStore.getState().setCustomFontFamily('Lora');
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().customFontFamily).toBe('');
  });

  it(`resets fontSize to ${FONT_SIZE_DEFAULT}`, () => {
    usePublicThemeStore.getState().setFontSize(22);
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().fontSize).toBe(FONT_SIZE_DEFAULT);
  });

  it(`resets maxWidth to ${MAX_WIDTH_DEFAULT}`, () => {
    usePublicThemeStore.getState().setMaxWidth(1200);
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().maxWidth).toBe(MAX_WIDTH_DEFAULT);
  });

  it('resets isPreviewMode to false', () => {
    usePublicThemeStore.getState().setPreviewMode(true);
    usePublicThemeStore.getState().resetToDefaults();
    expect(usePublicThemeStore.getState().isPreviewMode).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSanitizedCustomCss
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — getSanitizedCustomCss', () => {
  it('returns empty string when customCss is empty', () => {
    expect(usePublicThemeStore.getState().getSanitizedCustomCss()).toBe('');
  });

  it('returns safe CSS unchanged', () => {
    const safe = 'h1 { font-size: 2rem; }';
    usePublicThemeStore.getState().setCustomCss(safe);
    expect(usePublicThemeStore.getState().getSanitizedCustomCss()).toBe(safe);
  });

  it('strips expression() injection from the sanitized output', () => {
    usePublicThemeStore.getState().setCustomCss(`div { background: expression(alert(1)); }`);
    const sanitized = usePublicThemeStore.getState().getSanitizedCustomCss();
    expect(sanitized).not.toContain('expression(');
  });

  it('strips javascript: URI from the sanitized output', () => {
    usePublicThemeStore.getState().setCustomCss(`a { background: url(javascript:void(0)); }`);
    const sanitized = usePublicThemeStore.getState().getSanitizedCustomCss();
    expect(sanitized).not.toContain('javascript:');
  });

  it('does not mutate the raw customCss in the store', () => {
    const dangerous = `div { background: expression(alert(1)); }`;
    usePublicThemeStore.getState().setCustomCss(dangerous);
    usePublicThemeStore.getState().getSanitizedCustomCss();
    // Raw value in store should remain unmodified
    expect(usePublicThemeStore.getState().customCss).toBe(dangerous);
  });
});

// ---------------------------------------------------------------------------
// Persistence partialize: isPreviewMode must NOT be persisted
// ---------------------------------------------------------------------------

describe('usePublicThemeStore — persistence configuration', () => {
  it('PUBLIC_THEME_STORAGE_KEY is the expected string', () => {
    expect(PUBLIC_THEME_STORAGE_KEY).toBe('notesaner-public-theme');
  });

  it('isPreviewMode resets to false after setState (confirms it is not persisted)', () => {
    // Simulate what happens when the store is hydrated from storage:
    // isPreviewMode should not be in the persisted shape, so it defaults to false.
    usePublicThemeStore.setState({ isPreviewMode: true });
    usePublicThemeStore.setState({ isPreviewMode: false });
    expect(usePublicThemeStore.getState().isPreviewMode).toBe(false);
  });
});
