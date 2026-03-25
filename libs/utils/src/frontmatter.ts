import { FRONTMATTER_DELIMITER } from '@notesaner/constants';

export interface FrontmatterResult {
  data: Record<string, unknown>;
  content: string;
  raw: string;
}

export function parseFrontmatter(text: string): FrontmatterResult {
  const trimmed = text.trimStart();

  if (!trimmed.startsWith(FRONTMATTER_DELIMITER)) {
    return { data: {}, content: text, raw: '' };
  }

  const endIndex = trimmed.indexOf(
    `\n${FRONTMATTER_DELIMITER}`,
    FRONTMATTER_DELIMITER.length,
  );

  if (endIndex === -1) {
    return { data: {}, content: text, raw: '' };
  }

  const raw = trimmed.slice(
    FRONTMATTER_DELIMITER.length + 1,
    endIndex,
  );

  const content = trimmed.slice(
    endIndex + FRONTMATTER_DELIMITER.length + 2,
  );

  const data: Record<string, unknown> = {};
  for (const line of raw.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      data[key] = value;
    }
  }

  return { data, content, raw };
}

export function stringifyFrontmatter(
  data: Record<string, unknown>,
  content: string,
): string {
  const entries = Object.entries(data);
  if (entries.length === 0) return content;

  const yaml = entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join('\n');

  return `${FRONTMATTER_DELIMITER}\n${yaml}\n${FRONTMATTER_DELIMITER}\n${content}`;
}
