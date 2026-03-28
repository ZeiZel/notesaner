/**
 * Tests for flashcard syntax parsing (card-parser).
 *
 * Coverage:
 * - parseCardsFromMarkdown — inline cards, block cards, cloze cards, mixed
 * - extractClozeMarkers — marker extraction and positions
 * - revealAllCloze — cloze answer substitution
 * - hideClozeGroup — hides a specific group during review
 * - selectionToCard — converts selected text to a card
 * - serializeInlineCard / serializeBlockCard — round-trip serialization
 * - Edge cases: empty input, malformed syntax, nested content
 */

import { describe, it, expect } from 'vitest';
import {
  parseCardsFromMarkdown,
  extractClozeMarkers,
  revealAllCloze,
  hideClozeGroup,
  selectionToCard,
  serializeInlineCard,
  serializeBlockCard,
} from '../card-parser';

// ---------------------------------------------------------------------------
// parseCardsFromMarkdown — inline cards
// ---------------------------------------------------------------------------

describe('parseCardsFromMarkdown — inline cards', () => {
  it('parses a single inline card', () => {
    const md = '?? What is the capital of France? :: Paris';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('basic');
    expect(cards[0].front).toBe('What is the capital of France?');
    expect(cards[0].back).toBe('Paris');
  });

  it('parses multiple inline cards in a document', () => {
    const md = ['?? Question 1 :: Answer 1', 'Some prose text', '?? Question 2 :: Answer 2'].join(
      '\n',
    );

    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(2);
    expect(cards[0].front).toBe('Question 1');
    expect(cards[1].front).toBe('Question 2');
  });

  it('trims whitespace from front and back', () => {
    const md = '??   Leading spaces   ::   trailing spaces   ';
    const cards = parseCardsFromMarkdown(md);
    expect(cards[0].front).toBe('Leading spaces');
    expect(cards[0].back).toBe('trailing spaces');
  });

  it('records the correct source line for inline cards', () => {
    const md = ['First line', '?? Q :: A', 'Third line'].join('\n');
    const cards = parseCardsFromMarkdown(md);
    expect(cards[0].sourceLine).toBe(1);
  });

  it('does not create a card for a line with ?? but no ::', () => {
    const md = '?? This has no separator';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(0);
  });

  it('handles inline card with :: in the back side', () => {
    // The first :: outside a cloze block is the separator
    const md = '?? What does it mean? :: It is a separator :: sometimes';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe('What does it mean?');
    expect(cards[0].back).toBe('It is a separator :: sometimes');
  });

  it('handles cloze marker with :: in inline card front correctly', () => {
    // The :: inside {{c1::capital}} is inside a cloze block and must not be
    // treated as the front/back separator
    const md = '?? The {{c1::capital}} of France :: The answer question';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('cloze');
    expect(cards[0].front).toBe('The {{c1::capital}} of France');
    expect(cards[0].back).toBe('The answer question');
  });
});

// ---------------------------------------------------------------------------
// parseCardsFromMarkdown — block cards
// ---------------------------------------------------------------------------

describe('parseCardsFromMarkdown — block cards', () => {
  it('parses a simple block card', () => {
    const md = ['??', 'Multi-line', 'question here', ';;', 'Multi-line', 'answer here', '??'].join(
      '\n',
    );

    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('basic');
    expect(cards[0].front).toBe('Multi-line\nquestion here');
    expect(cards[0].back).toBe('Multi-line\nanswer here');
  });

  it('records the source line of a block card as the opening ?? line', () => {
    const md = ['', '', '??', 'Front', ';;', 'Back', '??'].join('\n');
    const cards = parseCardsFromMarkdown(md);
    expect(cards[0].sourceLine).toBe(2);
  });

  it('does not parse a block card without a ;; separator', () => {
    const md = ['??', 'Front content', '??'].join('\n');
    const cards = parseCardsFromMarkdown(md);
    // No ;; separator = not a valid block card
    expect(cards).toHaveLength(0);
  });

  it('does not parse a block card without a closing ??', () => {
    const md = ['??', 'Front', ';;', 'Back'].join('\n');
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(0);
  });

  it('handles mixed inline and block cards', () => {
    const md = [
      '?? Inline Q :: Inline A',
      '??',
      'Block front',
      ';;',
      'Block back',
      '??',
      '?? Another inline :: answer',
    ].join('\n');

    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(3);
    expect(cards[0].front).toBe('Inline Q');
    expect(cards[1].front).toBe('Block front');
    expect(cards[2].front).toBe('Another inline');
  });
});

// ---------------------------------------------------------------------------
// parseCardsFromMarkdown — cloze cards
// ---------------------------------------------------------------------------

describe('parseCardsFromMarkdown — cloze cards', () => {
  it('detects cloze type for inline card with cloze marker in front', () => {
    // The :: inside {{c1::capital}} must not be treated as the separator
    const md = '?? The {{c1::capital}} of France :: The answer';
    const cards = parseCardsFromMarkdown(md);
    expect(cards[0].type).toBe('cloze');
    expect(cards[0].clozeMarkers).toHaveLength(1);
    expect(cards[0].front).toBe('The {{c1::capital}} of France');
  });

  it('parses standalone cloze line without ?? prefix', () => {
    const md = 'The capital of {{c1::France}} is Paris.';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].type).toBe('cloze');
    expect(cards[0].front).toBe('The capital of {{c1::France}} is Paris.');
    expect(cards[0].back).toBe('The capital of France is Paris.');
  });

  it('parses multiple cloze groups in one line', () => {
    const md = '{{c1::Marie Curie}} won the Nobel Prize in {{c2::Physics}}.';
    const cards = parseCardsFromMarkdown(md);
    expect(cards[0].clozeMarkers).toHaveLength(2);
    expect(cards[0].clozeMarkers[0].groupId).toBe('c1');
    expect(cards[0].clozeMarkers[1].groupId).toBe('c2');
  });

  it('does not parse cloze from non-card prose lines without markers', () => {
    const md = 'This is a regular paragraph without any markers.';
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// extractClozeMarkers
// ---------------------------------------------------------------------------

describe('extractClozeMarkers', () => {
  it('returns an empty array for text without cloze markers', () => {
    expect(extractClozeMarkers('No markers here')).toHaveLength(0);
  });

  it('extracts a single cloze marker', () => {
    const markers = extractClozeMarkers('The {{c1::answer}} is here.');
    expect(markers).toHaveLength(1);
    expect(markers[0].groupId).toBe('c1');
    expect(markers[0].answer).toBe('answer');
    expect(markers[0].raw).toBe('{{c1::answer}}');
  });

  it('extracts multiple cloze markers', () => {
    const markers = extractClozeMarkers('{{c1::A}} and {{c2::B}} and {{c3::C}}');
    expect(markers).toHaveLength(3);
    expect(markers.map((m) => m.groupId)).toEqual(['c1', 'c2', 'c3']);
  });

  it('records correct start and end positions', () => {
    const text = 'The {{c1::France}} is here.';
    const markers = extractClozeMarkers(text);
    const marker = markers[0];
    expect(text.slice(marker.start, marker.end)).toBe('{{c1::France}}');
  });

  it('handles alphanumeric group IDs', () => {
    const markers = extractClozeMarkers('{{c10::answer}}');
    expect(markers[0].groupId).toBe('c10');
  });

  it('handles multi-word answers', () => {
    const markers = extractClozeMarkers('{{c1::Eiffel Tower}}');
    expect(markers[0].answer).toBe('Eiffel Tower');
  });
});

// ---------------------------------------------------------------------------
// revealAllCloze
// ---------------------------------------------------------------------------

describe('revealAllCloze', () => {
  it('replaces a single cloze marker with its answer', () => {
    const result = revealAllCloze('The capital of {{c1::France}} is Paris.');
    expect(result).toBe('The capital of France is Paris.');
  });

  it('replaces multiple cloze markers', () => {
    const result = revealAllCloze('{{c1::Albert Einstein}} developed {{c2::general relativity}}.');
    expect(result).toBe('Albert Einstein developed general relativity.');
  });

  it('returns the original string when no markers are present', () => {
    const text = 'No cloze markers here.';
    expect(revealAllCloze(text)).toBe(text);
  });

  it('handles nested punctuation in answers', () => {
    const result = revealAllCloze('{{c1::H2O}} is water.');
    expect(result).toBe('H2O is water.');
  });
});

// ---------------------------------------------------------------------------
// hideClozeGroup
// ---------------------------------------------------------------------------

describe('hideClozeGroup', () => {
  it('hides the specified group and shows [...] placeholder', () => {
    const result = hideClozeGroup('The capital is {{c1::Paris}}.', 'c1');
    expect(result).toBe('The capital is [...].');
  });

  it('only hides the specified group, leaves others visible', () => {
    const text = '{{c1::Einstein}} developed {{c2::relativity}}.';
    const result = hideClozeGroup(text, 'c1');
    expect(result).toContain('[...]');
    expect(result).toContain('{{c2::relativity}}');
    expect(result).not.toContain('Einstein');
  });

  it('hides multiple occurrences of the same group', () => {
    const text = '{{c1::Paris}} is the capital of France. {{c1::Paris}} is beautiful.';
    const result = hideClozeGroup(text, 'c1');
    expect(result).toBe('[...] is the capital of France. [...] is beautiful.');
  });

  it('returns original text when the group does not exist', () => {
    const text = '{{c1::answer}}';
    expect(hideClozeGroup(text, 'c99')).toBe(text);
  });
});

// ---------------------------------------------------------------------------
// selectionToCard
// ---------------------------------------------------------------------------

describe('selectionToCard', () => {
  it('creates a basic card from plain text selection', () => {
    const card = selectionToCard('What is photosynthesis?');
    expect(card.type).toBe('basic');
    expect(card.front).toBe('What is photosynthesis?');
    expect(card.back).toBe('');
  });

  it('creates a cloze card from selection containing cloze markers', () => {
    const card = selectionToCard('{{c1::Photosynthesis}} converts light into energy.');
    expect(card.type).toBe('cloze');
    expect(card.clozeMarkers).toHaveLength(1);
    expect(card.back).toBe('Photosynthesis converts light into energy.');
  });

  it('trims whitespace from the selection', () => {
    const card = selectionToCard('  trimmed  ');
    expect(card.front).toBe('trimmed');
  });

  it('records the provided source line', () => {
    const card = selectionToCard('Front text', 42);
    expect(card.sourceLine).toBe(42);
  });

  it('defaults source line to 0 when not provided', () => {
    const card = selectionToCard('Front text');
    expect(card.sourceLine).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// serializeInlineCard
// ---------------------------------------------------------------------------

describe('serializeInlineCard', () => {
  it('serializes a card to inline syntax', () => {
    const result = serializeInlineCard('What is France?', 'A country in Europe');
    expect(result).toBe('?? What is France? :: A country in Europe');
  });
});

// ---------------------------------------------------------------------------
// serializeBlockCard
// ---------------------------------------------------------------------------

describe('serializeBlockCard', () => {
  it('serializes a card to block syntax', () => {
    const result = serializeBlockCard('Multi-line\nfront', 'Multi-line\nback');
    expect(result).toBe('??\nMulti-line\nfront\n;;\nMulti-line\nback\n??');
  });

  it('produces output that can be re-parsed to the same card', () => {
    const originalFront = 'What is the boiling point of water?';
    const originalBack = '100°C at standard pressure.';
    const serialized = serializeBlockCard(originalFront, originalBack);
    const reparsed = parseCardsFromMarkdown(serialized);
    expect(reparsed).toHaveLength(1);
    expect(reparsed[0].front).toBe(originalFront);
    expect(reparsed[0].back).toBe(originalBack);
  });
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('edge cases', () => {
  it('returns empty array for empty string', () => {
    expect(parseCardsFromMarkdown('')).toHaveLength(0);
  });

  it('returns empty array for whitespace-only input', () => {
    expect(parseCardsFromMarkdown('   \n\n  ')).toHaveLength(0);
  });

  it('handles a document with only prose (no cards)', () => {
    const md = '# Heading\n\nSome text.\n\nMore text.';
    expect(parseCardsFromMarkdown(md)).toHaveLength(0);
  });

  it('handles cards adjacent to frontmatter', () => {
    const md = ['---', 'title: My Note', '---', '', '?? Q1 :: A1'].join('\n');
    const cards = parseCardsFromMarkdown(md);
    expect(cards).toHaveLength(1);
    expect(cards[0].front).toBe('Q1');
  });
});
