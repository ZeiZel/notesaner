/**
 * VimStatusLine — React component showing the current Vim mode.
 *
 * Listens for `vim-mode-change` custom events dispatched by the VimMode
 * extension and displays the current mode (NORMAL, INSERT, VISUAL) with
 * a colour-coded badge.
 *
 * Usage:
 * ```tsx
 * import { VimStatusLine } from '@notesaner/editor-core';
 *
 * function EditorFooter({ editor }) {
 *   return (
 *     <div className="editor-footer">
 *       <VimStatusLine editor={editor} />
 *     </div>
 *   );
 * }
 * ```
 *
 * @see libs/editor-core/src/extensions/vim-mode.ts
 */

'use client';

import { useState, useEffect, type CSSProperties } from 'react';
import type { Editor } from '@tiptap/core';
import type { VimModeType } from '../extensions/vim-mode';
import { VIM_MODE_CHANGE_EVENT } from '../extensions/vim-mode';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VimStatusLineProps {
  /** The TipTap editor instance. */
  editor: Editor | null;
  /** Additional CSS class for the outer container. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
}

// ---------------------------------------------------------------------------
// Mode display configuration
// ---------------------------------------------------------------------------

interface ModeDisplay {
  label: string;
  shortLabel: string;
  bg: string;
  color: string;
  borderColor: string;
}

const MODE_DISPLAYS: Record<VimModeType, ModeDisplay> = {
  normal: {
    label: 'NORMAL',
    shortLabel: 'N',
    bg: 'var(--ns-vim-normal-bg, #3b82f6)',
    color: 'var(--ns-vim-normal-color, #ffffff)',
    borderColor: 'var(--ns-vim-normal-border, #2563eb)',
  },
  insert: {
    label: 'INSERT',
    shortLabel: 'I',
    bg: 'var(--ns-vim-insert-bg, #10b981)',
    color: 'var(--ns-vim-insert-color, #ffffff)',
    borderColor: 'var(--ns-vim-insert-border, #059669)',
  },
  visual: {
    label: 'VISUAL',
    shortLabel: 'V',
    bg: 'var(--ns-vim-visual-bg, #8b5cf6)',
    color: 'var(--ns-vim-visual-color, #ffffff)',
    borderColor: 'var(--ns-vim-visual-border, #7c3aed)',
  },
  'visual-line': {
    label: 'V-LINE',
    shortLabel: 'VL',
    bg: 'var(--ns-vim-visual-line-bg, #a855f7)',
    color: 'var(--ns-vim-visual-line-color, #ffffff)',
    borderColor: 'var(--ns-vim-visual-line-border, #9333ea)',
  },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = {
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontFamily: 'var(--ns-font-mono, ui-monospace, monospace)',
    fontSize: '12px',
    userSelect: 'none' as const,
  } satisfies CSSProperties,

  badge: (mode: ModeDisplay): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2px 8px',
    borderRadius: '3px',
    fontWeight: 700,
    fontSize: '11px',
    letterSpacing: '0.05em',
    lineHeight: 1.4,
    backgroundColor: mode.bg,
    color: mode.color,
    border: `1px solid ${mode.borderColor}`,
    transition: 'background-color 0.15s ease, border-color 0.15s ease',
    minWidth: '60px',
    textAlign: 'center',
  }),

  vimLabel: {
    color: 'var(--ns-text-muted, #64748b)',
    fontSize: '11px',
    fontWeight: 500,
  } satisfies CSSProperties,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Displays the current Vim mode as a colour-coded status badge.
 *
 * The component renders nothing if:
 * - No editor is provided
 * - The editor does not have the VimMode extension
 * - Vim mode is disabled
 */
export function VimStatusLine({ editor, className, style }: VimStatusLineProps) {
  const [mode, setMode] = useState<VimModeType>('normal');
  const [isVimEnabled, setIsVimEnabled] = useState(false);

  useEffect(() => {
    if (!editor) return;

    // Check if VimMode extension is present and enabled
    const vimExt = editor.extensionManager.extensions.find((ext) => ext.name === 'vimMode');
    if (!vimExt) {
      setIsVimEnabled(false);
      return;
    }

    const options = vimExt.options as { enabled?: boolean };
    setIsVimEnabled(options.enabled ?? false);

    // Listen for mode change events
    const handleModeChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ mode: VimModeType }>;
      setMode(customEvent.detail.mode);
      setIsVimEnabled(true);
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener(VIM_MODE_CHANGE_EVENT, handleModeChange);

    return () => {
      editorDom.removeEventListener(VIM_MODE_CHANGE_EVENT, handleModeChange);
    };
  }, [editor]);

  // Don't render if Vim is not enabled
  if (!isVimEnabled || !editor) {
    return null;
  }

  const modeDisplay = MODE_DISPLAYS[mode] ?? MODE_DISPLAYS.normal;

  return (
    <div
      className={`ns-vim-status-line${className ? ` ${className}` : ''}`}
      style={{ ...styles.container, ...style }}
      role="status"
      aria-live="polite"
      aria-label={`Vim mode: ${modeDisplay.label}`}
    >
      <span style={styles.vimLabel}>VIM</span>
      <span style={styles.badge(modeDisplay)}>{modeDisplay.label}</span>
    </div>
  );
}

VimStatusLine.displayName = 'VimStatusLine';
