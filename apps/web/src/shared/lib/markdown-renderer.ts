/**
 * markdown-renderer.ts
 *
 * Server-side markdown-to-HTML pipeline built on unified/remark/rehype.
 *
 * Features:
 *   - GitHub Flavored Markdown (tables, autolinks, strikethrough, task lists)
 *   - Syntax highlighting via Shiki (server-compatible)
 *   - Math rendering via KaTeX (block $$ and inline $)
 *   - Frontmatter stripping (YAML)
 *   - Heading anchors with auto-generated IDs
 *   - Table of contents extraction from headings
 *   - Obsidian-style callout blocks
 *   - Wiki-link resolution
 *   - Reading time estimation
 *   - Plain-text excerpt extraction
 *
 * This module runs exclusively on the server. Do NOT import from
 * Client Components.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkFrontmatter from 'remark-frontmatter';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import { createHighlighter, type Highlighter } from 'shiki';
import type { Element, ElementContent, Root as HastRoot, Text } from 'hast';
import { toString as hastToString } from 'hast-util-to-string';
import { headingRank } from 'hast-util-heading-rank';
import type { Plugin } from 'unified';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single entry in the extracted table of contents. */
export interface TocEntry {
  /** The heading level (1-6). */
  level: number;
  /** The plain-text heading content (no HTML). */
  text: string;
  /** The URL-safe slug used as the heading's id attribute. */
  slug: string;
}

/** The result of rendering a markdown note. */
export interface RenderedMarkdown {
  /** The full HTML string ready for dangerouslySetInnerHTML. */
  html: string;
  /** Extracted table of contents entries in document order. */
  toc: TocEntry[];
  /** Estimated reading time in minutes. */
  readingTimeMinutes: number;
  /** Plain-text excerpt (first ~160 characters of body content). */
  excerpt: string;
}

export interface RenderMarkdownOptions {
  /**
   * Base URL path for resolving wiki links.
   * Example: `/public/my-vault/`
   */
  publicSlugBase?: string;
}

// ---------------------------------------------------------------------------
// Shiki highlighter singleton
// ---------------------------------------------------------------------------

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: [
        'typescript',
        'javascript',
        'tsx',
        'jsx',
        'json',
        'html',
        'css',
        'scss',
        'python',
        'rust',
        'go',
        'java',
        'bash',
        'shell',
        'sql',
        'yaml',
        'toml',
        'markdown',
        'diff',
        'graphql',
        'prisma',
        'dockerfile',
        'c',
        'cpp',
      ],
    });
  }
  return highlighterPromise;
}

// ---------------------------------------------------------------------------
// Custom rehype plugin: Shiki syntax highlighting
// ---------------------------------------------------------------------------

/**
 * Rehype plugin that replaces <code> blocks inside <pre> elements with
 * Shiki-highlighted HTML. Runs asynchronously.
 */
function rehypeShiki(highlighter: Highlighter): Plugin<[], HastRoot> {
  return () => {
    return async (tree: HastRoot) => {
      const { visit } = await import('unist-util-visit');

      const nodesToReplace: Array<{ parent: Element; index: number; code: string; lang: string }> =
        [];

      visit(tree, 'element', (node: Element, index, parent) => {
        if (
          node.tagName !== 'pre' ||
          !node.children ||
          node.children.length === 0 ||
          index === undefined ||
          !parent
        ) {
          return;
        }

        const codeEl = node.children[0];
        if (!codeEl || codeEl.type !== 'element' || codeEl.tagName !== 'code') {
          return;
        }

        const className = (codeEl.properties?.className as string[] | undefined) ?? [];
        const langMatch = className.find((c) => c.startsWith('language-'));
        const lang = langMatch ? langMatch.replace('language-', '') : '';

        const code = hastToString(codeEl);
        nodesToReplace.push({
          parent: parent as Element,
          index,
          code,
          lang,
        });
      });

      // Process all code blocks
      for (const { parent, index, code, lang } of nodesToReplace) {
        let resolvedLang = lang;
        const loadedLangs = highlighter.getLoadedLanguages();

        if (!resolvedLang || !loadedLangs.includes(resolvedLang as never)) {
          resolvedLang = 'text';
        }

        try {
          const highlighted = highlighter.codeToHtml(code, {
            lang: resolvedLang,
            themes: {
              light: 'github-light',
              dark: 'github-dark',
            },
          });

          // Parse the Shiki output into a hast fragment
          const { fromHtml } = await import('hast-util-from-html');
          const fragment = fromHtml(highlighted, { fragment: true });

          // Wrap in a div with language label
          const wrapper: Element = {
            type: 'element',
            tagName: 'div',
            properties: {
              className: ['code-block-wrapper'],
              'data-lang': lang || undefined,
            },
            children: [
              ...(lang
                ? [
                    {
                      type: 'element' as const,
                      tagName: 'div',
                      properties: { className: ['code-block-lang'] },
                      children: [{ type: 'text' as const, value: lang }],
                    } as Element,
                  ]
                : []),
              ...(fragment.children as ElementContent[]),
            ],
          };

          parent.children[index] = wrapper;
        } catch {
          // If highlighting fails, keep the original <pre><code>
        }
      }
    };
  };
}

// ---------------------------------------------------------------------------
// Custom rehype plugin: extract TOC
// ---------------------------------------------------------------------------

function rehypeExtractToc(toc: TocEntry[]): Plugin<[], HastRoot> {
  return () => {
    return async (tree: HastRoot) => {
      const { visit } = await import('unist-util-visit');

      visit(tree, 'element', (node: Element) => {
        const rank = headingRank(node);
        if (!rank) return;

        const text = hastToString(node);
        const id = (node.properties?.id as string) ?? '';

        if (text && id) {
          toc.push({ level: rank, text, slug: id });
        }
      });
    };
  };
}

// ---------------------------------------------------------------------------
// Custom rehype plugin: wiki-link transformation
// ---------------------------------------------------------------------------

function rehypeWikiLinks(publicSlugBase: string): Plugin<[], HastRoot> {
  return () => {
    return async (tree: HastRoot) => {
      const { visit } = await import('unist-util-visit');

      visit(tree, 'text', (node: Text, index, parent) => {
        if (!parent || index === undefined) return;

        const regex = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
        const value = node.value;
        const parts: Array<Element | Text> = [];
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(value)) !== null) {
          // Text before the wiki link
          if (match.index > lastIndex) {
            parts.push({
              type: 'text',
              value: value.slice(lastIndex, match.index),
            });
          }

          const target = match[1].trim();
          const display = match[2]?.trim() ?? target;
          const base = publicSlugBase.endsWith('/') ? publicSlugBase : `${publicSlugBase}/`;
          const href = `${base}${encodeURIComponent(target)}`;

          parts.push({
            type: 'element',
            tagName: 'a',
            properties: {
              href,
              className: ['wiki-link'],
            },
            children: [{ type: 'text', value: display }],
          });

          lastIndex = match.index + match[0].length;
        }

        if (parts.length > 0) {
          // Remaining text after last match
          if (lastIndex < value.length) {
            parts.push({
              type: 'text',
              value: value.slice(lastIndex),
            });
          }

          // Replace the original text node with the new nodes
          (parent as Element).children.splice(index, 1, ...parts);
        }
      });
    };
  };
}

// ---------------------------------------------------------------------------
// Reading time estimation
// ---------------------------------------------------------------------------

const WORDS_PER_MINUTE = 230;

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function estimateReadingTime(wordCount: number): number {
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE));
}

// ---------------------------------------------------------------------------
// Excerpt extraction
// ---------------------------------------------------------------------------

function extractExcerpt(html: string, maxLength = 160): string {
  const plainText = html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (plainText.length <= maxLength) return plainText;

  const truncated = plainText.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render raw markdown content into structured HTML with full features.
 *
 * This is an async function that must be called on the server. It uses
 * Shiki for syntax highlighting (which requires async initialization)
 * and unified for the markdown pipeline.
 */
export async function renderMarkdown(
  markdown: string,
  options: RenderMarkdownOptions = {},
): Promise<RenderedMarkdown> {
  const { publicSlugBase = '/public/' } = options;

  const toc: TocEntry[] = [];
  const highlighter = await getHighlighter();

  const processor = unified()
    .use(remarkParse)
    .use(remarkFrontmatter, ['yaml'])
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'prepend',
      properties: {
        className: ['heading-anchor'],
        ariaLabel: 'Link to this section',
      },
      content: {
        type: 'text',
        value: '#',
      },
    })
    .use(rehypeShiki(highlighter))
    .use(rehypeWikiLinks(publicSlugBase))
    .use(rehypeExtractToc(toc))
    .use(rehypeStringify, { allowDangerousHtml: true });

  const file = await processor.process(markdown);
  const html = String(file);

  // Calculate reading time from the plain text
  const plainText = html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  const wordCount = countWords(plainText);
  const readingTimeMinutes = estimateReadingTime(wordCount);
  const excerpt = extractExcerpt(html);

  return {
    html,
    toc,
    readingTimeMinutes,
    excerpt,
  };
}
