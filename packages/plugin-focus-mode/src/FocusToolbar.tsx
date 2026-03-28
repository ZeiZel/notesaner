/**
 * FocusToolbar — Minimal floating toolbar for focus mode.
 *
 * Appears on hover (when the cursor approaches the top of the viewport) or
 * when the user has text selected. Contains only essential formatting actions:
 *   Bold, Italic, Heading (H1/H2), Unordered list, Ordered list
 *
 * The toolbar also hosts the "Exit Focus Mode" button on the right side.
 *
 * In zen mode the toolbar is completely hidden.
 *
 * The toolbar communicates with the editor via a simple command interface
 * (EditorCommands) so it remains decoupled from any specific editor implementation.
 */

import React, { useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal command interface the host app injects to drive toolbar actions. */
export interface EditorCommands {
  toggleBold(): void;
  toggleItalic(): void;
  setHeading(level: 1 | 2 | 3): void;
  toggleBulletList(): void;
  toggleOrderedList(): void;
  /** Whether the given mark/node is active at the current cursor position. */
  isActive(name: string, attrs?: Record<string, unknown>): boolean;
}

export interface FocusToolbarProps {
  /** Whether focus mode is currently active (toolbar is only rendered when active). */
  isActive: boolean;
  /** When true the toolbar is completely hidden (zen mode). */
  isZenMode: boolean;
  /** Called when the user clicks the exit button. */
  onExit: () => void;
  /** Optional editor command interface. Without this, buttons are rendered disabled. */
  commands?: EditorCommands;
}

// ---------------------------------------------------------------------------
// Icons (inline SVG to avoid external icon library dependency)
// ---------------------------------------------------------------------------

function BoldIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function HeadingIcon({ level }: { level: number }): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12h16" />
      <path d="M4 5v14" />
      <path d="M12 5v14" />
      <text x="14" y="21" fontSize="8" fill="currentColor" stroke="none">
        {level}
      </text>
    </svg>
  );
}

function ListIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function OrderedListIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
    </svg>
  );
}

function ExitIcon(): React.ReactElement {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ToolbarButton
// ---------------------------------------------------------------------------

interface ToolbarButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  title,
  children,
}: ToolbarButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      aria-pressed={isActive}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '32px',
        height: '32px',
        border: 'none',
        borderRadius: '6px',
        background: isActive ? 'rgba(99,102,241,0.15)' : 'transparent',
        color: isActive ? '#6366f1' : 'var(--color-text, #374151)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        transition: 'background 0.1s, color 0.1s',
        padding: 0,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.currentTarget as HTMLButtonElement).style.background = isActive
            ? 'rgba(99,102,241,0.25)'
            : 'rgba(0,0,0,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = isActive
          ? 'rgba(99,102,241,0.15)'
          : 'transparent';
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// FocusToolbar
// ---------------------------------------------------------------------------

export function FocusToolbar({
  isActive,
  isZenMode,
  onExit,
  commands,
}: FocusToolbarProps): React.ReactElement | null {
  const [isVisible, setIsVisible] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  // Show toolbar when cursor is near the top 80px of the viewport
  const handleMouseMove = useCallback((e: MouseEvent) => {
    setIsVisible(e.clientY < 80);
  }, []);

  // Show toolbar when text is selected
  const handleSelectionChange = useCallback(() => {
    const selection = window.getSelection();
    setHasSelection(!!(selection && !selection.isCollapsed));
  }, []);

  useEffect(() => {
    if (!isActive || isZenMode) return;

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('selectionchange', handleSelectionChange);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isActive, isZenMode, handleMouseMove, handleSelectionChange]);

  if (!isActive || isZenMode) return null;

  const shouldShow = isVisible || hasSelection;
  const noCommands = !commands;

  return (
    <div
      role="toolbar"
      aria-label="Focus mode formatting toolbar"
      style={{
        position: 'fixed',
        top: 0,
        left: '50%',
        transform: `translateX(-50%) translateY(${shouldShow ? '8px' : '-56px'})`,
        transition: 'transform 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        gap: '2px',
        background: 'var(--color-bg-elevated, rgba(255,255,255,0.95))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid var(--color-border, rgba(0,0,0,0.1))',
        borderRadius: '10px',
        padding: '4px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        zIndex: 10000,
      }}
    >
      {/* Formatting buttons */}
      <ToolbarButton
        onClick={() => commands?.toggleBold()}
        isActive={!noCommands && commands.isActive('bold')}
        disabled={noCommands}
        title="Bold (Ctrl+B)"
      >
        <BoldIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => commands?.toggleItalic()}
        isActive={!noCommands && commands.isActive('italic')}
        disabled={noCommands}
        title="Italic (Ctrl+I)"
      >
        <ItalicIcon />
      </ToolbarButton>

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--color-border, #e2e8f0)',
          margin: '0 4px',
        }}
        aria-hidden="true"
      />

      <ToolbarButton
        onClick={() => commands?.setHeading(1)}
        isActive={!noCommands && commands.isActive('heading', { level: 1 })}
        disabled={noCommands}
        title="Heading 1"
      >
        <HeadingIcon level={1} />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => commands?.setHeading(2)}
        isActive={!noCommands && commands.isActive('heading', { level: 2 })}
        disabled={noCommands}
        title="Heading 2"
      >
        <HeadingIcon level={2} />
      </ToolbarButton>

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--color-border, #e2e8f0)',
          margin: '0 4px',
        }}
        aria-hidden="true"
      />

      <ToolbarButton
        onClick={() => commands?.toggleBulletList()}
        isActive={!noCommands && commands.isActive('bulletList')}
        disabled={noCommands}
        title="Bullet list"
      >
        <ListIcon />
      </ToolbarButton>

      <ToolbarButton
        onClick={() => commands?.toggleOrderedList()}
        isActive={!noCommands && commands.isActive('orderedList')}
        disabled={noCommands}
        title="Ordered list"
      >
        <OrderedListIcon />
      </ToolbarButton>

      {/* Spacer */}
      <div style={{ flex: 1, minWidth: '16px' }} aria-hidden="true" />

      {/* Divider */}
      <div
        style={{
          width: '1px',
          height: '20px',
          background: 'var(--color-border, #e2e8f0)',
          margin: '0 4px',
        }}
        aria-hidden="true"
      />

      {/* Exit button */}
      <ToolbarButton onClick={onExit} title="Exit focus mode (Esc)">
        <ExitIcon />
      </ToolbarButton>
    </div>
  );
}
