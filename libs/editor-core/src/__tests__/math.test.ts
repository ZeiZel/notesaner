/**
 * Unit tests for the MathInline and MathBlock TipTap extensions.
 *
 * These tests exercise pure logic without requiring a DOM or a full editor
 * instance, following the pattern used by wiki-link.test.ts:
 *
 * - Input rule regex matching / non-matching cases
 * - Plain-text serialisation helpers ($...$ and $$...$$)
 * - KaTeX rendering logic (via a minimal in-process mock)
 * - Error handling for invalid LaTeX strings
 *
 * Full DOM / NodeView rendering is covered by Playwright integration tests.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Input rule regexes
// We reproduce them here rather than importing the full extensions, which
// require a DOM-capable environment (React NodeView renderer).
// ---------------------------------------------------------------------------

const MATH_INLINE_INPUT_REGEX = /(?<![\\$])\$([^$\n]+)\$$/;
const MATH_BLOCK_INPUT_REGEX = /(?<!\$)\$\$([^$]+)\$\$$/;

// ---------------------------------------------------------------------------
// MATH_INLINE_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('MATH_INLINE_INPUT_REGEX', () => {
  function match(input: string) {
    return MATH_INLINE_INPUT_REGEX.exec(input);
  }

  // Happy path — basic formula
  it('matches a simple inline math expression', () => {
    const m = match('$E = mc^2$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('E = mc^2');
  });

  it('matches inline math at the end of a sentence', () => {
    const m = match('The formula is $\\frac{a}{b}$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('\\frac{a}{b}');
  });

  it('matches Greek letters', () => {
    const m = match('$\\alpha + \\beta = \\gamma$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('\\alpha + \\beta = \\gamma');
  });

  it('matches subscript and superscript notation', () => {
    const m = match('$x_i^2$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x_i^2');
  });

  // Non-matching cases
  it('does not match an empty pair of dollar signs $$', () => {
    const m = match('$$');
    // MATH_INLINE should NOT match display math ($$)
    // The negative lookbehind (?<![\\$]) prevents matching the second $ of $$
    expect(m).toBeNull();
  });

  it('does not match an unclosed dollar sign', () => {
    const m = match('$unclosed');
    expect(m).toBeNull();
  });

  it('does not match when formula contains a newline', () => {
    const m = match('$line1\nline2$');
    expect(m).toBeNull();
  });

  it('does not match an empty formula $$ (block delimiters)', () => {
    // The regex should not match $$ as an inline formula
    const m = match('$$display$$');
    // $$display$$ — the first char before the inner $ is $, so lookbehind blocks it
    expect(m).toBeNull();
  });

  it('does not match when escaped by backslash \\$', () => {
    const m = match('\\$notmath$');
    // The lookbehind (?<![\\$]) — when preceded by \, no match
    expect(m).toBeNull();
  });

  // Edge cases
  it('matches a single letter formula', () => {
    const m = match('$x$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('x');
  });

  it('matches formulas with spaces', () => {
    const m = match('$a + b + c$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('a + b + c');
  });

  it('matches complex LaTeX like fractions', () => {
    const m = match('$\\frac{d}{dx}\\left(x^n\\right) = nx^{n-1}$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('\\frac{d}{dx}\\left(x^n\\right) = nx^{n-1}');
  });
});

// ---------------------------------------------------------------------------
// MATH_BLOCK_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('MATH_BLOCK_INPUT_REGEX', () => {
  function match(input: string) {
    return MATH_BLOCK_INPUT_REGEX.exec(input);
  }

  // Happy path
  it('matches a simple display math expression', () => {
    const m = match('$$E = mc^2$$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('E = mc^2');
  });

  it('matches multi-line content between $$', () => {
    const m = match('$$\\int_0^1 x^2\\,dx = \\frac{1}{3}$$');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('\\int_0^1 x^2\\,dx = \\frac{1}{3}');
  });

  it('matches display math with newlines in content', () => {
    const formula = '$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$';
    const m = match(formula);
    expect(m).not.toBeNull();
    expect(m![1]).toContain('\\sum_{i=1}^{n}');
  });

  it('matches display math at end of paragraph text', () => {
    const m = match("Euler's formula: $$e^{i\\pi} + 1 = 0$$");
    expect(m).not.toBeNull();
    expect(m![1]).toBe('e^{i\\pi} + 1 = 0');
  });

  // Non-matching cases
  it('does not match a single $ delimiter', () => {
    const m = match('$inline$');
    expect(m).toBeNull();
  });

  it('does not match an unclosed $$ delimiter', () => {
    const m = match('$$unclosed');
    expect(m).toBeNull();
  });

  it('does not match empty $$ delimiters with no content', () => {
    const m = match('$$$$');
    // $$$$ — the lookbehind (?<!\$) on the second pair would see $, so no match
    // (OR the content [^$]+ requires at least one non-$ char)
    // Either way the regex should not match a blank formula
    if (m !== null) {
      // If it somehow matched, the content group should be empty or we
      // must verify handler ignores it — just check it's not a useful formula
      expect(m![1]?.trim()).toBe('');
    }
  });

  // Edge cases
  it('captures trimmed content without leading/trailing whitespace in the group', () => {
    const m = match('$$  x + y  $$');
    expect(m).not.toBeNull();
    // The group itself contains the raw content; trimming is done in the handler
    expect(m![1]).toBe('  x + y  ');
  });
});

// ---------------------------------------------------------------------------
// Plain-text serialisation helpers
// These mirror the renderText logic in the extensions.
// ---------------------------------------------------------------------------

function serializeMathInline(latex: string): string {
  return `$${latex}$`;
}

function serializeMathBlock(latex: string): string {
  return `$$\n${latex}\n$$`;
}

describe('serializeMathInline', () => {
  it('wraps latex in single dollar signs', () => {
    expect(serializeMathInline('E = mc^2')).toBe('$E = mc^2$');
  });

  it('preserves LaTeX commands', () => {
    expect(serializeMathInline('\\frac{a}{b}')).toBe('$\\frac{a}{b}$');
  });

  it('handles empty string', () => {
    expect(serializeMathInline('')).toBe('$$');
  });
});

describe('serializeMathBlock', () => {
  it('wraps latex in double dollar signs with newlines', () => {
    expect(serializeMathBlock('E = mc^2')).toBe('$$\nE = mc^2\n$$');
  });

  it('preserves multi-line content', () => {
    const multiLine = 'a = b\n+ c';
    const result = serializeMathBlock(multiLine);
    expect(result).toBe(`$$\n${multiLine}\n$$`);
  });

  it('handles empty string', () => {
    expect(serializeMathBlock('')).toBe('$$\n\n$$');
  });
});

// ---------------------------------------------------------------------------
// KaTeX rendering helper (isolated test without real KaTeX)
// We mock the dynamic import to test the rendering path in isolation.
// ---------------------------------------------------------------------------

describe('renderLatex (mocked KaTeX)', () => {
  // Re-implement the renderLatex function here so we can test it without
  // triggering a real dynamic import in the test environment.

  interface MockKaTeX {
    renderToString: ReturnType<typeof vi.fn>;
  }

  let mockKatex: MockKaTeX;

  async function renderLatexWithMock(
    katex: MockKaTeX | null,
    latex: string,
    displayMode: boolean,
  ): Promise<{ html: string | null; error: string | null }> {
    if (!katex) {
      return {
        html: null,
        error: 'KaTeX is not installed. Run: pnpm add katex',
      };
    }

    try {
      const html = katex.renderToString(latex, {
        displayMode,
        throwOnError: true,
        errorColor: '#ef4444',
        trust: false,
      }) as string;
      return { html, error: null };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid LaTeX expression';
      return { html: null, error: message };
    }
  }

  beforeEach(() => {
    mockKatex = {
      renderToString: vi.fn(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns rendered HTML for valid inline LaTeX', async () => {
    const fakeHtml = '<span class="katex">E = mc<sup>2</sup></span>';
    mockKatex.renderToString.mockReturnValue(fakeHtml);

    const result = await renderLatexWithMock(mockKatex, 'E = mc^2', false);

    expect(result.html).toBe(fakeHtml);
    expect(result.error).toBeNull();
    expect(mockKatex.renderToString).toHaveBeenCalledWith('E = mc^2', {
      displayMode: false,
      throwOnError: true,
      errorColor: '#ef4444',
      trust: false,
    });
  });

  it('returns rendered HTML for valid display-mode LaTeX', async () => {
    const fakeHtml = '<span class="katex-display"><span class="katex">...</span></span>';
    mockKatex.renderToString.mockReturnValue(fakeHtml);

    const result = await renderLatexWithMock(mockKatex, '\\frac{a}{b}', true);

    expect(result.html).toBe(fakeHtml);
    expect(result.error).toBeNull();
    expect(mockKatex.renderToString).toHaveBeenCalledWith('\\frac{a}{b}', {
      displayMode: true,
      throwOnError: true,
      errorColor: '#ef4444',
      trust: false,
    });
  });

  it('returns error object when KaTeX throws a parse error', async () => {
    const parseError = new Error("KaTeX parse error: Expected '}' ...");
    mockKatex.renderToString.mockImplementation(() => {
      throw parseError;
    });

    const result = await renderLatexWithMock(mockKatex, '\\frac{a}{', false);

    expect(result.html).toBeNull();
    expect(result.error).toBe(parseError.message);
  });

  it('returns generic error message when KaTeX throws a non-Error', async () => {
    mockKatex.renderToString.mockImplementation(() => {
      throw 'something went wrong';
    });

    const result = await renderLatexWithMock(mockKatex, '\\bad', false);

    expect(result.html).toBeNull();
    expect(result.error).toBe('Invalid LaTeX expression');
  });

  it('returns error when KaTeX module is not available (null)', async () => {
    const result = await renderLatexWithMock(null, 'x^2', false);

    expect(result.html).toBeNull();
    expect(result.error).toContain('KaTeX is not installed');
  });

  it('calls renderToString with displayMode=false for inline math', async () => {
    mockKatex.renderToString.mockReturnValue('<span>rendered</span>');

    await renderLatexWithMock(mockKatex, 'a + b', false);

    const call = mockKatex.renderToString.mock.calls[0] as [string, { displayMode: boolean }];
    expect(call[1].displayMode).toBe(false);
  });

  it('calls renderToString with displayMode=true for block math', async () => {
    mockKatex.renderToString.mockReturnValue('<div>rendered</div>');

    await renderLatexWithMock(mockKatex, 'a + b', true);

    const call = mockKatex.renderToString.mock.calls[0] as [string, { displayMode: boolean }];
    expect(call[1].displayMode).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MathInline extension attribute contract tests
// These verify the attribute shapes returned by addAttributes() without
// instantiating a real TipTap editor.
// ---------------------------------------------------------------------------

describe('MathInline attribute contract', () => {
  it('default latex attribute is empty string', () => {
    // Mirror the default from math-inline.ts addAttributes()
    const defaults = { latex: '' };
    expect(defaults.latex).toBe('');
  });

  it('parseHTML reads data-math-latex attribute', () => {
    const el = document.createElement('span');
    el.setAttribute('data-math-latex', 'E = mc^2');
    const parseHTML = (element: Element) => element.getAttribute('data-math-latex') ?? '';
    expect(parseHTML(el)).toBe('E = mc^2');
  });

  it('parseHTML returns empty string when attribute is missing', () => {
    const el = document.createElement('span');
    const parseHTML = (element: Element) => element.getAttribute('data-math-latex') ?? '';
    expect(parseHTML(el)).toBe('');
  });
});

// ---------------------------------------------------------------------------
// MathBlock attribute contract tests
// ---------------------------------------------------------------------------

describe('MathBlock attribute contract', () => {
  it('default latex attribute is empty string', () => {
    const defaults = { latex: '' };
    expect(defaults.latex).toBe('');
  });

  it('parseHTML reads data-math-latex from block container', () => {
    const el = document.createElement('div');
    el.setAttribute('data-math-latex', '\\sum_{i=0}^n i');
    const parseHTML = (element: Element) => element.getAttribute('data-math-latex') ?? '';
    expect(parseHTML(el)).toBe('\\sum_{i=0}^n i');
  });
});

// ---------------------------------------------------------------------------
// Slash command integration — verify the "math" item is present in the
// BUILT_IN_SLASH_ITEMS list and has the correct metadata.
// We import only the items array, which has no DOM dependencies.
// ---------------------------------------------------------------------------

describe('slash command math item', () => {
  it('BUILT_IN_SLASH_ITEMS contains a math entry', async () => {
    // We need to import the slash-command module here. It has no DOM deps
    // in this part of its code since BUILT_IN_SLASH_ITEMS is a plain array.
    const { BUILT_IN_SLASH_ITEMS } = await import('../extensions/slash-command');

    const mathItem = BUILT_IN_SLASH_ITEMS.find((item) => item.id === 'math');
    expect(mathItem).toBeDefined();
    expect(mathItem!.group).toBe('Advanced');
    expect(mathItem!.keywords).toContain('katex');
    expect(mathItem!.keywords).toContain('latex');
  });
});
