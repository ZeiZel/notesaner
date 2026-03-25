import {
  WIKI_LINK_REGEX,
  EMBED_REGEX,
  BLOCK_REF_REGEX,
  HEADING_LINK_REGEX,
} from '@notesaner/constants';

export interface ParsedLink {
  target: string;
  displayText?: string;
  type: 'wiki' | 'embed' | 'block_ref' | 'heading';
  heading?: string;
  blockId?: string;
  raw: string;
  position: { start: number; end: number };
}

export function parseWikiLinks(content: string): ParsedLink[] {
  const links: ParsedLink[] = [];

  for (const match of content.matchAll(new RegExp(EMBED_REGEX.source, 'g'))) {
    links.push({
      target: match[1],
      type: 'embed',
      raw: match[0],
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  for (const match of content.matchAll(new RegExp(BLOCK_REF_REGEX.source, 'g'))) {
    links.push({
      target: match[1],
      type: 'block_ref',
      blockId: match[2],
      raw: match[0],
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  for (const match of content.matchAll(new RegExp(HEADING_LINK_REGEX.source, 'g'))) {
    links.push({
      target: match[1],
      type: 'heading',
      heading: match[2],
      displayText: match[3],
      raw: match[0],
      position: { start: match.index!, end: match.index! + match[0].length },
    });
  }

  for (const match of content.matchAll(new RegExp(WIKI_LINK_REGEX.source, 'g'))) {
    const isDuplicate = links.some(
      (l) =>
        l.position.start === match.index! &&
        l.position.end === match.index! + match[0].length,
    );
    if (!isDuplicate) {
      links.push({
        target: match[1],
        displayText: match[2],
        type: 'wiki',
        raw: match[0],
        position: { start: match.index!, end: match.index! + match[0].length },
      });
    }
  }

  return links;
}

export function extractAllLinks(content: string): string[] {
  const links = parseWikiLinks(content);
  return [...new Set(links.map((l) => l.target))];
}
