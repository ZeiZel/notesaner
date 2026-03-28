/**
 * NoteEmbedView — React NodeView component for ![[...]] note/image embeds.
 *
 * Renders two distinct variants:
 *
 * 1. Image embed (![[image.png]])
 *    - <img> with lazy loading via IntersectionObserver
 *    - Falls back to a placeholder when the image fails to load
 *
 * 2. Note embed (![[Note Title]])
 *    - Shows a collapsible inline preview of the target note's content
 *    - Lazy-loads content via IntersectionObserver (no fetch until visible)
 *    - Max depth = 1: when this component is already rendered inside an embed
 *      (depth >= 1) it renders a compact reference instead of a full preview
 *    - Circular reference detection: if `target` appears in the `ancestorIds`
 *      prop, renders a "circular embed" warning instead of loading
 *    - Click navigates to the source note via `options.onNavigate`
 *    - Missing note falls back to a clearly styled placeholder
 *
 * Props injected by TipTap (ReactNodeViewProps):
 *   node        — the ProseMirror Node (attrs: NoteEmbedAttrs)
 *   extension   — the NoteEmbed extension (options: NoteEmbedOptions)
 *   editor      — the TipTap Editor instance
 *
 * Additional storage props (set by the host via extension.storage):
 *   depth        (number)   — current embed nesting depth (default 0)
 *   ancestorIds  (string[]) — IDs of notes currently being rendered above
 *
 * @see libs/editor-core/src/extensions/note-embed.ts
 */

import { useState, useEffect, useRef, useCallback, type ComponentType } from 'react';
import { NodeViewWrapper } from '@tiptap/react';
import type { ReactNodeViewProps } from '@tiptap/react';
import type { NoteEmbedAttrs, NoteEmbedOptions, NoteEmbedContent } from '../extensions/note-embed';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NoteEmbedViewComponent = ComponentType<ReactNodeViewProps>;

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; data: NoteEmbedContent }
  | { status: 'missing' }
  | { status: 'error'; message: string };

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_EMBED_DEPTH = 1;

// ---------------------------------------------------------------------------
// Utility icons (inline SVG — keeps component dependency-free)
// ---------------------------------------------------------------------------

function EmbedIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M1.75 2A1.75 1.75 0 0 0 0 3.75v8.5C0 13.216.784 14 1.75 14h12.5A1.75 1.75 0 0 0 16 12.25v-8.5A1.75 1.75 0 0 0 14.25 2H1.75Zm0 1.5h12.5c.138 0 .25.112.25.25v8.5a.25.25 0 0 1-.25.25H1.75a.25.25 0 0 1-.25-.25v-8.5c0-.138.112-.25.25-.25ZM4 6.5a.5.5 0 0 0 0 1h8a.5.5 0 0 0 0-1H4Zm0 3a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1H4Z"
      />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 16 16"
      width="13"
      height="13"
      aria-hidden="true"
      focusable="false"
      style={{ display: 'inline', verticalAlign: 'middle', flexShrink: 0 }}
    >
      <path
        fill="currentColor"
        d="M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575ZM8 5a.75.75 0 0 0-.75.75v2.5a.75.75 0 0 0 1.5 0v-2.5A.75.75 0 0 0 8 5Zm0 8a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Image embed sub-component
// ---------------------------------------------------------------------------

interface ImageEmbedProps {
  target: string;
  alt: string;
  src: string;
  isEditable: boolean;
  onNavigate?: () => void;
}

function ImageEmbedContent({ target, alt, src, isEditable, onNavigate }: ImageEmbedProps) {
  const [imgError, setImgError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isEditable || e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        onNavigate?.();
      }
    },
    [isEditable, onNavigate],
  );

  if (imgError) {
    return (
      <div
        className="ns-note-embed__image-placeholder"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 12px',
          background: 'var(--ns-embed-missing-bg, #fef3c7)',
          border: '1px dashed var(--ns-embed-missing-border, #f59e0b)',
          borderRadius: '4px',
          color: 'var(--ns-embed-missing-color, #92400e)',
          fontSize: '0.85em',
        }}
        role="img"
        aria-label={`Image not found: ${target}`}
      >
        <WarningIcon />
        <span>Image not found: {target}</span>
      </div>
    );
  }

  return (
    <figure
      className="ns-note-embed__figure"
      style={{ margin: 0, cursor: onNavigate ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading="lazy"
        draggable={false}
        className="ns-note-embed__image"
        style={{ maxWidth: '100%', display: 'block' }}
        onError={() => setImgError(true)}
      />
    </figure>
  );
}

// ---------------------------------------------------------------------------
// Note embed — compact reference (used when depth >= MAX_EMBED_DEPTH)
// ---------------------------------------------------------------------------

interface CompactReferenceProps {
  target: string;
  onNavigate?: () => void;
  isEditable: boolean;
}

function CompactReference({ target, onNavigate, isEditable }: CompactReferenceProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditable || e.ctrlKey || e.metaKey) {
        onNavigate?.();
      }
    },
    [isEditable, onNavigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate?.();
      }
    },
    [onNavigate],
  );

  return (
    <div
      className="ns-note-embed ns-note-embed--compact"
      role="link"
      tabIndex={0}
      aria-label={`Embedded note: ${target} (click to open)`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        background: 'var(--ns-embed-bg, rgba(59,130,246,0.08))',
        border: '1px solid var(--ns-embed-border, rgba(59,130,246,0.3))',
        borderRadius: '4px',
        cursor: 'pointer',
        color: 'var(--ns-embed-color, #2563eb)',
        fontSize: '0.85em',
        userSelect: 'none',
      }}
    >
      <EmbedIcon />
      <span>{target}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Note embed — full preview
// ---------------------------------------------------------------------------

interface NotePreviewContentProps {
  target: string;
  loadState: LoadState;
  isEditable: boolean;
  onNavigate?: () => void;
}

function NotePreviewContent({
  target,
  loadState,
  isEditable,
  onNavigate,
}: NotePreviewContentProps) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isEditable || e.ctrlKey || e.metaKey) {
        onNavigate?.();
      }
    },
    [isEditable, onNavigate],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onNavigate?.();
      }
    },
    [onNavigate],
  );

  // Shared container styles
  const containerStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    border: '1px solid var(--ns-embed-border, rgba(59,130,246,0.25))',
    borderRadius: '6px',
    overflow: 'hidden',
    cursor: onNavigate ? 'pointer' : 'default',
    background: 'var(--ns-embed-bg, #f8faff)',
    userSelect: 'none',
  };

  if (loadState.status === 'idle' || loadState.status === 'loading') {
    return (
      <div
        className="ns-note-embed ns-note-embed--loading"
        style={containerStyle}
        aria-busy="true"
        aria-label={`Loading embed: ${target}`}
      >
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--ns-embed-muted, #94a3b8)',
            fontSize: '0.875em',
          }}
        >
          <EmbedIcon />
          <span>{loadState.status === 'loading' ? 'Loading…' : target}</span>
        </div>
      </div>
    );
  }

  if (loadState.status === 'missing') {
    return (
      <div
        className="ns-note-embed ns-note-embed--missing"
        style={{
          ...containerStyle,
          background: 'var(--ns-embed-missing-bg, #fef3c7)',
          border: '1px dashed var(--ns-embed-missing-border, #f59e0b)',
          cursor: 'default',
        }}
        role="alert"
        aria-label={`Note not found: ${target}`}
      >
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--ns-embed-missing-color, #92400e)',
            fontSize: '0.875em',
          }}
        >
          <WarningIcon />
          <span>Note not found: {target}</span>
        </div>
      </div>
    );
  }

  if (loadState.status === 'error') {
    return (
      <div
        className="ns-note-embed ns-note-embed--error"
        style={{
          ...containerStyle,
          background: 'var(--ns-embed-error-bg, #fef2f2)',
          border: '1px dashed var(--ns-embed-error-border, #ef4444)',
          cursor: 'default',
        }}
        role="alert"
        aria-label={`Failed to load embed: ${target}`}
      >
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            color: 'var(--ns-embed-error-color, #b91c1c)',
            fontSize: '0.875em',
          }}
        >
          <WarningIcon />
          <span>Failed to load: {target}</span>
        </div>
      </div>
    );
  }

  // status === 'loaded'
  const { data } = loadState;
  const excerpt = data.content.length > 280 ? `${data.content.slice(0, 277)}…` : data.content;

  return (
    <div
      className="ns-note-embed ns-note-embed--loaded"
      role={onNavigate ? 'link' : undefined}
      tabIndex={onNavigate ? 0 : undefined}
      aria-label={
        onNavigate ? `Embedded note: ${data.title} — click to open` : `Embedded note: ${data.title}`
      }
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      style={containerStyle}
    >
      {/* Header */}
      <div
        className="ns-note-embed__header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '8px 14px',
          borderBottom: '1px solid var(--ns-embed-border, rgba(59,130,246,0.15))',
          background: 'var(--ns-embed-header-bg, rgba(59,130,246,0.06))',
        }}
      >
        <EmbedIcon />
        <span
          className="ns-note-embed__title"
          style={{
            fontWeight: 600,
            fontSize: '0.9em',
            color: 'var(--ns-embed-title-color, #1e40af)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {data.title}
        </span>
      </div>

      {/* Content excerpt */}
      {excerpt && (
        <div
          className="ns-note-embed__content"
          style={{
            padding: '10px 14px',
            fontSize: '0.875em',
            lineHeight: 1.55,
            color: 'var(--ns-embed-content-color, #374151)',
            overflow: 'hidden',
            // Clamp to ~4 lines
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {excerpt}
        </div>
      )}

      {/* Footer */}
      <div
        className="ns-note-embed__footer"
        style={{
          padding: '5px 14px',
          fontSize: '0.75em',
          color: 'var(--ns-embed-muted, #94a3b8)',
          borderTop: excerpt ? '1px solid var(--ns-embed-border, rgba(59,130,246,0.1))' : undefined,
        }}
      >
        {data.wordCount} {data.wordCount === 1 ? 'word' : 'words'}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main NoteEmbedView component
// ---------------------------------------------------------------------------

/**
 * TipTap React NodeView for ![[...]] note and image embeds.
 *
 * Additional storage keys read from `extension.storage`:
 *   depth       (number, default 0)    — nesting level for the current render
 *   ancestorIds (string[], default []) — note IDs already on the render stack
 */
export function NoteEmbedView({ node, extension, editor }: ReactNodeViewProps) {
  const attrs = node.attrs as NoteEmbedAttrs;
  const options = extension.options as NoteEmbedOptions;
  const storage = (extension.storage ?? {}) as {
    depth?: number;
    ancestorIds?: string[];
  };

  const { target, embedType, alt } = attrs;
  const depth = storage.depth ?? 0;
  const ancestorIds: string[] = storage.ancestorIds ?? [];

  // -------------------------------------------------------------------------
  // Intersection Observer ref for lazy loading
  // -------------------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // -------------------------------------------------------------------------
  // Load state
  // -------------------------------------------------------------------------

  const [loadState, setLoadState] = useState<LoadState>({ status: 'idle' });

  // -------------------------------------------------------------------------
  // Navigate handler
  // -------------------------------------------------------------------------

  const handleNavigate = useCallback(() => {
    options.onNavigate?.(target);
  }, [options, target]);

  // -------------------------------------------------------------------------
  // Circular embed detection
  // -------------------------------------------------------------------------

  // We track note IDs in ancestorIds. For the initial load we only know the
  // target title; ID matching happens after loadContent resolves. We do a
  // title-based check too since IDs may not be available yet.
  const isCircular = ancestorIds.includes(target);

  // -------------------------------------------------------------------------
  // Lazy loading via IntersectionObserver
  // -------------------------------------------------------------------------

  useEffect(() => {
    // Only note embeds need lazy loading; image lazy loading is native via
    // the `loading="lazy"` attribute on <img>.
    if (embedType !== 'note') return;

    // Short-circuit: circular or too deep — no fetch needed.
    if (isCircular || depth >= MAX_EMBED_DEPTH) return;

    // No loader provided — nothing to fetch.
    if (!options.loadContent) {
      setLoadState({ status: 'idle' });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting) return;

        // Stop observing once we trigger the load.
        observer.disconnect();

        // Abort any in-flight request before starting a new one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        setLoadState({ status: 'loading' });

        const loadFn = options.loadContent;
        loadFn(target, controller.signal)
          .then((data) => {
            if (controller.signal.aborted) return;
            if (data === null) {
              setLoadState({ status: 'missing' });
            } else {
              setLoadState({ status: 'loaded', data });
            }
          })
          .catch((err: unknown) => {
            if (controller.signal.aborted) return;
            const message = err instanceof Error ? err.message : 'Unknown error';
            setLoadState({ status: 'error', message });
          });
      },
      { threshold: 0.1 },
    );

    const el = containerRef.current;
    if (el) observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [target, embedType, isCircular, depth, options]);

  // Abort any pending fetch when the component unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // -------------------------------------------------------------------------
  // Resolve image src
  // -------------------------------------------------------------------------

  const imageSrc = embedType === 'image' ? (options.resolveImageSrc?.(target) ?? target) : '';

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Circular reference guard
  if (isCircular) {
    return (
      <NodeViewWrapper
        as="div"
        className="ns-note-embed-wrapper ns-note-embed-wrapper--circular"
        data-embed-target={target}
        contentEditable={false}
      >
        <div
          className="ns-note-embed ns-note-embed--circular"
          role="alert"
          aria-label={`Circular embed detected: ${target}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            background: 'var(--ns-embed-error-bg, #fef2f2)',
            border: '1px dashed var(--ns-embed-error-border, #ef4444)',
            borderRadius: '4px',
            color: 'var(--ns-embed-error-color, #b91c1c)',
            fontSize: '0.85em',
          }}
        >
          <WarningIcon />
          <span>Circular embed: {target}</span>
        </div>
      </NodeViewWrapper>
    );
  }

  // Image embed
  if (embedType === 'image') {
    return (
      <NodeViewWrapper
        as="div"
        className="ns-note-embed-wrapper ns-note-embed-wrapper--image"
        data-embed-target={target}
        data-embed-type="image"
        contentEditable={false}
      >
        <ImageEmbedContent
          target={target}
          alt={alt ?? target}
          src={imageSrc}
          isEditable={editor.isEditable}
          onNavigate={options.onNavigate ? handleNavigate : undefined}
        />
      </NodeViewWrapper>
    );
  }

  // Depth-exceeded guard — render compact reference instead of full preview.
  if (depth >= MAX_EMBED_DEPTH) {
    return (
      <NodeViewWrapper
        as="div"
        className="ns-note-embed-wrapper ns-note-embed-wrapper--compact"
        data-embed-target={target}
        data-embed-type="note"
        contentEditable={false}
      >
        <CompactReference
          target={target}
          isEditable={editor.isEditable}
          onNavigate={options.onNavigate ? handleNavigate : undefined}
        />
      </NodeViewWrapper>
    );
  }

  // Full note embed preview
  return (
    <NodeViewWrapper
      as="div"
      ref={containerRef}
      className="ns-note-embed-wrapper ns-note-embed-wrapper--note"
      data-embed-target={target}
      data-embed-type="note"
      contentEditable={false}
    >
      <NotePreviewContent
        target={target}
        loadState={loadState}
        isEditable={editor.isEditable}
        onNavigate={options.onNavigate ? handleNavigate : undefined}
      />
    </NodeViewWrapper>
  );
}

NoteEmbedView.displayName = 'NoteEmbedView';
