// Markdown processing pipeline
// Will contain: unified/remark pipeline, wiki link parser, MD↔HTML conversion
export const MARKDOWN_VERSION = '0.0.0';

/**
 * Render markdown content to HTML.
 *
 * TODO: Implement with unified/remark pipeline. Currently returns a minimal
 * HTML representation wrapping the raw markdown.
 *
 * @param markdown - Raw markdown string
 * @param _options - Rendering options (wiki links, etc.)
 * @returns HTML string
 */
export async function renderToHtml(
  markdown: string,
  _options?: { wikiLinks?: boolean; wikiLinkBase?: string },
): Promise<string> {
  // Stub implementation — escape HTML entities and wrap in <pre>
  const escaped = markdown.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<div class="markdown-body"><pre>${escaped}</pre></div>`;
}
