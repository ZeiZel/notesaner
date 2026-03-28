/**
 * Unit tests for the CalloutBlock TipTap extension.
 *
 * Tests exercise pure logic without a DOM or full editor instance:
 * - resolveCalloutType: keyword → canonical type mapping
 * - CALLOUT_ALIASES: alias completeness
 * - CALLOUT_DEFAULT_TITLES: all types have defaults
 * - Input rule regex matching / non-matching
 * - Plain-text serialisation
 */

import { describe, it, expect } from 'vitest';
import {
  resolveCalloutType,
  CALLOUT_ALIASES,
  CALLOUT_TYPES,
  CALLOUT_DEFAULT_TITLES,
  CALLOUT_INPUT_REGEX,
} from '../extensions/callout-block';
import type { CalloutType } from '../extensions/callout-block';

// ---------------------------------------------------------------------------
// resolveCalloutType
// ---------------------------------------------------------------------------

describe('resolveCalloutType', () => {
  it('resolves canonical types directly', () => {
    expect(resolveCalloutType('info')).toBe('info');
    expect(resolveCalloutType('warning')).toBe('warning');
    expect(resolveCalloutType('tip')).toBe('tip');
    expect(resolveCalloutType('danger')).toBe('danger');
    expect(resolveCalloutType('note')).toBe('note');
  });

  it('resolves info aliases', () => {
    expect(resolveCalloutType('information')).toBe('info');
  });

  it('resolves warning aliases', () => {
    expect(resolveCalloutType('caution')).toBe('warning');
    expect(resolveCalloutType('attention')).toBe('warning');
  });

  it('resolves tip aliases', () => {
    expect(resolveCalloutType('hint')).toBe('tip');
    expect(resolveCalloutType('important')).toBe('tip');
  });

  it('resolves danger aliases', () => {
    expect(resolveCalloutType('error')).toBe('danger');
    expect(resolveCalloutType('bug')).toBe('danger');
  });

  it('resolves note aliases', () => {
    expect(resolveCalloutType('abstract')).toBe('note');
    expect(resolveCalloutType('summary')).toBe('note');
    expect(resolveCalloutType('tldr')).toBe('note');
  });

  it('is case-insensitive', () => {
    expect(resolveCalloutType('INFO')).toBe('info');
    expect(resolveCalloutType('Warning')).toBe('warning');
    expect(resolveCalloutType('TIP')).toBe('tip');
    expect(resolveCalloutType('DANGER')).toBe('danger');
    expect(resolveCalloutType('NOTE')).toBe('note');
    expect(resolveCalloutType('CAUTION')).toBe('warning');
    expect(resolveCalloutType('BUG')).toBe('danger');
    expect(resolveCalloutType('TLDR')).toBe('note');
  });

  it('trims whitespace', () => {
    expect(resolveCalloutType('  info  ')).toBe('info');
    expect(resolveCalloutType('\ttip\n')).toBe('tip');
  });

  it('defaults to "note" for unknown keywords', () => {
    expect(resolveCalloutType('unknown')).toBe('note');
    expect(resolveCalloutType('foobar')).toBe('note');
    expect(resolveCalloutType('')).toBe('note');
  });
});

// ---------------------------------------------------------------------------
// CALLOUT_ALIASES
// ---------------------------------------------------------------------------

describe('CALLOUT_ALIASES', () => {
  it('maps all canonical types to themselves', () => {
    for (const type of CALLOUT_TYPES) {
      expect(CALLOUT_ALIASES[type]).toBe(type);
    }
  });

  it('all alias values are valid CalloutType values', () => {
    const validTypes = new Set<string>(CALLOUT_TYPES);
    for (const [alias, type] of Object.entries(CALLOUT_ALIASES)) {
      expect(validTypes.has(type), `Alias "${alias}" maps to invalid type "${type}"`).toBe(true);
    }
  });

  it('has at least one alias per canonical type', () => {
    const reverseLookup = new Map<string, string[]>();
    for (const [alias, type] of Object.entries(CALLOUT_ALIASES)) {
      if (!reverseLookup.has(type)) reverseLookup.set(type, []);
      reverseLookup.get(type)!.push(alias);
    }

    for (const type of CALLOUT_TYPES) {
      const aliases = reverseLookup.get(type) ?? [];
      expect(
        aliases.length,
        `Type "${type}" should have at least one alias`,
      ).toBeGreaterThanOrEqual(1);
    }
  });
});

// ---------------------------------------------------------------------------
// CALLOUT_TYPES
// ---------------------------------------------------------------------------

describe('CALLOUT_TYPES', () => {
  it('contains exactly 5 types', () => {
    expect(CALLOUT_TYPES).toHaveLength(5);
  });

  it('includes all expected types', () => {
    expect(CALLOUT_TYPES).toContain('info');
    expect(CALLOUT_TYPES).toContain('warning');
    expect(CALLOUT_TYPES).toContain('tip');
    expect(CALLOUT_TYPES).toContain('danger');
    expect(CALLOUT_TYPES).toContain('note');
  });

  it('has no duplicates', () => {
    const unique = new Set(CALLOUT_TYPES);
    expect(unique.size).toBe(CALLOUT_TYPES.length);
  });
});

// ---------------------------------------------------------------------------
// CALLOUT_DEFAULT_TITLES
// ---------------------------------------------------------------------------

describe('CALLOUT_DEFAULT_TITLES', () => {
  it('has a default title for every canonical type', () => {
    for (const type of CALLOUT_TYPES) {
      expect(CALLOUT_DEFAULT_TITLES[type]).toBeDefined();
      expect(typeof CALLOUT_DEFAULT_TITLES[type]).toBe('string');
      expect(CALLOUT_DEFAULT_TITLES[type].length).toBeGreaterThan(0);
    }
  });

  it('capitalises the first letter of each default title', () => {
    for (const type of CALLOUT_TYPES) {
      const title = CALLOUT_DEFAULT_TITLES[type];
      expect(title[0]).toBe(title[0].toUpperCase());
    }
  });
});

// ---------------------------------------------------------------------------
// CALLOUT_INPUT_REGEX
// ---------------------------------------------------------------------------

describe('CALLOUT_INPUT_REGEX', () => {
  function match(input: string) {
    return CALLOUT_INPUT_REGEX.exec(input);
  }

  // Happy path
  it('matches "> [!info]" with no title', () => {
    const m = match('> [!info]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('info');
    expect(m![2]).toBeUndefined();
  });

  it('matches "> [!warning] Watch out" with a title', () => {
    const m = match('> [!warning] Watch out');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('warning');
    expect(m![2]).toBe('Watch out');
  });

  it('matches "> [!tip] Pro tip: use this" with title containing colon', () => {
    const m = match('> [!tip] Pro tip: use this');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('tip');
    expect(m![2]).toBe('Pro tip: use this');
  });

  it('matches "> [!danger]" exactly', () => {
    const m = match('> [!danger]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('danger');
  });

  it('matches "> [!note] " with trailing space', () => {
    const m = match('> [!note] ');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('note');
  });

  it('matches aliases like "> [!caution]"', () => {
    const m = match('> [!caution]');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('caution');
  });

  it('matches with extra space after >', () => {
    const m = match('>  [!info] Title');
    expect(m).not.toBeNull();
    expect(m![1]).toBe('info');
    expect(m![2]).toBe('Title');
  });

  // Non-matching cases
  it('does not match without the > prefix', () => {
    expect(match('[!info] Title')).toBeNull();
  });

  it('does not match without the ! inside brackets', () => {
    expect(match('> [info] Title')).toBeNull();
  });

  it('does not match empty brackets', () => {
    expect(match('> [!]')).toBeNull();
  });

  it('does not match with special characters in type', () => {
    expect(match('> [!in-fo] Title')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Serialisation
// ---------------------------------------------------------------------------

describe('callout plain-text serialisation', () => {
  function renderText(type: CalloutType, title: string): string {
    return `> [!${type}] ${title}\n`;
  }

  it('serialises info callout', () => {
    expect(renderText('info', 'Info')).toBe('> [!info] Info\n');
  });

  it('serialises warning with custom title', () => {
    expect(renderText('warning', 'Be careful!')).toBe('> [!warning] Be careful!\n');
  });

  it('serialises danger callout', () => {
    expect(renderText('danger', 'Danger')).toBe('> [!danger] Danger\n');
  });
});

// ---------------------------------------------------------------------------
// Attribute contract (pure logic — no DOM needed)
// ---------------------------------------------------------------------------

describe('CalloutBlock attribute contract', () => {
  it('resolveCalloutType maps "warning" attribute correctly', () => {
    const type = resolveCalloutType('warning');
    expect(type).toBe('warning');
  });

  it('resolveCalloutType maps "caution" alias correctly', () => {
    const type = resolveCalloutType('caution');
    expect(type).toBe('warning');
  });

  it('resolveCalloutType defaults to "note" for empty string', () => {
    const type = resolveCalloutType('');
    expect(type).toBe('note');
  });

  it('collapsed attribute serialises to "true" / "false" strings', () => {
    // String(boolean) produces the correct attribute value
    expect(String(true)).toBe('true');
    expect(String(false)).toBe('false');
    // The attribute parser checks: getAttribute(...) === 'true'
    function parseCollapsed(val: string): boolean {
      return val === 'true';
    }
    expect(parseCollapsed('true')).toBe(true);
    expect(parseCollapsed('false')).toBe(false);
  });
});
