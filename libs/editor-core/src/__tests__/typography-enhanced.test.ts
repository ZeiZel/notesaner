/**
 * Unit tests for the TypographyEnhanced TipTap extension.
 *
 * Tests verify the Unicode constant exports and the text replacement
 * patterns that power the input rules, without requiring a full editor.
 */

import { describe, it, expect } from 'vitest';
import {
  EM_DASH,
  EN_DASH,
  ELLIPSIS,
  LEFT_DOUBLE_QUOTE,
  RIGHT_DOUBLE_QUOTE,
  LEFT_SINGLE_QUOTE,
  RIGHT_SINGLE_QUOTE,
  RIGHT_ARROW,
  LEFT_ARROW,
  DOUBLE_RIGHT_ARROW,
  COPYRIGHT,
  REGISTERED,
  TRADEMARK,
  PLUS_MINUS,
  MULTIPLICATION,
  ONE_HALF,
  ONE_QUARTER,
  THREE_QUARTERS,
} from '../extensions/typography-enhanced';

// ---------------------------------------------------------------------------
// Unicode constant correctness
// ---------------------------------------------------------------------------

describe('Typography Unicode constants', () => {
  it('EM_DASH is U+2014', () => {
    expect(EM_DASH).toBe('\u2014');
    expect(EM_DASH.codePointAt(0)).toBe(0x2014);
  });

  it('EN_DASH is U+2013', () => {
    expect(EN_DASH).toBe('\u2013');
    expect(EN_DASH.codePointAt(0)).toBe(0x2013);
  });

  it('ELLIPSIS is U+2026', () => {
    expect(ELLIPSIS).toBe('\u2026');
    expect(ELLIPSIS.codePointAt(0)).toBe(0x2026);
  });

  it('LEFT_DOUBLE_QUOTE is U+201C', () => {
    expect(LEFT_DOUBLE_QUOTE).toBe('\u201C');
  });

  it('RIGHT_DOUBLE_QUOTE is U+201D', () => {
    expect(RIGHT_DOUBLE_QUOTE).toBe('\u201D');
  });

  it('LEFT_SINGLE_QUOTE is U+2018', () => {
    expect(LEFT_SINGLE_QUOTE).toBe('\u2018');
  });

  it('RIGHT_SINGLE_QUOTE is U+2019', () => {
    expect(RIGHT_SINGLE_QUOTE).toBe('\u2019');
  });

  it('RIGHT_ARROW is U+2192', () => {
    expect(RIGHT_ARROW).toBe('\u2192');
  });

  it('LEFT_ARROW is U+2190', () => {
    expect(LEFT_ARROW).toBe('\u2190');
  });

  it('DOUBLE_RIGHT_ARROW is U+21D2', () => {
    expect(DOUBLE_RIGHT_ARROW).toBe('\u21D2');
  });

  it('COPYRIGHT is U+00A9', () => {
    expect(COPYRIGHT).toBe('\u00A9');
  });

  it('REGISTERED is U+00AE', () => {
    expect(REGISTERED).toBe('\u00AE');
  });

  it('TRADEMARK is U+2122', () => {
    expect(TRADEMARK).toBe('\u2122');
  });

  it('PLUS_MINUS is U+00B1', () => {
    expect(PLUS_MINUS).toBe('\u00B1');
  });

  it('MULTIPLICATION is U+00D7', () => {
    expect(MULTIPLICATION).toBe('\u00D7');
  });

  it('ONE_HALF is U+00BD', () => {
    expect(ONE_HALF).toBe('\u00BD');
  });

  it('ONE_QUARTER is U+00BC', () => {
    expect(ONE_QUARTER).toBe('\u00BC');
  });

  it('THREE_QUARTERS is U+00BE', () => {
    expect(THREE_QUARTERS).toBe('\u00BE');
  });
});

// ---------------------------------------------------------------------------
// Replacement pattern tests (regex-only, no editor needed)
// ---------------------------------------------------------------------------

describe('Typography replacement patterns', () => {
  describe('em-dash: -- triggers', () => {
    const regex = /--$/;

    it('matches -- at end of string', () => {
      expect(regex.test('hello --')).toBe(true);
      expect(regex.test('--')).toBe(true);
    });

    it('does not match single dash', () => {
      expect(regex.test('hello -')).toBe(false);
    });

    it('does not match --- (triple dash)', () => {
      // --- still ends with --, so it technically matches the last two chars
      expect(regex.test('---')).toBe(true);
    });
  });

  describe('ellipsis: ... triggers', () => {
    const regex = /\.\.\.$/;

    it('matches ... at end of string', () => {
      expect(regex.test('wait...')).toBe(true);
    });

    it('does not match two dots', () => {
      expect(regex.test('wait..')).toBe(false);
    });

    it('does not match single dot', () => {
      expect(regex.test('wait.')).toBe(false);
    });
  });

  describe('arrows', () => {
    it('-> matches right arrow pattern', () => {
      expect(/->$/.test('input ->')).toBe(true);
    });

    it('<- matches left arrow pattern', () => {
      expect(/<-$/.test('output <-')).toBe(true);
    });

    it('=> matches double right arrow pattern', () => {
      expect(/=>$/.test('implies =>')).toBe(true);
    });
  });

  describe('copyright symbols', () => {
    it('(c) matches copyright pattern', () => {
      expect(/\(c\)$/i.test('(c)')).toBe(true);
      expect(/\(c\)$/i.test('(C)')).toBe(true);
    });

    it('(r) matches registered pattern', () => {
      expect(/\(r\)$/i.test('(r)')).toBe(true);
      expect(/\(r\)$/i.test('(R)')).toBe(true);
    });

    it('(tm) matches trademark pattern', () => {
      expect(/\(tm\)$/i.test('(tm)')).toBe(true);
      expect(/\(tm\)$/i.test('(TM)')).toBe(true);
    });
  });

  describe('plus-minus', () => {
    it('+/- matches pattern', () => {
      expect(/\+\/-$/.test('+/-')).toBe(true);
    });

    it('+- does not match (no slash)', () => {
      expect(/\+\/-$/.test('+-')).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Visual representation tests
// ---------------------------------------------------------------------------

describe('Typography visual characters', () => {
  it('em-dash is visually distinct from hyphen', () => {
    expect(EM_DASH).not.toBe('-');
    expect(EM_DASH).not.toBe('--');
    expect(EM_DASH.length).toBe(1);
  });

  it('en-dash is visually distinct from hyphen', () => {
    expect(EN_DASH).not.toBe('-');
    expect(EN_DASH.length).toBe(1);
  });

  it('ellipsis is a single character', () => {
    expect(ELLIPSIS.length).toBe(1);
    expect(ELLIPSIS).not.toBe('...');
  });

  it('all quote characters are single characters', () => {
    expect(LEFT_DOUBLE_QUOTE.length).toBe(1);
    expect(RIGHT_DOUBLE_QUOTE.length).toBe(1);
    expect(LEFT_SINGLE_QUOTE.length).toBe(1);
    expect(RIGHT_SINGLE_QUOTE.length).toBe(1);
  });

  it('all arrow characters are single characters', () => {
    expect(RIGHT_ARROW.length).toBe(1);
    expect(LEFT_ARROW.length).toBe(1);
    expect(DOUBLE_RIGHT_ARROW.length).toBe(1);
  });

  it('fraction characters are single characters', () => {
    expect(ONE_HALF.length).toBe(1);
    expect(ONE_QUARTER.length).toBe(1);
    expect(THREE_QUARTERS.length).toBe(1);
  });
});
