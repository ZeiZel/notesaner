'use client';

/**
 * LinkTypePopover — mini popover for choosing the link type when a new edge is
 * dropped in the graph.
 *
 * Shown after the user releases a drag on a valid target node.
 * The user chooses WIKI (default), MARKDOWN, EMBED, or BLOCK_REF.
 * On confirmation the component calls onConfirm() which triggers the API call
 * and updates the graph.
 *
 * API side-effect:
 *   PATCH /api/workspaces/:wid/notes/:sourceId
 *   body: { content: <existing content with [[TargetTitle]] appended> }
 *
 * The actual content append is done by the caller (GraphView) so that this
 * component stays presentational and testable without network access.
 *
 * Accessibility:
 * - Role dialog with aria-modal
 * - Focus trapped: tab cycles through link-type buttons and Cancel
 * - Escape key closes and cancels
 * - Each button has aria-pressed semantics
 */

import { useEffect, useRef, useCallback } from 'react';
import type { LinkType } from '@notesaner/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LinkTypePopoverProps {
  /**
   * Screen coordinates of the drop point. The popover is placed near this
   * position, adjusted to stay within the viewport.
   */
  dropX: number;
  dropY: number;
  /** Title of the source note (shown in the popover heading). */
  sourceTitle: string;
  /** Title of the target note (shown in the popover heading). */
  targetTitle: string;
  /** Called when the user confirms with the chosen link type. */
  onConfirm: (linkType: LinkType) => void;
  /** Called when the user dismisses the popover without creating a link. */
  onCancel: () => void;
  /** Whether an API call is in-flight (shows loading state). */
  isPending?: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINK_TYPE_OPTIONS: { type: LinkType; label: string; description: string; color: string }[] = [
  {
    type: 'WIKI',
    label: 'Wiki link',
    description: '[[Note title]] — standard Zettelkasten link',
    color: '#6366f1',
  },
  {
    type: 'MARKDOWN',
    label: 'Markdown link',
    description: '[Note title](path) — portable hyperlink',
    color: '#10b981',
  },
  {
    type: 'EMBED',
    label: 'Embed',
    description: '![[Note title]] — inline content embed',
    color: '#f59e0b',
  },
  {
    type: 'BLOCK_REF',
    label: 'Block ref',
    description: '[[Note^block-id]] — block-level reference',
    color: '#ec4899',
  },
];

/** Popover dimensions used for boundary clamping. */
const POPOVER_WIDTH = 280;
const POPOVER_HEIGHT = 220;
const VIEWPORT_MARGIN = 12;

// ---------------------------------------------------------------------------
// Helper: clamp popover into viewport
// ---------------------------------------------------------------------------

function clampedPosition(dropX: number, dropY: number): { left: number; top: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1920;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 1080;

  const left = Math.min(
    Math.max(dropX + 12, VIEWPORT_MARGIN),
    vw - POPOVER_WIDTH - VIEWPORT_MARGIN,
  );
  const top = Math.min(
    Math.max(dropY - POPOVER_HEIGHT / 2, VIEWPORT_MARGIN),
    vh - POPOVER_HEIGHT - VIEWPORT_MARGIN,
  );

  return { left, top };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LinkTypePopover({
  dropX,
  dropY,
  sourceTitle,
  targetTitle,
  onConfirm,
  onCancel,
  isPending = false,
}: LinkTypePopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { left, top } = clampedPosition(dropX, dropY);

  // ---------------------------------------------------------------------------
  // Focus management
  // ---------------------------------------------------------------------------

  useEffect(() => {
    // Move focus into the popover when it appears
    const el = containerRef.current;
    if (!el) return;
    const firstButton = el.querySelector<HTMLButtonElement>('button');
    firstButton?.focus();
  }, []);

  // ---------------------------------------------------------------------------
  // Keyboard handler (Escape to cancel, Tab trap)
  // ---------------------------------------------------------------------------

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      // Tab trap
      if (event.key === 'Tab') {
        const el = containerRef.current;
        if (!el) return;
        const focusable = Array.from(el.querySelectorAll<HTMLElement>('button:not([disabled])'));
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }
    },
    [onCancel],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Backdrop to capture outside-clicks */}
      <div className="fixed inset-0 z-40" aria-hidden="true" onClick={onCancel} />

      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Choose link type"
        onKeyDown={handleKeyDown}
        className="fixed z-50 w-[280px] rounded-lg border border-border bg-card shadow-xl"
        style={{ left, top }}
      >
        {/* Header */}
        <div className="border-b border-border px-3 py-2.5">
          <p className="text-xs font-semibold text-foreground">Create link</p>
          <p className="mt-0.5 truncate text-[10px] text-foreground-muted">
            <span className="font-medium text-foreground">{sourceTitle || 'Source'}</span>{' '}
            <span aria-hidden="true">→</span>{' '}
            <span className="font-medium text-foreground">{targetTitle || 'Target'}</span>
          </p>
        </div>

        {/* Link type options */}
        <div className="p-2" role="listbox" aria-label="Link types">
          {LINK_TYPE_OPTIONS.map(({ type, label, description, color }) => (
            <button
              key={type}
              type="button"
              role="option"
              aria-selected={false}
              disabled={isPending}
              onClick={() => onConfirm(type)}
              className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none disabled:opacity-50"
            >
              {/* Color dot */}
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden="true"
              />
              <span className="flex flex-col">
                <span className="text-xs font-medium text-foreground">{label}</span>
                <span className="text-[10px] text-foreground-muted">{description}</span>
              </span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-3 py-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="w-full rounded-md py-1 text-xs text-foreground-muted transition-colors hover:bg-accent hover:text-foreground focus:outline-none disabled:opacity-50"
          >
            Cancel
          </button>
        </div>

        {/* Loading overlay */}
        {isPending && (
          <div
            className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/80"
            aria-live="polite"
            aria-busy="true"
          >
            <span className="text-xs text-foreground-muted">Creating link...</span>
          </div>
        )}
      </div>
    </>
  );
}
