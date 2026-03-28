/**
 * HeadingFold — TipTap extension for folding/collapsing content under headings.
 *
 * When enabled, each heading node in the editor receives a fold toggle button.
 * Clicking the button collapses (hides) all content between that heading and
 * the next heading of the same or higher level (i.e. lower heading number).
 *
 * Key design decisions:
 *   - Fold state is stored as ProseMirror Decorations, NOT in the document.
 *     This means fold state is ephemeral and does not pollute the document
 *     schema, serialization, or collaboration sync.
 *   - Each heading is identified by its document position for fold tracking.
 *     Positions are recalculated on every document change to stay in sync.
 *   - The fold toggle is rendered as a widget decoration placed before the
 *     heading node. The CSS class `ns-heading-fold--collapsed` is applied
 *     to folded content blocks via inline decorations.
 *   - Content between a folded heading and its boundary is hidden using
 *     `display: none` decorations, which preserves the content in the
 *     document but hides it visually.
 *
 * Architecture:
 *   A ProseMirror plugin manages the fold state set and creates decorations.
 *   The extension registers a command `toggleHeadingFold` and a keyboard
 *   shortcut (Ctrl/Cmd+Shift+F) to fold/unfold the heading at the cursor.
 *
 * CSS classes (target with your global stylesheet):
 *   .ns-heading-fold-toggle          — the fold/unfold button
 *   .ns-heading-fold-toggle--folded  — when the heading is folded
 *   .ns-heading-fold-content--hidden — applied to hidden content blocks
 *
 * Usage:
 * ```ts
 * import { HeadingFold } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   HeadingFold.configure({ persistKey: 'my-note-id' }),
 * ];
 *
 * // Toggle fold programmatically:
 * editor.commands.toggleHeadingFold(pos);
 *
 * // Fold all headings:
 * editor.commands.foldAllHeadings();
 *
 * // Unfold all headings:
 * editor.commands.unfoldAllHeadings();
 * ```
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorState, Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { Node as PmNode } from '@tiptap/pm/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options accepted by HeadingFold.configure(). */
export interface HeadingFoldOptions {
  /**
   * Optional persistence key. When provided, fold state is stored in
   * sessionStorage under this key so folds survive soft page navigations.
   * Set to null to disable persistence (default).
   */
  persistKey?: string | null;

  /**
   * CSS class applied to the fold toggle button element.
   * Defaults to 'ns-heading-fold-toggle'.
   */
  toggleClass?: string;

  /**
   * CSS class applied to content blocks hidden by a fold.
   * Defaults to 'ns-heading-fold-content--hidden'.
   */
  hiddenClass?: string;
}

/** Internal plugin state. */
export interface HeadingFoldPluginState {
  /**
   * Set of document positions where headings are folded.
   * Positions are recalculated on each transaction via position mapping.
   */
  foldedPositions: Set<number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const HEADING_FOLD_PLUGIN_KEY = new PluginKey<HeadingFoldPluginState>('headingFold');

const DEFAULT_TOGGLE_CLASS = 'ns-heading-fold-toggle';
const DEFAULT_HIDDEN_CLASS = 'ns-heading-fold-content--hidden';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Describes a heading found during document traversal.
 */
export interface HeadingInfo {
  /** Position of the heading node in the document. */
  pos: number;
  /** The heading level (1-6). */
  level: number;
  /** Size of the heading node in the document. */
  nodeSize: number;
}

/**
 * Collect all top-level heading positions and their levels from a document.
 * Only considers direct children of the document root (depth 1).
 */
export function collectHeadings(doc: PmNode): HeadingInfo[] {
  const headings: HeadingInfo[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name === 'heading') {
      headings.push({
        pos: offset,
        level: (node.attrs['level'] as number) ?? 1,
        nodeSize: node.nodeSize,
      });
    }
  });
  return headings;
}

/**
 * Given a heading at a specific position and level, determine the range of
 * content that should be hidden when the heading is folded.
 *
 * The range starts immediately after the heading node and ends just before
 * the next heading of the same or higher level (lower number), or at the
 * end of the document.
 *
 * @returns `{ from, to }` positions of the content to hide, or null if
 *          there is no content to fold (heading is at the end of the document).
 */
export function computeFoldRange(
  doc: PmNode,
  headingPos: number,
  headingLevel: number,
): { from: number; to: number } | null {
  let headingNodeSize = 0;
  let found = false;

  // Find the heading node at the given position to get its size.
  doc.forEach((node, offset) => {
    if (offset === headingPos && node.type.name === 'heading') {
      headingNodeSize = node.nodeSize;
      found = true;
    }
  });

  if (!found) return null;

  const rangeFrom = headingPos + headingNodeSize;

  // If the heading is at the very end, nothing to fold.
  if (rangeFrom >= doc.content.size) return null;

  // Walk through subsequent blocks to find the fold boundary.
  let rangeTo = doc.content.size;

  doc.forEach((node, offset) => {
    // Only consider blocks after the heading.
    if (offset <= headingPos) return;

    // Stop at the first heading of same or higher level.
    if (node.type.name === 'heading') {
      const level = (node.attrs['level'] as number) ?? 1;
      if (level <= headingLevel && offset < rangeTo) {
        rangeTo = offset;
      }
    }
  });

  // No content between heading and boundary.
  if (rangeFrom >= rangeTo) return null;

  return { from: rangeFrom, to: rangeTo };
}

/**
 * Map a set of folded positions through a transaction to keep them in sync
 * with document changes. Positions that are deleted by the transaction are
 * removed from the set.
 */
export function mapFoldedPositions(foldedPositions: Set<number>, tr: Transaction): Set<number> {
  if (!tr.docChanged) return foldedPositions;

  const mapped = new Set<number>();

  for (const pos of foldedPositions) {
    const newPos = tr.mapping.map(pos, 1);
    // Verify the mapped position still points to a heading.
    const $pos = tr.doc.resolve(newPos);
    // Only keep if we can still resolve to a heading at depth 1.
    if ($pos.depth === 0 && newPos < tr.doc.content.size) {
      const node = tr.doc.nodeAt(newPos);
      if (node?.type.name === 'heading') {
        mapped.add(newPos);
      }
    }
  }

  return mapped;
}

/**
 * Serialize fold state to a JSON-safe array.
 * Used for sessionStorage persistence.
 */
export function serializeFoldState(foldedPositions: Set<number>): number[] {
  return Array.from(foldedPositions).sort((a, b) => a - b);
}

/**
 * Deserialize fold state from a JSON-safe array.
 * Validates positions against the current document.
 */
export function deserializeFoldState(positions: number[], doc: PmNode): Set<number> {
  const valid = new Set<number>();
  for (const pos of positions) {
    if (pos >= 0 && pos < doc.content.size) {
      const node = doc.nodeAt(pos);
      if (node?.type.name === 'heading') {
        valid.add(pos);
      }
    }
  }
  return valid;
}

// ---------------------------------------------------------------------------
// Fold toggle SVG icons
// ---------------------------------------------------------------------------

/** Chevron-right icon — shown when content can be expanded. */
const CHEVRON_RIGHT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>`;

/** Chevron-down icon — shown when content is expanded (foldable). */
const CHEVRON_DOWN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>`;

// ---------------------------------------------------------------------------
// Decoration builders
// ---------------------------------------------------------------------------

/**
 * Build the complete DecorationSet for all headings, including fold toggles
 * and hidden content decorations.
 */
function buildDecorations(
  doc: PmNode,
  foldedPositions: Set<number>,
  toggleClass: string,
  hiddenClass: string,
): DecorationSet {
  const decorations: Decoration[] = [];
  const headings = collectHeadings(doc);

  for (const heading of headings) {
    const isFolded = foldedPositions.has(heading.pos);

    // Widget decoration: fold toggle button placed before the heading.
    const toggleWidget = Decoration.widget(
      heading.pos,
      (view: EditorView) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `${toggleClass}${isFolded ? ` ${toggleClass}--folded` : ''}`;
        button.setAttribute('aria-label', isFolded ? 'Unfold heading' : 'Fold heading');
        button.setAttribute('aria-expanded', String(!isFolded));
        button.setAttribute('title', isFolded ? 'Unfold heading' : 'Fold heading');
        button.setAttribute('data-heading-pos', String(heading.pos));
        button.innerHTML = isFolded ? CHEVRON_RIGHT_SVG : CHEVRON_DOWN_SVG;

        // Prevent the click from affecting the editor selection.
        button.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });

        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Dispatch the toggle transaction.
          const tr = view.state.tr;
          const meta = HEADING_FOLD_PLUGIN_KEY.getState(view.state);
          if (!meta) return;

          const newFolded = new Set(meta.foldedPositions);
          if (newFolded.has(heading.pos)) {
            newFolded.delete(heading.pos);
          } else {
            newFolded.add(heading.pos);
          }

          tr.setMeta(HEADING_FOLD_PLUGIN_KEY, { foldedPositions: newFolded });
          view.dispatch(tr);
        });

        return button;
      },
      { side: -1 },
    );

    decorations.push(toggleWidget);

    // If folded, add inline decorations to hide content blocks.
    if (isFolded) {
      const range = computeFoldRange(doc, heading.pos, heading.level);
      if (range) {
        // Apply a node decoration to each block within the fold range.
        doc.forEach((node, offset) => {
          if (offset >= range.from && offset < range.to) {
            decorations.push(
              Decoration.node(offset, offset + node.nodeSize, {
                class: hiddenClass,
                style: 'display: none;',
                'aria-hidden': 'true',
              }),
            );
          }
        });
      }
    }
  }

  return DecorationSet.create(doc, decorations);
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function createHeadingFoldPlugin(
  options: Required<HeadingFoldOptions>,
): Plugin<HeadingFoldPluginState> {
  return new Plugin<HeadingFoldPluginState>({
    key: HEADING_FOLD_PLUGIN_KEY,

    state: {
      init(_config, state: EditorState): HeadingFoldPluginState {
        let foldedPositions = new Set<number>();

        // Restore from sessionStorage if persistence key is set.
        if (options.persistKey && typeof sessionStorage !== 'undefined') {
          try {
            const raw = sessionStorage.getItem(`ns-heading-fold:${options.persistKey}`);
            if (raw) {
              const parsed = JSON.parse(raw) as number[];
              foldedPositions = deserializeFoldState(parsed, state.doc);
            }
          } catch {
            // Ignore corrupt storage data.
          }
        }

        return { foldedPositions };
      },

      apply(tr, prev, _oldState, _newState): HeadingFoldPluginState {
        // Check for explicit meta override (from toggle commands).
        const meta = tr.getMeta(HEADING_FOLD_PLUGIN_KEY) as HeadingFoldPluginState | undefined;
        if (meta) {
          // Persist to sessionStorage if configured.
          if (options.persistKey && typeof sessionStorage !== 'undefined') {
            try {
              sessionStorage.setItem(
                `ns-heading-fold:${options.persistKey}`,
                JSON.stringify(serializeFoldState(meta.foldedPositions)),
              );
            } catch {
              // Storage full or unavailable.
            }
          }
          return meta;
        }

        // If the document changed, map positions.
        if (tr.docChanged) {
          const mapped = mapFoldedPositions(prev.foldedPositions, tr);
          return { foldedPositions: mapped };
        }

        return prev;
      },
    },

    props: {
      decorations(state: EditorState): DecorationSet {
        const pluginState = HEADING_FOLD_PLUGIN_KEY.getState(state);
        if (!pluginState) return DecorationSet.empty;

        return buildDecorations(
          state.doc,
          pluginState.foldedPositions,
          options.toggleClass ?? DEFAULT_TOGGLE_CLASS,
          options.hiddenClass ?? DEFAULT_HIDDEN_CLASS,
        );
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    headingFold: {
      /**
       * Toggle the fold state of a heading at the given document position.
       * If no position is provided, uses the heading at the current cursor position.
       */
      toggleHeadingFold: (pos?: number) => ReturnType;

      /**
       * Fold all headings in the document.
       */
      foldAllHeadings: () => ReturnType;

      /**
       * Unfold all headings in the document.
       */
      unfoldAllHeadings: () => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * HeadingFold extension — fold/collapse content under headings.
 *
 * Fold state is decoration-based (not stored in the document).
 * Content is hidden with `display: none` and `aria-hidden`.
 */
export const HeadingFold = Extension.create<HeadingFoldOptions>({
  name: 'headingFold',

  addOptions() {
    return {
      persistKey: null,
      toggleClass: DEFAULT_TOGGLE_CLASS,
      hiddenClass: DEFAULT_HIDDEN_CLASS,
    };
  },

  addCommands() {
    return {
      toggleHeadingFold:
        (pos?: number) =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const pluginState = HEADING_FOLD_PLUGIN_KEY.getState(state);
          if (!pluginState) return false;

          // Determine the heading position.
          let headingPos = pos;

          if (headingPos === undefined || headingPos === null) {
            // Find the heading at or before the current cursor position.
            const { $from } = state.selection;

            // Walk up through ancestors to find a heading.
            for (let depth = $from.depth; depth >= 0; depth--) {
              const node = depth === 0 ? state.doc : $from.node(depth);
              if (node.type.name === 'heading') {
                headingPos = depth === 0 ? 0 : $from.before(depth);
                break;
              }
            }

            // Also check the current top-level block.
            if (headingPos === undefined) {
              const topPos = $from.before(1);
              const topNode = state.doc.nodeAt(topPos);
              if (topNode?.type.name === 'heading') {
                headingPos = topPos;
              }
            }
          }

          if (headingPos === undefined) return false;

          // Verify the position points to a heading.
          const node = state.doc.nodeAt(headingPos);
          if (!node || node.type.name !== 'heading') return false;

          const newFolded = new Set(pluginState.foldedPositions);
          if (newFolded.has(headingPos)) {
            newFolded.delete(headingPos);
          } else {
            newFolded.add(headingPos);
          }

          const tr = state.tr;
          tr.setMeta(HEADING_FOLD_PLUGIN_KEY, { foldedPositions: newFolded });
          dispatch(tr);
          return true;
        },

      foldAllHeadings:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const headings = collectHeadings(state.doc);
          if (headings.length === 0) return false;

          const allPositions = new Set(headings.map((h) => h.pos));
          const tr = state.tr;
          tr.setMeta(HEADING_FOLD_PLUGIN_KEY, { foldedPositions: allPositions });
          dispatch(tr);
          return true;
        },

      unfoldAllHeadings:
        () =>
        ({ state, dispatch }) => {
          if (!dispatch) return true;

          const tr = state.tr;
          tr.setMeta(HEADING_FOLD_PLUGIN_KEY, { foldedPositions: new Set<number>() });
          dispatch(tr);
          return true;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-f': () => this.editor.commands.toggleHeadingFold(),
    };
  },

  addProseMirrorPlugins() {
    return [
      createHeadingFoldPlugin({
        persistKey: this.options.persistKey ?? null,
        toggleClass: this.options.toggleClass ?? DEFAULT_TOGGLE_CLASS,
        hiddenClass: this.options.hiddenClass ?? DEFAULT_HIDDEN_CLASS,
      }),
    ];
  },
});
