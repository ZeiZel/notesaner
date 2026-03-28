import { describe, it, expect } from 'vitest';
import { sanitizeCss, isCssSafe, combineSnippets } from '../css-sanitizer';

// ---------------------------------------------------------------------------
// sanitizeCss
// ---------------------------------------------------------------------------

describe('sanitizeCss', () => {
  it('passes through valid CSS unchanged', () => {
    const css = `.my-class { color: red; background: var(--ns-color-background); }`;
    const result = sanitizeCss(css);
    expect(result.css).toBe(css);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes through CSS custom properties', () => {
    const css = `:root { --ns-color-primary: #cba6f7; --my-custom: 42px; }`;
    const result = sanitizeCss(css);
    expect(result.css).toBe(css);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes through CSS functions like calc, var, clamp, min, max', () => {
    const css = `.test { width: calc(100% - var(--ns-space-4)); font-size: clamp(14px, 2vw, 18px); }`;
    const result = sanitizeCss(css);
    expect(result.css).toBe(css);
    expect(result.warnings).toHaveLength(0);
  });

  it('passes through @media, @supports, @keyframes at-rules', () => {
    const css = `@media (max-width: 768px) { .a { color: red; } } @keyframes spin { 0% { transform: rotate(0deg); } }`;
    const result = sanitizeCss(css);
    expect(result.css).toBe(css);
    expect(result.warnings).toHaveLength(0);
  });

  it('blocks @import rules', () => {
    const css = `@import "malicious.css"; .safe { color: red; }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.css).toContain('.safe { color: red; }');
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('@import');
  });

  it('blocks @import url() rules', () => {
    const css = `@import url("https://evil.com/style.css"); .safe { color: blue; }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks url() in property values', () => {
    const css = `.bg { background: url("https://evil.com/track.gif"); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings).toContain('url() values are not allowed (external resource loading)');
  });

  it('blocks data URIs in url()', () => {
    const css = `.bg { background: url("data:image/png;base64,iVBOR..."); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
  });

  it('blocks expression() (IE script injection)', () => {
    const css = `.evil { width: expression(document.body.clientWidth); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings).toContain('expression() is not allowed (script execution)');
  });

  it('blocks javascript: protocol', () => {
    const css = `.evil { background: javascript:alert(1); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings).toContain('javascript: protocol is not allowed');
  });

  it('blocks behavior property (IE HTC)', () => {
    const css = `.evil { behavior: url(evil.htc); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('blocks -moz-binding property (XBL)', () => {
    const css = `.evil { -moz-binding: url("evil.xml#xbl"); }`;
    const result = sanitizeCss(css);
    expect(result.css).toContain('/* [blocked] */');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('handles multiple blocked constructs in one snippet', () => {
    const css = `
      @import "evil.css";
      .bg { background: url("track.gif"); }
      .safe { color: var(--ns-color-primary); }
    `;
    const result = sanitizeCss(css);
    expect(result.css).toContain('.safe { color: var(--ns-color-primary); }');
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it('handles empty input', () => {
    const result = sanitizeCss('');
    expect(result.css).toBe('');
    expect(result.warnings).toHaveLength(0);
  });

  it('preserves Obsidian-compatible variables', () => {
    const css = `.custom { color: var(--text-normal); background: var(--background-primary); }`;
    const result = sanitizeCss(css);
    expect(result.css).toBe(css);
    expect(result.warnings).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// isCssSafe
// ---------------------------------------------------------------------------

describe('isCssSafe', () => {
  it('returns true for safe CSS', () => {
    expect(isCssSafe('.a { color: red; }')).toBe(true);
    expect(isCssSafe(':root { --ns-color-primary: #cba6f7; }')).toBe(true);
  });

  it('returns false for CSS with @import', () => {
    expect(isCssSafe('@import "evil.css";')).toBe(false);
  });

  it('returns false for CSS with url()', () => {
    expect(isCssSafe('.bg { background: url("img.png"); }')).toBe(false);
  });

  it('returns false for CSS with expression()', () => {
    expect(isCssSafe('.x { width: expression(1+1); }')).toBe(false);
  });

  it('returns false for javascript: protocol', () => {
    expect(isCssSafe('.x { background: javascript:void(0); }')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// combineSnippets
// ---------------------------------------------------------------------------

describe('combineSnippets', () => {
  it('combines enabled snippets only', () => {
    const snippets = [
      { css: '.a { color: red; }', enabled: true },
      { css: '.b { color: blue; }', enabled: false },
      { css: '.c { color: green; }', enabled: true },
    ];
    const result = combineSnippets(snippets);
    expect(result.css).toContain('.a { color: red; }');
    expect(result.css).not.toContain('.b { color: blue; }');
    expect(result.css).toContain('.c { color: green; }');
  });

  it('sanitizes each snippet before combining', () => {
    const snippets = [
      { css: '.safe { color: red; }', enabled: true },
      { css: '@import "evil.css"; .also-safe { color: blue; }', enabled: true },
    ];
    const result = combineSnippets(snippets);
    expect(result.css).toContain('.safe { color: red; }');
    expect(result.css).toContain('.also-safe { color: blue; }');
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty string when no snippets are enabled', () => {
    const snippets = [{ css: '.a { color: red; }', enabled: false }];
    const result = combineSnippets(snippets);
    expect(result.css).toBe('');
    expect(result.warnings).toHaveLength(0);
  });

  it('handles empty snippets array', () => {
    const result = combineSnippets([]);
    expect(result.css).toBe('');
    expect(result.warnings).toHaveLength(0);
  });
});
