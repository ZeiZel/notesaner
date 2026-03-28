/**
 * DragHandle TipTap Extension
 *
 * Displays a six-dot drag handle (⋮⋮) to the left of any block-level element
 * when the user hovers over it.  Dragging the handle reorders blocks using
 * ProseMirror's native drag-and-drop mechanism.
 *
 * Features:
 *   - Handle appears on block hover (paragraphs, headings, lists, code blocks,
 *     tables, images, callouts, blockquotes)
 *   - Click-drag to reorder (mouse)
 *   - Touch support via long-press (500 ms) → touchmove → touchend
 *   - Blue drop-indicator line showing the insertion target position
 *   - Custom transparent drag image (no browser ghost image)
 *   - Read-only mode aware — handle is hidden and non-interactive
 *
 * Architecture:
 *   A single ProseMirror plugin (`dragHandlePlugin`) attaches event listeners
 *   to the editor DOM via the `handleDOMEvents` prop so they are correctly
 *   removed when the editor is destroyed.  The handle element is appended to
 *   the editor's parent container and positioned absolutely above the hovered
 *   block.  A separate drop-indicator `<div>` is maintained for the drag-over
 *   feedback.
 *
 *   The extension does NOT touch `extensions/index.ts` or `create-editor.ts`.
 *
 * CSS classes (target with your global stylesheet):
 *   .ns-drag-handle          — the drag handle button
 *   .ns-drag-handle--visible — set when a block is hovered
 *   .ns-drag-handle--active  — set while dragging
 *   .ns-drop-indicator       — horizontal drop-target line
 *   .ns-drop-indicator--visible — set when a valid drop target is highlighted
 */

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { Fragment } from '@tiptap/pm/model';
import type { Node as PmNode, ResolvedPos } from '@tiptap/pm/model';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Options accepted by DragHandle.configure(). */
export interface DragHandleOptions {
  /**
   * Pixel width of the drag handle column to the left of the editor content.
   * Defaults to 24 px.
   */
  handleWidth?: number;

  /**
   * Long-press duration in milliseconds before a touch drag is initiated.
   * Defaults to 500 ms.
   */
  longPressDuration?: number;

  /**
   * Additional CSS class to add to the handle element.
   * Useful for integrating custom icon libraries.
   */
  handleClass?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DRAG_HANDLE_PLUGIN_KEY = new PluginKey<DragHandlePluginState>('dragHandle');

const HANDLE_CLASS = 'ns-drag-handle';
const HANDLE_VISIBLE_CLASS = 'ns-drag-handle--visible';
const HANDLE_ACTIVE_CLASS = 'ns-drag-handle--active';
const DROP_INDICATOR_CLASS = 'ns-drop-indicator';
const DROP_INDICATOR_VISIBLE_CLASS = 'ns-drop-indicator--visible';

/** Block-level node names that receive a drag handle. */
const BLOCK_NODE_NAMES = new Set([
  'paragraph',
  'heading',
  'bulletList',
  'orderedList',
  'listItem',
  'taskList',
  'taskItem',
  'codeBlock',
  'blockquote',
  'horizontalRule',
  'table',
  'callout',
  'imageEmbed',
  'image',
]);

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

interface DragHandlePluginState {
  /** Position in the document of the currently-hovered top-level block. */
  hoveredBlockPos: number | null;
  /** Whether a drag is currently in progress. */
  isDragging: boolean;
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

/**
 * Given a mouse/touch clientY and an EditorView, find the ProseMirror block
 * node at that y-coordinate.  Returns `{ pos, node, dom }` or null.
 */
function blockAtCoords(
  view: EditorView,
  clientX: number,
  clientY: number,
): { pos: number; node: PmNode; dom: HTMLElement } | null {
  // posAtCoords maps viewport coordinates to a document position.
  const posAtCoord = view.posAtCoords({ left: clientX, top: clientY });
  if (!posAtCoord) return null;

  const pos = posAtCoord.inside >= 0 ? posAtCoord.inside : posAtCoord.pos;
  const $pos: ResolvedPos = view.state.doc.resolve(pos);

  // Walk up to find the outermost block child of the document root (depth 1).
  for (let depth = $pos.depth; depth >= 1; depth--) {
    const node = $pos.node(depth);
    if (BLOCK_NODE_NAMES.has(node.type.name)) {
      const blockPos = $pos.before(depth);
      const domNode = view.nodeDOM(blockPos);
      if (domNode instanceof HTMLElement) {
        return { pos: blockPos, node, dom: domNode };
      }
    }
  }

  return null;
}

/**
 * Determine the ProseMirror insert position for a drop, given the cursor's
 * clientY within the editor.  Returns the position just before or just after
 * a block, and the rect of the reference block DOM node for indicator
 * placement.
 */
function dropTargetAtCoords(
  view: EditorView,
  clientY: number,
): { pos: number; rect: DOMRect } | null {
  const editorDom = view.dom;
  const children = Array.from(editorDom.children) as HTMLElement[];

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    const rect = child.getBoundingClientRect();

    const midY = rect.top + rect.height / 2;

    if (clientY <= midY) {
      // Drop before this block
      const pmPos = view.posAtDOM(child, 0);
      const $resolved = view.state.doc.resolve(pmPos);
      return { pos: $resolved.before($resolved.depth) || 0, rect };
    }
  }

  // Drop after the last block
  const lastChild = children[children.length - 1];
  if (!lastChild) return null;
  const rect = lastChild.getBoundingClientRect();
  const pmPos = view.posAtDOM(lastChild, 0);
  const $resolved = view.state.doc.resolve(pmPos);
  const afterPos = $resolved.after($resolved.depth);
  return { pos: afterPos, rect };
}

// ---------------------------------------------------------------------------
// Plugin factory
// ---------------------------------------------------------------------------

function createDragHandlePlugin(
  options: Required<DragHandleOptions>,
): Plugin<DragHandlePluginState> {
  // Elements owned by the plugin — created lazily and cleaned up on destroy.
  let handleEl: HTMLElement | null = null;
  let dropIndicatorEl: HTMLElement | null = null;

  // Drag state
  let dragSourcePos: number | null = null;
  let isDragging = false;

  // Touch state
  let touchLongPressTimer: ReturnType<typeof setTimeout> | null = null;
  let touchDragActive = false;
  let touchDragSourcePos: number | null = null;
  let touchStartCoords: { x: number; y: number } | null = null;

  // ---------------------------------------------------------------------------
  // Handle element creation
  // ---------------------------------------------------------------------------

  function ensureElements(view: EditorView): {
    handle: HTMLElement;
    indicator: HTMLElement;
  } {
    if (handleEl && dropIndicatorEl) {
      return { handle: handleEl, indicator: dropIndicatorEl };
    }

    // The editor wrapper must be position:relative so we can absolutely
    // position the handle against it.
    const wrapper = view.dom.parentElement;
    if (!wrapper) {
      throw new Error('[DragHandle] editor DOM has no parent element');
    }

    // Only set position:relative if not already set to a positioned value.
    const wrapperStyle = window.getComputedStyle(wrapper);
    if (wrapperStyle.position === 'static') {
      wrapper.style.position = 'relative';
    }

    // Drag handle button
    const handle = document.createElement('div');
    handle.className = HANDLE_CLASS;
    if (options.handleClass) handle.classList.add(options.handleClass);
    handle.setAttribute('aria-label', 'Drag to reorder block');
    handle.setAttribute('draggable', 'true');
    handle.setAttribute('role', 'button');
    handle.setAttribute('tabindex', '-1');
    handle.innerHTML = DragHandleSvg;
    wrapper.appendChild(handle);

    // Drop indicator line
    const indicator = document.createElement('div');
    indicator.className = DROP_INDICATOR_CLASS;
    wrapper.appendChild(indicator);

    handleEl = handle;
    dropIndicatorEl = indicator;
    return { handle, indicator };
  }

  // ---------------------------------------------------------------------------
  // Handle positioning
  // ---------------------------------------------------------------------------

  function positionHandle(view: EditorView, blockDom: HTMLElement): void {
    const { handle } = ensureElements(view);
    const wrapper = view.dom.parentElement ?? view.dom;

    const wrapperRect = wrapper.getBoundingClientRect();
    const blockRect = blockDom.getBoundingClientRect();

    const top = blockRect.top - wrapperRect.top + wrapper.scrollTop;
    const handleHeight = handle.offsetHeight || 20;
    const centeredTop = top + (blockRect.height - handleHeight) / 2;

    handle.style.top = `${centeredTop}px`;
    handle.style.left = `${-options.handleWidth}px`;
    handle.style.width = `${options.handleWidth}px`;
    handle.classList.add(HANDLE_VISIBLE_CLASS);
  }

  function hideHandle(): void {
    handleEl?.classList.remove(HANDLE_VISIBLE_CLASS);
    handleEl?.classList.remove(HANDLE_ACTIVE_CLASS);
  }

  // ---------------------------------------------------------------------------
  // Drop indicator positioning
  // ---------------------------------------------------------------------------

  function showDropIndicator(view: EditorView, clientY: number): number | null {
    const target = dropTargetAtCoords(view, clientY);
    if (!target || !dropIndicatorEl) return null;

    const wrapper = view.dom.parentElement ?? view.dom;
    const wrapperRect = wrapper.getBoundingClientRect();

    const { rect } = target;
    const editorDom = view.dom;
    const children = Array.from(editorDom.children) as HTMLElement[];

    // Determine which side of the block the indicator should appear on.
    let indicatorY: number;
    if (children.length > 0) {
      // Check if clientY is above the midpoint of the referenced block
      const mid = rect.top + rect.height / 2;
      if (clientY <= mid) {
        indicatorY = rect.top - wrapperRect.top + wrapper.scrollTop;
      } else {
        indicatorY = rect.bottom - wrapperRect.top + wrapper.scrollTop;
      }
    } else {
      indicatorY = rect.top - wrapperRect.top + wrapper.scrollTop;
    }

    dropIndicatorEl.style.top = `${indicatorY}px`;
    dropIndicatorEl.classList.add(DROP_INDICATOR_VISIBLE_CLASS);

    return target.pos;
  }

  function hideDropIndicator(): void {
    dropIndicatorEl?.classList.remove(DROP_INDICATOR_VISIBLE_CLASS);
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop helpers
  // ---------------------------------------------------------------------------

  /**
   * Move the block at `fromPos` to `toPos` in the document.
   *
   * Strategy: rebuild the document's top-level child list with the node moved
   * to the new position, then replace the entire document content with a single
   * replaceWith step.  This avoids multi-step position mapping issues.
   */
  function moveBlock(view: EditorView, fromPos: number, toPos: number): void {
    const { state, dispatch } = view;
    const { doc } = state;

    // Collect all top-level blocks and their positions.
    const blocks: Array<{ node: PmNode; pos: number }> = [];
    doc.forEach((n, offset) => blocks.push({ node: n, pos: offset }));

    // Find the source block index.
    const srcIdx = blocks.findIndex((b) => b.pos === fromPos);
    if (srcIdx === -1) return;

    const srcNode = blocks[srcIdx].node;
    const nodeEnd = fromPos + srcNode.nodeSize;

    // Only move if the target is genuinely different.
    if (toPos === fromPos || toPos === nodeEnd) return;

    // Find the target insertion index: the block whose start position is
    // at or after toPos determines where we insert.
    let insertIdx = blocks.findIndex((b) => b.pos >= toPos);
    if (insertIdx === -1) insertIdx = blocks.length; // append at end

    // Build the new ordered list.
    const reordered = blocks.map((b) => b.node);
    reordered.splice(srcIdx, 1); // remove source

    // Adjust insertIdx for the removal when moving downward.
    const adjustedInsert = insertIdx > srcIdx ? insertIdx - 1 : insertIdx;
    reordered.splice(adjustedInsert, 0, srcNode); // insert at target

    // Create new document content and replace the whole doc.
    const newContent = Fragment.fromArray(reordered);

    const tr = state.tr;
    tr.replaceWith(0, doc.content.size, newContent);
    dispatch(tr.scrollIntoView());
  }

  // ---------------------------------------------------------------------------
  // Mouse event handlers
  // ---------------------------------------------------------------------------

  function onMouseMove(view: EditorView, event: MouseEvent): boolean {
    if (!view.editable) return false;
    if (isDragging) return false;

    const block = blockAtCoords(view, event.clientX, event.clientY);
    if (!block) {
      hideHandle();
      return false;
    }

    positionHandle(view, block.dom);
    dragSourcePos = block.pos;
    return false;
  }

  function onMouseLeave(_view: EditorView, _event: MouseEvent): boolean {
    if (!isDragging) {
      hideHandle();
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // Drag event handlers (attached to the handle element itself, not the view)
  // ---------------------------------------------------------------------------

  function attachHandleEvents(view: EditorView): void {
    const { handle } = ensureElements(view);

    // ----- dragstart -----
    handle.addEventListener('dragstart', (event) => {
      if (!view.editable || dragSourcePos === null) {
        event.preventDefault();
        return;
      }

      isDragging = true;
      handle.classList.add(HANDLE_ACTIVE_CLASS);

      // Use an invisible drag image so the browser does not render a ghost.
      const img = document.createElement('div');
      img.style.cssText = 'position:absolute;top:-9999px;width:1px;height:1px;';
      document.body.appendChild(img);
      event.dataTransfer?.setDragImage(img, 0, 0);
      requestAnimationFrame(() => document.body.removeChild(img));

      // Store source position in dataTransfer for inter-window safety.
      event.dataTransfer?.setData('application/x-notesaner-block-pos', String(dragSourcePos));
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
      }
    });

    // ----- drag (continuous) -----
    handle.addEventListener('drag', (event) => {
      if (!isDragging || event.clientY === 0) return;
      showDropIndicator(view, event.clientY);
    });

    // ----- dragend -----
    handle.addEventListener('dragend', (_event) => {
      isDragging = false;
      handle.classList.remove(HANDLE_ACTIVE_CLASS);
      hideDropIndicator();
    });
  }

  // ---------------------------------------------------------------------------
  // Editor-level drag events (drop target)
  // ---------------------------------------------------------------------------

  function onDragOver(view: EditorView, event: DragEvent): boolean {
    if (!isDragging && !touchDragActive) return false;
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }
    showDropIndicator(view, event.clientY);
    return true;
  }

  function onDrop(view: EditorView, event: DragEvent): boolean {
    if (!view.editable) return false;

    const rawPos = event.dataTransfer?.getData('application/x-notesaner-block-pos');
    if (!rawPos) return false;

    event.preventDefault();

    const fromPos = parseInt(rawPos, 10);
    if (isNaN(fromPos)) return false;

    const target = dropTargetAtCoords(view, event.clientY);
    if (!target) return false;

    moveBlock(view, fromPos, target.pos);

    isDragging = false;
    hideDropIndicator();
    hideHandle();
    return true;
  }

  function onDragLeave(_view: EditorView, event: DragEvent): boolean {
    // Only hide indicator when leaving the editor entirely, not child elements.
    const related = event.relatedTarget as Node | null;
    if (related && (event.currentTarget as HTMLElement).contains(related)) {
      return false;
    }
    hideDropIndicator();
    return false;
  }

  // ---------------------------------------------------------------------------
  // Touch event handlers (long-press to initiate drag)
  // ---------------------------------------------------------------------------

  function onTouchStart(view: EditorView, event: TouchEvent): boolean {
    if (!view.editable) return false;
    const touch = event.touches[0];
    if (!touch) return false;

    touchStartCoords = { x: touch.clientX, y: touch.clientY };

    touchLongPressTimer = setTimeout(() => {
      const block = blockAtCoords(view, touch.clientX, touch.clientY);
      if (!block) return;

      touchDragActive = true;
      touchDragSourcePos = block.pos;

      const { handle } = ensureElements(view);
      positionHandle(view, block.dom);
      handle.classList.add(HANDLE_ACTIVE_CLASS);

      // Haptic feedback where supported
      if ('vibrate' in navigator) {
        navigator.vibrate(50);
      }
    }, options.longPressDuration);

    return false;
  }

  function onTouchMove(view: EditorView, event: TouchEvent): boolean {
    const touch = event.touches[0];
    if (!touch) return false;

    if (!touchDragActive) {
      // Cancel the long-press timer if the finger moved significantly before it fired.
      if (touchStartCoords) {
        const dx = Math.abs(touch.clientX - touchStartCoords.x);
        const dy = Math.abs(touch.clientY - touchStartCoords.y);
        if (dx > 10 || dy > 10) {
          if (touchLongPressTimer !== null) {
            clearTimeout(touchLongPressTimer);
            touchLongPressTimer = null;
          }
        }
      }
      return false;
    }

    event.preventDefault(); // Prevent scroll while dragging
    showDropIndicator(view, touch.clientY);
    return true;
  }

  function onTouchEnd(view: EditorView, event: TouchEvent): boolean {
    if (touchLongPressTimer !== null) {
      clearTimeout(touchLongPressTimer);
      touchLongPressTimer = null;
    }

    if (!touchDragActive || touchDragSourcePos === null) {
      touchDragActive = false;
      touchStartCoords = null;
      return false;
    }

    const touch = event.changedTouches[0];
    if (touch) {
      const target = dropTargetAtCoords(view, touch.clientY);
      if (target) {
        moveBlock(view, touchDragSourcePos, target.pos);
      }
    }

    touchDragActive = false;
    touchDragSourcePos = null;
    touchStartCoords = null;
    hideDropIndicator();
    hideHandle();
    return true;
  }

  function onTouchCancel(_view: EditorView, _event: TouchEvent): boolean {
    if (touchLongPressTimer !== null) {
      clearTimeout(touchLongPressTimer);
      touchLongPressTimer = null;
    }
    touchDragActive = false;
    touchDragSourcePos = null;
    touchStartCoords = null;
    hideDropIndicator();
    hideHandle();
    return false;
  }

  // ---------------------------------------------------------------------------
  // Plugin
  // ---------------------------------------------------------------------------

  return new Plugin<DragHandlePluginState>({
    key: DRAG_HANDLE_PLUGIN_KEY,

    state: {
      init(): DragHandlePluginState {
        return { hoveredBlockPos: null, isDragging: false };
      },
      apply(_tr, prev): DragHandlePluginState {
        return prev;
      },
    },

    view(editorView) {
      // Attach handle events after the first render when the DOM is available.
      // Use a microtask to ensure the parent element exists.
      queueMicrotask(() => {
        if (!editorView.dom.isConnected) return;
        try {
          attachHandleEvents(editorView);
        } catch {
          // Silently ignore if the element creation fails (e.g., SSR context).
        }
      });

      return {
        destroy() {
          handleEl?.remove();
          dropIndicatorEl?.remove();
          handleEl = null;
          dropIndicatorEl = null;
          dragSourcePos = null;
          isDragging = false;
          touchDragActive = false;
          if (touchLongPressTimer !== null) {
            clearTimeout(touchLongPressTimer);
            touchLongPressTimer = null;
          }
        },
      };
    },

    props: {
      handleDOMEvents: {
        mousemove: onMouseMove,
        mouseleave: onMouseLeave,
        dragover: onDragOver,
        drop: onDrop,
        dragleave: onDragLeave,
        touchstart: onTouchStart,
        touchmove: onTouchMove,
        touchend: onTouchEnd,
        touchcancel: onTouchCancel,
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Inline drag handle icon SVG
// ---------------------------------------------------------------------------

/** Six-dot grip icon (⠿) rendered as an inline SVG string. */
const DragHandleSvg = `<svg
  xmlns="http://www.w3.org/2000/svg"
  width="14"
  height="14"
  viewBox="0 0 10 16"
  fill="currentColor"
  aria-hidden="true"
>
  <circle cx="3" cy="2.5" r="1.2"/>
  <circle cx="7" cy="2.5" r="1.2"/>
  <circle cx="3" cy="8" r="1.2"/>
  <circle cx="7" cy="8" r="1.2"/>
  <circle cx="3" cy="13.5" r="1.2"/>
  <circle cx="7" cy="13.5" r="1.2"/>
</svg>`;

// ---------------------------------------------------------------------------
// TipTap command declarations
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    dragHandle: {
      /**
       * Programmatically move a block from one position to another.
       * Useful for keyboard-driven reordering (e.g., Alt+Up / Alt+Down).
       */
      moveBlock: (fromPos: number, toPos: number) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension
// ---------------------------------------------------------------------------

/**
 * DragHandle extension — block-level drag-to-reorder for TipTap editors.
 *
 * Usage:
 * ```ts
 * import { DragHandle } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   DragHandle.configure({ handleWidth: 24, longPressDuration: 500 }),
 * ];
 * ```
 *
 * Pair with the CSS from `DragHandle.tsx` (or your own styles) to render the
 * handle and drop indicator correctly.
 */
export const DragHandle = Extension.create<DragHandleOptions>({
  name: 'dragHandle',

  addOptions() {
    return {
      handleWidth: 24,
      longPressDuration: 500,
      handleClass: undefined,
    };
  },

  addCommands() {
    return {
      moveBlock:
        (fromPos: number, toPos: number) =>
        ({ state, dispatch }) => {
          if (!dispatch) return false;

          const { doc } = state;

          // Guard against out-of-range positions before resolving.
          if (fromPos < 0 || fromPos >= doc.content.size) return false;

          // Collect all top-level blocks.
          const blocks: Array<{ node: PmNode; pos: number }> = [];
          doc.forEach((n, offset) => blocks.push({ node: n, pos: offset }));

          const srcIdx = blocks.findIndex((b) => b.pos === fromPos);
          if (srcIdx === -1) return false;

          const srcNode = blocks[srcIdx].node;
          const nodeEnd = fromPos + srcNode.nodeSize;

          // No-op if toPos equals fromPos or nodeEnd.
          if (toPos === fromPos || toPos === nodeEnd) return false;

          // Find insertion index.
          let insertIdx = blocks.findIndex((b) => b.pos >= toPos);
          if (insertIdx === -1) insertIdx = blocks.length;

          // Build new order.
          const reordered = blocks.map((b) => b.node);
          reordered.splice(srcIdx, 1);
          const adjustedInsert = insertIdx > srcIdx ? insertIdx - 1 : insertIdx;
          reordered.splice(adjustedInsert, 0, srcNode);

          // Replace document content.
          const newContent = Fragment.fromArray(reordered);
          const tr = state.tr;
          tr.replaceWith(0, doc.content.size, newContent);
          dispatch(tr.scrollIntoView());
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      createDragHandlePlugin({
        handleWidth: this.options.handleWidth ?? 24,
        longPressDuration: this.options.longPressDuration ?? 500,
        handleClass: this.options.handleClass ?? '',
      }),
    ];
  },
});
