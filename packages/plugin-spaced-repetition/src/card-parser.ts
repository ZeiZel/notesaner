/**
 * Flashcard syntax parser.
 *
 * Supported syntaxes:
 *
 * 1. Inline card:
 *    `?? front :: back`
 *    Single-line front/back separated by `::`
 *
 * 2. Block card:
 *    ```
 *    ??
 *    Multi-line front content
 *    ;;
 *    Multi-line back content
 *    ??
 *    ```
 *    Delimited by `??` lines, front and back separated by `;;`
 *
 * 3. Cloze deletion:
 *    `This is {{c1::hidden text}} in a sentence.`
 *    Multiple cloze markers with different group IDs are supported.
 *
 * 4. Selection-to-card:
 *    Convert arbitrary text selection into a card via `selectionToCard`.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The type of flashcard. */
export type CardType = 'basic' | 'cloze';

/** A cloze marker extracted from card content. */
export interface ClozeMarker {
  /** The cloze group ID (e.g. "c1", "c2"). */
  groupId: string;
  /** The hidden answer text. */
  answer: string;
  /** The full original marker string, e.g. `{{c1::hidden text}}`. */
  raw: string;
  /** Character offset of the start of the marker in the original text. */
  start: number;
  /** Character offset of the end of the marker in the original text. */
  end: number;
}

/** A parsed raw card before assignment to a deck. */
export interface ParsedCard {
  /** Discriminated type. */
  type: CardType;
  /** Front side of the card (question / cloze sentence). */
  front: string;
  /**
   * Back side of the card (answer).
   * For cloze cards, this is the full sentence with cloze markers visible.
   */
  back: string;
  /**
   * For cloze cards, the extracted cloze markers.
   * Empty for basic cards.
   */
  clozeMarkers: ClozeMarker[];
  /**
   * Zero-based line index (in the source markdown) where this card starts.
   * Used to correlate cards back to the source note.
   */
  sourceLine: number;
}

// ---------------------------------------------------------------------------
// Regex patterns
// ---------------------------------------------------------------------------

/**
 * Matches inline card syntax: `?? front :: back`
 *
 * We do NOT use a simple regex here because `::` can also appear inside
 * cloze markers (`{{c1::answer}}`). Instead, inline cards are parsed
 * by finding the LAST `::` occurrence that is NOT inside a `{{...}}` block.
 *
 * The constant below is used only to detect the `??` prefix.
 */
const INLINE_CARD_PREFIX = /^\?\?\s+/;

/**
 * Matches the opening/closing delimiter of a block card: a line containing
 * only `??` (optionally with surrounding whitespace).
 */
const BLOCK_DELIMITER_PATTERN = /^\s*\?\?\s*$/;

/**
 * Matches the block card separator between front and back: a line containing
 * only `;;` (optionally with surrounding whitespace).
 */
const BLOCK_SEPARATOR_PATTERN = /^\s*;;\s*$/;

/**
 * Matches a cloze marker: `{{groupId::answer}}`
 * Capture groups: [1] = groupId, [2] = answer
 */
const CLOZE_PATTERN = /\{\{([a-zA-Z0-9]+)::([^}]+?)\}\}/g;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses all flashcards from a markdown string.
 *
 * Processes the document in a single pass:
 * 1. Detects block cards (multi-line `?? ... ;; ... ??` blocks)
 * 2. Detects inline cards (`?? front :: back`)
 * 3. Detects cloze cards (any line containing `{{cN::...}}`)
 *
 * @param markdown - The full markdown text to parse.
 * @returns Array of parsed cards in document order.
 */
export function parseCardsFromMarkdown(markdown: string): ParsedCard[] {
  const lines = markdown.split('\n');
  const cards: ParsedCard[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Check for block card start
    if (BLOCK_DELIMITER_PATTERN.test(line)) {
      const blockResult = tryParseBlockCard(lines, i);
      if (blockResult !== null) {
        cards.push(blockResult.card);
        i = blockResult.nextLine;
        continue;
      }
    }

    // Check for inline card (`?? front :: back`)
    if (INLINE_CARD_PREFIX.test(line)) {
      const withoutPrefix = line.replace(INLINE_CARD_PREFIX, '');
      const separatorIdx = findInlineSeparator(withoutPrefix);
      if (separatorIdx !== -1) {
        const front = withoutPrefix.slice(0, separatorIdx).trim();
        const back = withoutPrefix.slice(separatorIdx + 2).trim();
        if (front && back) {
          const clozeMarkers = extractClozeMarkers(front);
          cards.push({
            type: clozeMarkers.length > 0 ? 'cloze' : 'basic',
            front,
            back,
            clozeMarkers,
            sourceLine: i,
          });
          i++;
          continue;
        }
      }
    }

    // Check for standalone cloze (line with cloze markers but no ?? prefix)
    const clozeMarkers = extractClozeMarkers(line);
    if (clozeMarkers.length > 0 && !line.startsWith('??')) {
      cards.push({
        type: 'cloze',
        front: line.trim(),
        back: revealAllCloze(line.trim()),
        clozeMarkers,
        sourceLine: i,
      });
    }

    i++;
  }

  return cards;
}

/**
 * Attempts to parse a block card starting at the given line index.
 *
 * A block card looks like:
 * ```
 * ??
 * Front content line 1
 * Front content line 2
 * ;;
 * Back content line 1
 * ??
 * ```
 *
 * Returns null if the lines starting at `startLine` do not form a valid
 * block card.
 */
function tryParseBlockCard(
  lines: string[],
  startLine: number,
): { card: ParsedCard; nextLine: number } | null {
  // Find the closing `??` delimiter
  let separatorLine = -1;
  let closingLine = -1;

  for (let j = startLine + 1; j < lines.length; j++) {
    if (BLOCK_SEPARATOR_PATTERN.test(lines[j])) {
      if (separatorLine === -1) {
        separatorLine = j;
      }
    } else if (BLOCK_DELIMITER_PATTERN.test(lines[j])) {
      closingLine = j;
      break;
    }
  }

  // Valid block card requires both a separator and a closing delimiter
  if (separatorLine === -1 || closingLine === -1) return null;
  if (separatorLine >= closingLine) return null;

  const frontLines = lines.slice(startLine + 1, separatorLine);
  const backLines = lines.slice(separatorLine + 1, closingLine);

  const front = frontLines.join('\n').trim();
  const back = backLines.join('\n').trim();

  if (!front || !back) return null;

  const clozeMarkers = extractClozeMarkers(front);

  return {
    card: {
      type: clozeMarkers.length > 0 ? 'cloze' : 'basic',
      front,
      back,
      clozeMarkers,
      sourceLine: startLine,
    },
    nextLine: closingLine + 1,
  };
}

/**
 * Extracts all cloze markers from a text string.
 *
 * @param text - The text to search for cloze markers.
 * @returns Array of ClozeMarker objects, in order of appearance.
 */
export function extractClozeMarkers(text: string): ClozeMarker[] {
  const markers: ClozeMarker[] = [];
  const pattern = new RegExp(CLOZE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    markers.push({
      groupId: match[1],
      answer: match[2],
      raw: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  return markers;
}

/**
 * Returns the text with all cloze markers replaced by their answers.
 * Used as the "back" of a cloze card.
 *
 * Example: `"The capital of {{c1::France}} is Paris."` → `"The capital of France is Paris."`
 */
export function revealAllCloze(text: string): string {
  return text.replace(CLOZE_PATTERN, (_match, _groupId, answer) => answer);
}

/**
 * Returns the text with a specific cloze group's markers hidden (shown as
 * `[...]`), while other groups are revealed. Used to generate the "front"
 * of a cloze card during review.
 *
 * @param text - The original cloze text.
 * @param groupId - The group whose answer should be hidden.
 */
export function hideClozeGroup(text: string, groupId: string): string {
  const pattern = new RegExp(`\\{\\{${escapeRegex(groupId)}::([^}]+?)\\}\\}`, 'g');
  return text.replace(pattern, '[...]');
}

/**
 * Converts a plain-text selection into a basic flashcard.
 *
 * The selection is trimmed and treated as the front of the card.
 * The back is left empty — the user is expected to fill it in via CardEditor.
 *
 * @param selectedText - The selected text to convert.
 * @param sourceLine   - Optional source line for tracking.
 * @returns A ParsedCard with the selection as the front.
 */
export function selectionToCard(selectedText: string, sourceLine = 0): ParsedCard {
  const front = selectedText.trim();
  const clozeMarkers = extractClozeMarkers(front);

  return {
    type: clozeMarkers.length > 0 ? 'cloze' : 'basic',
    front,
    back: clozeMarkers.length > 0 ? revealAllCloze(front) : '',
    clozeMarkers,
    sourceLine,
  };
}

/**
 * Serialises a basic card back to inline syntax.
 *
 * @param front - Front side text.
 * @param back  - Back side text.
 * @returns String in `?? front :: back` format.
 */
export function serializeInlineCard(front: string, back: string): string {
  return `?? ${front} :: ${back}`;
}

/**
 * Serialises a card to block syntax.
 *
 * @param front - Front side text (may be multi-line).
 * @param back  - Back side text (may be multi-line).
 * @returns String in block format.
 */
export function serializeBlockCard(front: string, back: string): string {
  return `??\n${front}\n;;\n${back}\n??`;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Finds the index of the `::` separator in an inline card's body text,
 * skipping any `::` that appears inside a `{{...}}` cloze block.
 *
 * Returns -1 if no valid separator is found.
 *
 * Strategy: scan for `::` occurrences left-to-right; skip any that have an
 * unclosed `{{` before them (i.e., we are inside a cloze marker).
 */
function findInlineSeparator(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length - 1; i++) {
    if (text[i] === '{' && text[i + 1] === '{') {
      depth++;
      i++; // skip the second {
      continue;
    }
    if (text[i] === '}' && text[i + 1] === '}') {
      if (depth > 0) depth--;
      i++; // skip the second }
      continue;
    }
    if (depth === 0 && text[i] === ':' && text[i + 1] === ':') {
      return i;
    }
  }
  return -1;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
