/**
 * NoteEmbed — TipTap extension for Obsidian-style ![[Note Title]] transclusion.
 *
 * Distinguishes two embed types at parse time:
 *   ![[image.png]]   → image embed (src rendered as <img>)
 *   ![[Note Title]]  → note embed (inline preview of the target note)
 *
 * Key design decisions:
 * - Block-level atom node so embeds sit on their own line (consistent with
 *   Obsidian behaviour). Inline embeds are intentionally not supported.
 * - Circular embed detection: the extension accepts an `ancestorStack` prop
 *   on the React NodeView so the host can pass in the chain of note IDs
 *   currently being rendered and the view can short-circuit if the target is
 *   already in the chain.
 * - Nested embeds are prevented at the React NodeView level: when `depth >= 1`
 *   the NodeView renders a simple clickable reference instead of a full
 *   preview (max-depth = 1 level).
 * - Lazy loading: content is not fetched until the NodeView becomes visible
 *   via an IntersectionObserver.
 * - Missing note fallback: when `loadContent` returns `null` / rejects, the
 *   NodeView renders a styled placeholder.
 *
 * Attributes stored in the ProseMirror node:
 *   - target      (string)  — note title / path OR image filename
 *   - embedType   ('note' | 'image')  — resolved at input-rule time
 *   - alt         (string)  — alt text for image embeds
 *   - resolved    (boolean | null) — set by the host via updateAttributes
 *
 * Usage:
 * ```ts
 * import { NoteEmbed } from '@notesaner/editor-core';
 *
 * NoteEmbed.configure({
 *   isImagePath: (target) => /\.(png|jpe?g|gif|webp|svg)$/i.test(target),
 *   loadContent: async (target, signal) => {
 *     const res = await fetch(`/api/notes/embed/${encodeURIComponent(target)}`, { signal });
 *     if (!res.ok) return null;
 *     return res.json(); // { id, title, content, wordCount }
 *   },
 *   onNavigate: (target) => router.push(`/notes/${encodeURIComponent(target)}`),
 *   resolveImageSrc: (target) => `/api/files/${encodeURIComponent(target)}`,
 * }),
 * ```
 */

import type React from 'react';
import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import { ReactNodeViewRenderer, type ReactNodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Type of content embedded by the ![[...]] syntax. */
export type NoteEmbedType = 'note' | 'image';

/** Attributes persisted in the ProseMirror node. */
export interface NoteEmbedAttrs {
  /** Note title, path, or image filename. */
  target: string;
  /**
   * Discriminator resolved at input-rule time:
   * - 'image' when `isImagePath(target)` returns true
   * - 'note' otherwise
   */
  embedType: NoteEmbedType;
  /** Alt text for image embeds. Falls back to `target` when absent. */
  alt: string | null;
  /**
   * Whether the target note / image exists.
   * null = unknown / still loading
   * true = found
   * false = not found (broken)
   *
   * Set by the host application; never parsed from HTML to avoid stale state.
   */
  resolved: boolean | null;
}

/** Data returned by `loadContent` for note embeds. */
export interface NoteEmbedContent {
  /** Stable note ID (used for circular reference detection). */
  id: string;
  /** Note title, shown as the embed header. */
  title: string;
  /** Full Markdown or plain-text content of the note. */
  content: string;
  /** Approximate word count, shown in the embed footer. */
  wordCount: number;
}

/** Options passed to NoteEmbed.configure(). */
export interface NoteEmbedOptions {
  /**
   * Predicate that decides whether a ![[...]] target is an image path.
   * By default, targets whose file extension is one of
   * `.png .jpg .jpeg .gif .webp .svg .bmp .tiff` are treated as images.
   */
  isImagePath?: (target: string) => boolean;

  /**
   * Async loader that fetches the embedded note's content.
   * Return `null` to indicate the note does not exist (renders placeholder).
   * The host is responsible for cancelling the fetch when `signal` fires.
   */
  loadContent?: (target: string, signal: AbortSignal) => Promise<NoteEmbedContent | null>;

  /**
   * Called when the user clicks on a note embed to navigate to the source.
   * Not called for image embeds.
   */
  onNavigate?: (target: string) => void;

  /**
   * Resolves the full URL for an image embed target.
   * If not provided, the target string is used as-is (works for absolute URLs).
   */
  resolveImageSrc?: (target: string) => string;

  /**
   * HTML attributes merged onto every embed element in non-React output
   * (SSR, generateHTML, copy-paste).
   */
  HTMLAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Default image path predicate
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS_RE = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?)$/i;

function defaultIsImagePath(target: string): boolean {
  return IMAGE_EXTENSIONS_RE.test(target);
}

// ---------------------------------------------------------------------------
// Serialisation helper
// ---------------------------------------------------------------------------

/**
 * Produce the ![[...]] markdown representation of a note-embed node's attrs.
 * Used in `renderText` for plain-text / markdown export.
 */
export function serializeNoteEmbed(target: string): string {
  return `![[${target}]]`;
}

// ---------------------------------------------------------------------------
// Input rule regex
// ---------------------------------------------------------------------------

/**
 * Matches ![[...]] syntax at the end of the current input.
 * Capture group 1 = the raw target (note title or image path).
 *
 * The pattern is intentionally strict:
 * - Leading `!` distinguishes it from [[wiki link]] nodes.
 * - No nested brackets inside the content.
 */
export const NOTE_EMBED_INPUT_REGEX = /!\[\[([^\]]+)\]\]$/;

// ---------------------------------------------------------------------------
// TipTap command declarations
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    noteEmbed: {
      /**
       * Insert a note or image embed at the current cursor position.
       *
       * @param target    - Note title / image path to embed.
       * @param embedType - 'note' or 'image'. If omitted, defaults to
       *                    the result of `isImagePath(target)`.
       * @param alt       - Alt text (image embeds only).
       */
      insertNoteEmbed: (options: {
        target: string;
        embedType?: NoteEmbedType;
        alt?: string;
      }) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

export const NoteEmbed = Node.create<NoteEmbedOptions>({
  name: 'noteEmbed',

  // Block-level atom — renders as a standalone block (like a paragraph).
  // Using 'block' keeps it consistent with Obsidian's rendering model where
  // embeds occupy their own line.
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: false,

  // -------------------------------------------------------------------------
  // Default options
  // -------------------------------------------------------------------------

  addOptions() {
    return {
      isImagePath: defaultIsImagePath,
      loadContent: undefined,
      onNavigate: undefined,
      resolveImageSrc: undefined,
      HTMLAttributes: {},
    };
  },

  // -------------------------------------------------------------------------
  // Attributes persisted in the document
  // -------------------------------------------------------------------------

  addAttributes() {
    return {
      target: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-embed-target') ?? '',
      },
      embedType: {
        default: 'note' as NoteEmbedType,
        parseHTML: (el) => (el.getAttribute('data-embed-type') as NoteEmbedType) ?? 'note',
      },
      alt: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-embed-alt') ?? null,
      },
      // `resolved` is runtime-only — never read from HTML to avoid stale state.
      resolved: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
    };
  },

  // -------------------------------------------------------------------------
  // HTML parse rules
  // -------------------------------------------------------------------------

  parseHTML() {
    return [{ tag: '[data-note-embed]' }];
  },

  // -------------------------------------------------------------------------
  // HTML render (used for SSR, generateHTML, copy-paste — not React NodeView)
  // -------------------------------------------------------------------------

  renderHTML({ node, HTMLAttributes }) {
    const attrs = node.attrs as NoteEmbedAttrs;
    const { target, embedType, alt } = attrs;

    const containerAttrs = mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes, {
      'data-note-embed': '',
      'data-embed-target': target,
      'data-embed-type': embedType,
      ...(alt ? { 'data-embed-alt': alt } : {}),
      class: `ns-note-embed ns-note-embed--${embedType}`,
    });

    if (embedType === 'image') {
      const src = this.options.resolveImageSrc?.(target) ?? target;
      return [
        'figure',
        containerAttrs,
        [
          'img',
          {
            src,
            alt: alt ?? target,
            loading: 'lazy',
            draggable: 'false',
            class: 'ns-note-embed__image',
          },
        ],
      ];
    }

    // Note embed — render a simple anchor for non-React contexts
    return [
      'div',
      containerAttrs,
      [
        'a',
        {
          href: `#embed:${target}`,
          class: 'ns-note-embed__link',
        },
        `![[${target}]]`,
      ],
    ];
  },

  // -------------------------------------------------------------------------
  // Plain-text serialisation (markdown export)
  // -------------------------------------------------------------------------

  renderText({ node }) {
    return serializeNoteEmbed((node.attrs as NoteEmbedAttrs).target);
  },

  // -------------------------------------------------------------------------
  // React NodeView
  // -------------------------------------------------------------------------

  addNodeView() {
    // Lazy require keeps extension file importable in server-side / headless
    // contexts where React is not initialised.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NoteEmbedView } = require('../components/NoteEmbedView') as {
      NoteEmbedView: React.ComponentType<ReactNodeViewProps>;
    };
    return ReactNodeViewRenderer(NoteEmbedView);
  },

  // -------------------------------------------------------------------------
  // Commands
  // -------------------------------------------------------------------------

  addCommands() {
    return {
      insertNoteEmbed:
        ({ target, embedType, alt }) =>
        ({ commands }) => {
          if (!target.trim()) return false;

          const resolvedType: NoteEmbedType =
            embedType ??
            ((this.options.isImagePath ?? defaultIsImagePath)(target) ? 'image' : 'note');

          return commands.insertContent({
            type: this.name,
            attrs: {
              target: target.trim(),
              embedType: resolvedType,
              alt: alt?.trim() ?? null,
              resolved: null,
            } satisfies NoteEmbedAttrs,
          });
        },
    };
  },

  // -------------------------------------------------------------------------
  // Input rules — detect ![[...]] as the user types
  // -------------------------------------------------------------------------

  addInputRules() {
    return [
      new InputRule({
        find: NOTE_EMBED_INPUT_REGEX,
        handler: ({ state, range, match }) => {
          const rawTarget = match[1];
          if (!rawTarget?.trim()) return;

          const target = rawTarget.trim();
          const isImagePath = this.options.isImagePath ?? defaultIsImagePath;
          const embedType: NoteEmbedType = isImagePath(target) ? 'image' : 'note';

          const attrs: NoteEmbedAttrs = {
            target,
            embedType,
            alt: embedType === 'image' ? target : null,
            resolved: null,
          };

          const { tr } = state;
          tr.replaceWith(range.from, range.to, this.type.create(attrs));
        },
      }),
    ];
  },
});
