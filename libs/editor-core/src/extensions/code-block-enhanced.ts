/**
 * CodeBlockEnhanced — TipTap extension for syntax-highlighted code blocks.
 *
 * Wraps `@tiptap/extension-code-block-lowlight` with additional features:
 * - Syntax highlighting via lowlight (highlight.js engine)
 * - Language selector dropdown
 * - Copy-to-clipboard button
 * - Line numbers
 * - Filename/label support
 * - Language auto-detection
 *
 * Features:
 * - InputRule: typing ``` or ```language creates a code block
 * - Custom React NodeView with CodeBlockView component
 * - Plain-text serialisation: preserves fenced code block syntax
 * - Common languages pre-loaded; others loaded on demand
 *
 * Usage:
 * ```ts
 * import { CodeBlockEnhanced } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   CodeBlockEnhanced,
 * ];
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Supported languages
// ---------------------------------------------------------------------------

/**
 * Common languages displayed in the language selector.
 * Additional languages are supported via highlight.js auto-detection.
 */
export const COMMON_LANGUAGES = [
  { value: '', label: 'Plain text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'jsx', label: 'JSX' },
  { value: 'tsx', label: 'TSX' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'python', label: 'Python' },
  { value: 'rust', label: 'Rust' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'kotlin', label: 'Kotlin' },
  { value: 'swift', label: 'Swift' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'shell', label: 'Shell' },
  { value: 'bash', label: 'Bash' },
  { value: 'sql', label: 'SQL' },
  { value: 'yaml', label: 'YAML' },
  { value: 'toml', label: 'TOML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'xml', label: 'XML' },
] as const;

/** Language alias mappings for common abbreviations. */
export const LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'shell',
  zsh: 'bash',
  yml: 'yaml',
  'c++': 'cpp',
  'c#': 'csharp',
  cs: 'csharp',
  kt: 'kotlin',
  rs: 'rust',
  gql: 'graphql',
  md: 'markdown',
  tex: 'latex',
};

/**
 * Resolve a language string (possibly an alias or abbreviated form) to a
 * normalised language identifier. Returns empty string for unknown/plain text.
 */
export function resolveLanguage(lang: string): string {
  if (!lang) return '';
  const normalised = lang.trim().toLowerCase();
  return LANGUAGE_ALIASES[normalised] ?? normalised;
}

// ---------------------------------------------------------------------------
// Attribute interface
// ---------------------------------------------------------------------------

export interface CodeBlockEnhancedAttrs {
  /** Language identifier (e.g. 'javascript', 'python'). Empty for plain text. */
  language: string;
  /** Optional filename or label shown in the code block header. */
  filename: string | null;
  /** Whether line numbers are displayed. */
  showLineNumbers: boolean;
}

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface CodeBlockEnhancedOptions {
  /**
   * HTML attributes merged onto the outer container in static HTML output.
   */
  HTMLAttributes: Record<string, string>;

  /**
   * Default language for new code blocks. Defaults to '' (plain text).
   */
  defaultLanguage: string;

  /**
   * Whether to show line numbers by default. Defaults to true.
   */
  showLineNumbers: boolean;
}

// ---------------------------------------------------------------------------
// TipTap commands
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    codeBlockEnhanced: {
      /**
       * Insert an enhanced code block at the current cursor position.
       */
      insertCodeBlock: (options?: {
        language?: string;
        content?: string;
        filename?: string;
      }) => ReturnType;

      /**
       * Toggle line numbers on the code block at the current selection.
       */
      toggleCodeBlockLineNumbers: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches fenced code block opening: ```language or just ```
 *
 * Captures:
 *   1: optional language identifier
 */
export const CODE_BLOCK_INPUT_REGEX = /^```([a-zA-Z0-9+#._-]*)\s*$/;

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const CodeBlockEnhanced = Node.create<CodeBlockEnhancedOptions>({
  name: 'codeBlock',

  // Block node with text content only (no inline formatting inside code blocks)
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,
  defining: true,
  isolating: true,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      HTMLAttributes: {},
      defaultLanguage: '',
      showLineNumbers: true,
    };
  },

  // -------------------------------------------------------------------------
  // Attributes
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      language: {
        default: this.options.defaultLanguage,
        parseHTML: (el) => {
          // Parse from class="language-xxx" on <code> children
          const codeEl = el.querySelector('code');
          if (codeEl) {
            const classMatch = /language-(\S+)/.exec(codeEl.className);
            if (classMatch?.[1]) return resolveLanguage(classMatch[1]);
          }
          return el.getAttribute('data-language') ?? this.options.defaultLanguage;
        },
        renderHTML: (attrs) => ({
          'data-language': attrs['language'] as string,
        }),
      },
      filename: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-filename') ?? null,
        renderHTML: (attrs) => {
          if (!attrs['filename']) return {};
          return { 'data-filename': attrs['filename'] as string };
        },
      },
      showLineNumbers: {
        default: this.options.showLineNumbers,
        parseHTML: (el) => el.getAttribute('data-line-numbers') !== 'false',
        renderHTML: (attrs) => ({
          'data-line-numbers': String(attrs['showLineNumbers']),
        }),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse / render
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: 'pre' }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as CodeBlockEnhancedAttrs;
    const language = attrs.language;

    return [
      'pre',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-language': language,
        ...(attrs.filename ? { 'data-filename': attrs.filename } : {}),
        'data-line-numbers': String(attrs.showLineNumbers),
        class: 'ns-code-block',
      }),
      [
        'code',
        {
          class: language ? `language-${language}` : undefined,
        },
        0,
      ],
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation — preserves fenced code block syntax
  // -------------------------------------------------------------------------

  renderText({ node }) {
    const attrs = node.attrs as CodeBlockEnhancedAttrs;
    const lang = attrs.language || '';
    const code = node.textContent;
    return `\`\`\`${lang}\n${code}\n\`\`\``;
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require to avoid circular dependency at module load time.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { CodeBlockView } = require('../components/CodeBlockView') as {
      CodeBlockView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(CodeBlockView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertCodeBlock:
        (options = {}) =>
        ({ commands }) => {
          const language = resolveLanguage(options.language ?? this.options.defaultLanguage);

          return commands.insertContent({
            type: this.name,
            attrs: {
              language,
              filename: options.filename ?? null,
              showLineNumbers: this.options.showLineNumbers,
            },
            content: options.content ? [{ type: 'text', text: options.content }] : [],
          });
        },

      toggleCodeBlockLineNumbers:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const { selection } = state;
          const $pos = selection.$from;

          for (let depth = $pos.depth; depth >= 0; depth--) {
            const node = $pos.node(depth);
            if (node.type.name === 'codeBlock') {
              const pos = $pos.before(depth);
              const { tr } = state;
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                showLineNumbers: !node.attrs['showLineNumbers'],
              });
              dispatch(tr);
              return true;
            }
          }

          return false;
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      textblockTypeInputRule({
        find: CODE_BLOCK_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => ({
          language: resolveLanguage(match[1] ?? ''),
        }),
      }),
    ];
  },

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  addKeyboardShortcuts() {
    return {
      // Tab inserts spaces inside code blocks
      Tab: ({ editor }) => {
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const $pos = selection.$from;

        // Only handle when inside a code block
        for (let depth = $pos.depth; depth >= 0; depth--) {
          if ($pos.node(depth).type.name === 'codeBlock') {
            if (dispatch) {
              const { tr } = state;
              tr.insertText('  ', selection.from, selection.to);
              dispatch(tr);
            }
            return true;
          }
        }
        return false;
      },

      // Shift-Tab dedents inside code blocks
      'Shift-Tab': ({ editor }) => {
        const { state, dispatch } = editor.view;
        const { selection } = state;
        const $pos = selection.$from;

        for (let depth = $pos.depth; depth >= 0; depth--) {
          if ($pos.node(depth).type.name === 'codeBlock') {
            if (dispatch) {
              // Find the start of the current line
              const lineStart = state.doc.resolve(selection.from);
              const textBefore = lineStart.parent.textContent.substring(0, lineStart.parentOffset);
              const lastNewline = textBefore.lastIndexOf('\n');
              const lineStartOffset = lastNewline + 1;
              const lineText = lineStart.parent.textContent.substring(lineStartOffset);

              // Remove up to 2 leading spaces
              const spacesToRemove = lineText.startsWith('  ')
                ? 2
                : lineText.startsWith(' ')
                  ? 1
                  : 0;

              if (spacesToRemove > 0) {
                const absLineStart = lineStart.start(lineStart.depth) + lineStartOffset;
                const { tr } = state;
                tr.delete(absLineStart, absLineStart + spacesToRemove);
                dispatch(tr);
              }
            }
            return true;
          }
        }
        return false;
      },

      // Mod+A selects all inside the code block first, then whole doc
      'Mod-a': ({ editor }) => {
        const { state } = editor.view;
        const { selection } = state;
        const $pos = selection.$from;

        for (let depth = $pos.depth; depth >= 0; depth--) {
          const node = $pos.node(depth);
          if (node.type.name === 'codeBlock') {
            const start = $pos.start(depth);
            const end = $pos.end(depth);
            // If already selecting all code, let default Mod-A run
            if (selection.from === start && selection.to === end) {
              return false;
            }
            editor.commands.setTextSelection({ from: start, to: end });
            return true;
          }
        }
        return false;
      },
    };
  },
});
