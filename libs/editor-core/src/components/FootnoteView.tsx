/**
 * FootnoteView — React NodeView components for footnote nodes.
 *
 * Exports two components:
 *   - `FootnoteRefView`  — renders the inline [^N] reference as a styled
 *                          superscript link; clicking scrolls to the definition.
 *   - `FootnoteDefView`  — renders the [^N]: definition block at the bottom of
 *                          the note; clicking the back-link scrolls to the ref.
 *
 * Both components follow the TipTap ReactNodeViewRenderer pattern used in
 * WikiLinkNode.tsx: wrap content in NodeViewWrapper and receive `node`,
 * `extension`, and `editor` from TipTap's React integration.
 *
 * Scroll behaviour is implemented here (browser-side) via the helper functions
 * exported from the extension. The extension file itself is DOM-free.
 *
 * @see libs/editor-core/src/extensions/footnote.ts
 */

import type { ComponentType } from 'react';
import React from 'react';
import { NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import {
  scrollToFootnoteDef,
  scrollToFootnoteRef,
  footnoteRefId,
  footnoteDefId,
} from '../extensions/footnote';
import type { FootnoteAttrs } from '../extensions/footnote';

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

export type FootnoteRefViewComponent = ComponentType<ReactNodeViewProps>;
export type FootnoteDefViewComponent = ComponentType<ReactNodeViewProps>;

// ---------------------------------------------------------------------------
// FootnoteRefView
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for the inline `footnoteRef` node.
 *
 * Renders as a <sup> with a clickable label that scrolls to the definition.
 * In editable mode: Ctrl/Cmd+click navigates; plain click selects the node.
 * In read-only mode: any click navigates.
 */
export function FootnoteRefView({ node, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as FootnoteAttrs;
  const { label } = attrs;

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!editor.isEditable) {
      // Read-only: always scroll to definition.
      scrollToFootnoteDef(label);
      return;
    }

    // Editable: Ctrl/Cmd+click navigates; plain click lets TipTap select node.
    if (event.ctrlKey || event.metaKey) {
      scrollToFootnoteDef(label);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToFootnoteDef(label);
    }
  }

  return (
    <NodeViewWrapper
      as="sup"
      id={footnoteRefId(label)}
      className="ns-footnote-ref-wrapper"
      aria-label={`Footnote reference ${label}`}
      style={{ display: 'inline' }}
    >
      <a
        href={`#${footnoteDefId(label)}`}
        className="ns-footnote-ref"
        aria-describedby={footnoteDefId(label)}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        style={{
          color: 'var(--ns-footnote-ref-color, #3b82f6)',
          textDecoration: 'none',
          cursor: editor.isEditable ? 'default' : 'pointer',
          fontWeight: 500,
          // Prevent default anchor navigation — we handle scroll manually.
          pointerEvents: 'auto',
        }}
      >
        {`[^${label}]`}
      </a>
    </NodeViewWrapper>
  );
}

FootnoteRefView.displayName = 'FootnoteRefView';

// ---------------------------------------------------------------------------
// FootnoteDefView
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for the block `footnoteDef` node.
 *
 * Renders a labelled definition block with a back-link.
 * The back-link scrolls the viewport back to the inline reference.
 * `NodeViewContent` provides the editable text area for the definition body.
 */
export function FootnoteDefView({ node, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as FootnoteAttrs;
  const { label } = attrs;

  function handleBackLinkClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();
    scrollToFootnoteRef(label);
  }

  function handleBackLinkKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      scrollToFootnoteRef(label);
    }
  }

  return (
    <NodeViewWrapper
      as="div"
      id={footnoteDefId(label)}
      className="ns-footnote-def"
      role="note"
      aria-label={`Footnote ${label} definition`}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.4em',
        marginTop: '0.5em',
        paddingTop: '0.25em',
        borderTop: 'var(--ns-footnote-def-border, 1px solid currentColor)',
        opacity: 0.8,
        fontSize: '0.875em',
      }}
    >
      {/* Back-link: [^N]: anchors back to the inline reference */}
      <a
        href={`#${footnoteRefId(label)}`}
        className="ns-footnote-def__backlink"
        aria-label={`Return to footnote ${label} reference`}
        tabIndex={0}
        onClick={handleBackLinkClick}
        onKeyDown={handleBackLinkKeyDown}
        style={{
          color: 'var(--ns-footnote-ref-color, #3b82f6)',
          textDecoration: 'none',
          flexShrink: 0,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {`[^${label}]:`}
      </a>

      {/* Editable definition content */}
      <NodeViewContent
        as="span"
        className="ns-footnote-def__content"
        style={{
          flex: 1,
          // Ensure the content is editable when editor is in editable mode.
          outline: 'none',
        }}
      />

      {/* In editable mode show a subtle "delete footnote" hint */}
      {editor.isEditable && (
        <button
          type="button"
          className="ns-footnote-def__remove"
          aria-label={`Remove footnote ${label}`}
          title={`Remove footnote ${label}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.commands as any).removeFootnote?.(label);
          }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '0 0.2em',
            flexShrink: 0,
            color: 'var(--ns-footnote-remove-color, #9ca3af)',
            fontSize: '0.75em',
            lineHeight: 1,
            opacity: 0.6,
          }}
        >
          ×
        </button>
      )}
    </NodeViewWrapper>
  );
}

FootnoteDefView.displayName = 'FootnoteDefView';
