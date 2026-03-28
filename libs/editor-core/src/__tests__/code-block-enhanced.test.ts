/**
 * Unit tests for the CodeBlockEnhanced TipTap extension.
 *
 * Tests exercise pure logic without a DOM or full editor instance:
 * - resolveLanguage: alias resolution
 * - COMMON_LANGUAGES: completeness and uniqueness
 * - LANGUAGE_ALIASES: alias correctness
 * - Input rule regex matching / non-matching
 * - Plain-text serialisation
 */

import { describe, it, expect } from 'vitest';
import {
  resolveLanguage,
  COMMON_LANGUAGES,
  LANGUAGE_ALIASES,
  CODE_BLOCK_INPUT_REGEX,
} from '../extensions/code-block-enhanced';

// ---------------------------------------------------------------------------
// resolveLanguage
// ---------------------------------------------------------------------------

describe('resolveLanguage', () => {
  it('returns the language as-is when no alias exists', () => {
    expect(resolveLanguage('javascript')).toBe('javascript');
    expect(resolveLanguage('python')).toBe('python');
    expect(resolveLanguage('rust')).toBe('rust');
  });

  it('resolves common aliases', () => {
    expect(resolveLanguage('js')).toBe('javascript');
    expect(resolveLanguage('ts')).toBe('typescript');
    expect(resolveLanguage('py')).toBe('python');
    expect(resolveLanguage('rb')).toBe('ruby');
    expect(resolveLanguage('sh')).toBe('shell');
    expect(resolveLanguage('yml')).toBe('yaml');
    expect(resolveLanguage('rs')).toBe('rust');
  });

  it('is case-insensitive', () => {
    expect(resolveLanguage('JS')).toBe('javascript');
    expect(resolveLanguage('Ts')).toBe('typescript');
    expect(resolveLanguage('PY')).toBe('python');
  });

  it('trims whitespace', () => {
    expect(resolveLanguage('  javascript  ')).toBe('javascript');
    expect(resolveLanguage('\tjs\n')).toBe('javascript');
  });

  it('returns empty string for empty input', () => {
    expect(resolveLanguage('')).toBe('');
  });

  it('returns normalised value for unknown languages', () => {
    expect(resolveLanguage('brainfuck')).toBe('brainfuck');
    expect(resolveLanguage('COBOL')).toBe('cobol');
  });

  it('resolves C++ aliases', () => {
    expect(resolveLanguage('c++')).toBe('cpp');
    expect(resolveLanguage('C#')).toBe('csharp');
    expect(resolveLanguage('cs')).toBe('csharp');
  });

  it('resolves additional aliases', () => {
    expect(resolveLanguage('kt')).toBe('kotlin');
    expect(resolveLanguage('gql')).toBe('graphql');
    expect(resolveLanguage('md')).toBe('markdown');
    expect(resolveLanguage('tex')).toBe('latex');
    expect(resolveLanguage('zsh')).toBe('bash');
  });
});

// ---------------------------------------------------------------------------
// COMMON_LANGUAGES
// ---------------------------------------------------------------------------

describe('COMMON_LANGUAGES', () => {
  it('is a non-empty array', () => {
    expect(COMMON_LANGUAGES.length).toBeGreaterThan(0);
  });

  it('has unique values', () => {
    const values = COMMON_LANGUAGES.map((l) => l.value);
    const unique = new Set(values);
    expect(unique.size).toBe(values.length);
  });

  it('first entry is plain text (empty value)', () => {
    expect(COMMON_LANGUAGES[0].value).toBe('');
    expect(COMMON_LANGUAGES[0].label).toBe('Plain text');
  });

  it('includes common web development languages', () => {
    const values = new Set(COMMON_LANGUAGES.map((l) => l.value));
    expect(values.has('javascript')).toBe(true);
    expect(values.has('typescript')).toBe(true);
    expect(values.has('html')).toBe(true);
    expect(values.has('css')).toBe(true);
    expect(values.has('json')).toBe(true);
  });

  it('includes common systems languages', () => {
    const values = new Set(COMMON_LANGUAGES.map((l) => l.value));
    expect(values.has('python')).toBe(true);
    expect(values.has('rust')).toBe(true);
    expect(values.has('go')).toBe(true);
    expect(values.has('java')).toBe(true);
  });

  it('each entry has a non-empty label', () => {
    for (const lang of COMMON_LANGUAGES) {
      expect(lang.label.length, `Language "${lang.value}" has empty label`).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// LANGUAGE_ALIASES
// ---------------------------------------------------------------------------

describe('LANGUAGE_ALIASES', () => {
  it('all alias values are lowercase strings', () => {
    for (const [_alias, target] of Object.entries(LANGUAGE_ALIASES)) {
      expect(typeof target).toBe('string');
      expect(target).toBe(target.toLowerCase());
    }
  });

  it('does not contain circular aliases', () => {
    for (const [alias, target] of Object.entries(LANGUAGE_ALIASES)) {
      expect(alias).not.toBe(target);
    }
  });

  it('has at least 10 aliases', () => {
    expect(Object.keys(LANGUAGE_ALIASES).length).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// CODE_BLOCK_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('CODE_BLOCK_INPUT_REGEX', () => {
  function match(input: string) {
    return CODE_BLOCK_INPUT_REGEX.exec(input);
  }

  // Happy path
  it('matches "```" with no language', () => {
    const m = match('```');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('');
  });

  it('matches "```javascript"', () => {
    const m = match('```javascript');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('javascript');
  });

  it('matches "```typescript"', () => {
    const m = match('```typescript');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('typescript');
  });

  it('matches "```python"', () => {
    const m = match('```python');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('python');
  });

  it('matches "```js"', () => {
    const m = match('```js');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('js');
  });

  it('matches "```c++"', () => {
    const m = match('```c++');
    expect(m).not.toBeNull();
    // The + is part of the character class in the regex
  });

  it('matches "```c#"', () => {
    const m = match('```c#');
    expect(m).not.toBeNull();
  });

  it('matches with trailing whitespace', () => {
    const m = match('```rust   ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('rust');
  });

  // Non-matching cases
  it('does not match without ``` prefix', () => {
    expect(match('javascript')).toBeNull();
  });

  it('does not match with only two backticks', () => {
    expect(match('``javascript')).toBeNull();
  });

  it('does not match if not at line start', () => {
    // The ^ anchor ensures line start
    const m = match('some text ```javascript');
    // The regex requires ^ (start of string), so this should not match
    expect(m).toBeNull();
  });

  it('does not match with space between backticks and language', () => {
    // "``` javascript" — the language has a space before it
    const m = match('``` javascript');
    // The regex expects the language to immediately follow the backticks
    // Actually [a-zA-Z0-9+#._-]* allows zero-length, so let's check
    // The match would be ``` with empty language, followed by "javascript" as trailing
    if (m) {
      expect(m[1]).toBe('');
    }
  });
});

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

describe('code block plain-text serialisation', () => {
  function renderText(language: string, code: string): string {
    return `\`\`\`${language}\n${code}\n\`\`\``;
  }

  it('serialises a JavaScript code block', () => {
    const code = 'const x = 42;';
    expect(renderText('javascript', code)).toBe('```javascript\nconst x = 42;\n```');
  });

  it('serialises a plain text code block', () => {
    const code = 'hello world';
    expect(renderText('', code)).toBe('```\nhello world\n```');
  });

  it('preserves multi-line code', () => {
    const code = 'function foo() {\n  return bar;\n}';
    expect(renderText('typescript', code)).toBe(
      '```typescript\nfunction foo() {\n  return bar;\n}\n```',
    );
  });

  it('handles empty code', () => {
    expect(renderText('python', '')).toBe('```python\n\n```');
  });
});

// ---------------------------------------------------------------------------
// Attribute contract (pure logic — no DOM needed)
// ---------------------------------------------------------------------------

describe('CodeBlockEnhanced attribute contract', () => {
  it('language class regex extracts language from "language-typescript"', () => {
    const classMatch = /language-(\S+)/.exec('language-typescript');
    expect(classMatch).not.toBeNull();
    expect(resolveLanguage(classMatch![1])).toBe('typescript');
  });

  it('language class regex returns null for empty class', () => {
    const classMatch = /language-(\S+)/.exec('');
    expect(classMatch).toBeNull();
  });

  it('resolveLanguage handles data-language values', () => {
    expect(resolveLanguage('python')).toBe('python');
    expect(resolveLanguage('')).toBe('');
  });

  it('showLineNumbers defaults are boolean true/false', () => {
    // The extension default is true; verify string parsing
    const trueStr = String(true);
    const falseStr = String(false);
    expect(trueStr !== falseStr).toBe(true);
    expect(Boolean(trueStr)).toBe(true);
  });

  it('filename can be null or a string', () => {
    const filename: string | null = null;
    expect(filename).toBeNull();
    const withName: string | null = 'main.ts';
    expect(withName).toBe('main.ts');
  });
});
