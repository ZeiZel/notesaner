'use client';

/**
 * FocusMode — distraction-free writing overlay.
 *
 * When active, covers the entire viewport with a solid background, hiding the
 * sidebar, tab bar, status bar, and all other workspace chrome. The writing
 * area is centered with a comfortable max-width.
 *
 * Features:
 *   - Full-screen overlay (fixed position, z-index above everything)
 *   - Centered writing area with configurable max-width (prose)
 *   - Typewriter scrolling: active cursor line stays vertically centered
 *   - Ambient sounds toggle (UI only — audio integration deferred)
 *   - Live word count display
 *   - Exit via Esc key OR the exit button
 *
 * Keyboard shortcuts:
 *   - Ctrl+Shift+F (Cmd+Shift+F on macOS): toggle focus mode (global)
 *   - Esc: exit focus mode (local keydown on the overlay)
 *
 * State:
 *   - Business state (isFocusMode, typewriterScrolling, ambientSoundsEnabled)
 *     lives in `useFocusModeStore`.
 *   - UI state (toolbar visibility timeout) uses `useState`.
 *
 * Ant Design components used:
 *   - Tooltip: keyboard shortcut hints on icon buttons
 *   - Button: icon buttons in the floating toolbar
 *   - Typography.Text: word count display
 *
 * Layout:
 *   - Box (Ant Design Flex) for flex containers
 *   - Tailwind utility classes for spacing, color, and transitions
 *   - cn() for conditional class composition
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Tooltip, Button, Flex, Typography } from 'antd';
import { cn } from '@notesaner/ui';
import { useFocusModeStore } from '../model/focus-mode-store';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Counts words in a markdown string.
 * Strips markdown syntax before counting to give an accurate prose word count.
 */
function countWords(text: string): number {
  if (!text.trim()) return 0;
  // Remove common markdown syntax tokens before splitting
  const stripped = text
    .replace(/#{1,6}\s/g, '') // headings
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // bold / italic
    .replace(/`{1,3}[^`]+`{1,3}/g, '') // inline code / fenced blocks
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links — keep label text
    .replace(/^[-*+]\s/gm, '') // unordered list markers
    .replace(/^\d+\.\s/gm, '') // ordered list markers
    .replace(/^>\s/gm, '') // blockquotes
    .replace(/---+/g, '') // horizontal rules
    .trim();

  if (!stripped) return 0;
  return stripped.split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ExitIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function TypewriterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M2 5h12v1H2V5zm0 2h12v1H2V7zm0 2h7v1H2V9zm0 3h12v.5H2V12z" />
      <path d="M8 1l2 2H6l2-2z" />
    </svg>
  );
}

function SoundIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8.5 2.134a.5.5 0 00-.5.05L4.5 5H2.5a1 1 0 00-1 1v4a1 1 0 001 1H4.5l3.5 2.816a.5.5 0 00.5.05.5.5 0 00.5-.45V2.584a.5.5 0 00-.5-.45z" />
      <path d="M10.121 4.88a.5.5 0 00-.707.707A3.5 3.5 0 0110.5 8a3.5 3.5 0 01-1.086 2.536.5.5 0 00.7.714A4.5 4.5 0 0011.5 8a4.5 4.5 0 00-1.379-3.12z" />
      <path d="M11.536 3.464a.5.5 0 00-.707.707A5.5 5.5 0 0112.5 8a5.5 5.5 0 01-1.671 3.929.5.5 0 00.706.706A6.5 6.5 0 0013.5 8a6.5 6.5 0 00-1.964-4.536z" />
    </svg>
  );
}

function SoundOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M8.5 2.134a.5.5 0 00-.5.05L4.5 5H2.5a1 1 0 00-1 1v4a1 1 0 001 1H4.5l3.5 2.816a.5.5 0 00.5.05.5.5 0 00.5-.45V2.584a.5.5 0 00-.5-.45z" />
      <path d="M13.354 6.146a.5.5 0 00-.708.708L13.793 8l-1.147 1.146a.5.5 0 00.708.708L14.5 8.707l1.146 1.147a.5.5 0 00.708-.708L15.207 8l1.147-1.146a.5.5 0 00-.708-.708L14.5 7.293l-1.146-1.147z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Floating toolbar
// ---------------------------------------------------------------------------

interface FocusModeToolbarProps {
  wordCount: number;
  typewriterScrolling: boolean;
  ambientSoundsEnabled: boolean;
  onToggleTypewriter: () => void;
  onToggleAmbientSounds: () => void;
  onExit: () => void;
  visible: boolean;
}

function FocusModeToolbar({
  wordCount,
  typewriterScrolling,
  ambientSoundsEnabled,
  onToggleTypewriter,
  onToggleAmbientSounds,
  onExit,
  visible,
}: FocusModeToolbarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Focus mode controls"
      className={cn(
        'fixed bottom-6 left-1/2 z-[60] -translate-x-1/2',
        'flex items-center gap-1 rounded-full px-3 py-1.5',
        'border border-[var(--ns-color-border)]',
        'bg-[var(--ns-color-background-surface)]/90 backdrop-blur-sm',
        'shadow-[var(--ns-shadow-md)]',
        'transition-opacity duration-300',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
      )}
    >
      {/* Word count */}
      <Text
        className="select-none px-1 text-xs text-[var(--ns-color-foreground-muted)]"
        aria-live="polite"
        aria-label={`${wordCount} words`}
      >
        {wordCount} {wordCount === 1 ? 'word' : 'words'}
      </Text>

      <div className="mx-1 h-4 w-px bg-[var(--ns-color-border)]" aria-hidden="true" />

      {/* Typewriter scrolling toggle */}
      <Tooltip
        title={typewriterScrolling ? 'Disable typewriter scrolling' : 'Enable typewriter scrolling'}
        placement="top"
      >
        <Button
          type={typewriterScrolling ? 'primary' : 'text'}
          size="small"
          shape="circle"
          onClick={onToggleTypewriter}
          aria-label={
            typewriterScrolling
              ? 'Typewriter scrolling enabled. Click to disable.'
              : 'Typewriter scrolling disabled. Click to enable.'
          }
          aria-pressed={typewriterScrolling}
          icon={<TypewriterIcon className="h-3.5 w-3.5" />}
        />
      </Tooltip>

      {/* Ambient sounds toggle */}
      <Tooltip
        title={ambientSoundsEnabled ? 'Disable ambient sounds' : 'Enable ambient sounds'}
        placement="top"
      >
        <Button
          type={ambientSoundsEnabled ? 'primary' : 'text'}
          size="small"
          shape="circle"
          onClick={onToggleAmbientSounds}
          aria-label={
            ambientSoundsEnabled
              ? 'Ambient sounds enabled. Click to disable.'
              : 'Ambient sounds disabled. Click to enable.'
          }
          aria-pressed={ambientSoundsEnabled}
          icon={
            ambientSoundsEnabled ? (
              <SoundIcon className="h-3.5 w-3.5" />
            ) : (
              <SoundOffIcon className="h-3.5 w-3.5" />
            )
          }
        />
      </Tooltip>

      <div className="mx-1 h-4 w-px bg-[var(--ns-color-border)]" aria-hidden="true" />

      {/* Exit button */}
      <Tooltip title="Exit focus mode (Esc)" placement="top">
        <Button
          type="text"
          size="small"
          shape="circle"
          onClick={onExit}
          aria-label="Exit focus mode"
          icon={<ExitIcon className="h-3.5 w-3.5" />}
        />
      </Tooltip>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FocusModeButton — toolbar button used in the editor header
// ---------------------------------------------------------------------------

export interface FocusModeButtonProps {
  /** Additional CSS class names. */
  className?: string;
}

/**
 * A small toggle button rendered in the editor toolbar.
 * Clicking it calls `toggleFocusMode` on the store.
 */
export function FocusModeButton({ className }: FocusModeButtonProps) {
  const isFocusMode = useFocusModeStore((s) => s.isFocusMode);
  const toggleFocusMode = useFocusModeStore((s) => s.toggleFocusMode);

  return (
    <Tooltip
      title={isFocusMode ? 'Exit focus mode (Ctrl+Shift+F)' : 'Enter focus mode (Ctrl+Shift+F)'}
      placement="bottom"
    >
      <Button
        type={isFocusMode ? 'primary' : 'text'}
        size="small"
        onClick={toggleFocusMode}
        aria-label={isFocusMode ? 'Exit focus mode' : 'Enter focus mode'}
        aria-pressed={isFocusMode}
        className={className}
        icon={
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M1.5 1h4v1.5h-2.5v2.5H1.5V1zm9 0h4v4h-1.5V2.5H10.5V1zM1.5 10.5H3V13h2.5v1.5h-4v-4zm11 2.5h-2.5V14.5H14.5v-4H13v2.5z" />
          </svg>
        }
      >
        <span className="hidden sm:inline">Focus</span>
      </Button>
    </Tooltip>
  );
}

FocusModeButton.displayName = 'FocusModeButton';

// ---------------------------------------------------------------------------
// FocusMode — full-screen overlay
// ---------------------------------------------------------------------------

export interface FocusModeProps {
  /**
   * The markdown content to use for word counting.
   * Passed from the parent editor surface.
   */
  content?: string;
  /**
   * The editor content area rendered inside the focus mode overlay.
   * Use this to render the actual editor (TipTap, CodeMirror, etc.)
   * inside the distraction-free surface.
   */
  children?: React.ReactNode;
  /** Additional CSS class names applied to the overlay root. */
  className?: string;
}

/**
 * Full-screen focus mode overlay.
 *
 * Mount this component unconditionally alongside the normal editor surface.
 * It only renders its content when `isFocusMode` is true. The component
 * handles:
 *   - Esc key to exit
 *   - Auto-hiding toolbar after 2.5s of inactivity (reveals on mouse move)
 *   - Typewriter scrolling CSS class propagation to the inner editor
 *   - Word count derived from the passed `content` prop
 */
export function FocusMode({ content = '', children, className }: FocusModeProps) {
  const isFocusMode = useFocusModeStore((s) => s.isFocusMode);
  const exitFocusMode = useFocusModeStore((s) => s.exitFocusMode);
  const typewriterScrolling = useFocusModeStore((s) => s.typewriterScrolling);
  const ambientSoundsEnabled = useFocusModeStore((s) => s.ambientSoundsEnabled);
  const toggleTypewriterScrolling = useFocusModeStore((s) => s.toggleTypewriterScrolling);
  const toggleAmbientSounds = useFocusModeStore((s) => s.toggleAmbientSounds);

  // UI state: toolbar auto-hide
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = countWords(content);

  // Show toolbar, then auto-hide after 2.5s of inactivity
  const showToolbarTemporarily = useCallback(() => {
    setToolbarVisible(true);
    if (hideTimerRef.current !== null) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      setToolbarVisible(false);
    }, 2500);
  }, []);

  // Start the auto-hide timer when focus mode becomes active
  useEffect(() => {
    if (!isFocusMode) {
      setToolbarVisible(true);
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = null;
      }
      return;
    }
    showToolbarTemporarily();
    return () => {
      if (hideTimerRef.current !== null) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [isFocusMode, showToolbarTemporarily]);

  // Handle Esc key to exit
  useEffect(() => {
    if (!isFocusMode) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitFocusMode();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusMode, exitFocusMode]);

  if (!isFocusMode) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Focus mode — distraction-free writing"
      className={cn(
        'fixed inset-0 z-50 flex flex-col',
        'bg-[var(--ns-color-background)] text-[var(--ns-color-foreground)]',
        className,
      )}
      onMouseMove={showToolbarTemporarily}
      data-testid="focus-mode-overlay"
    >
      {/* Scrollable writing area */}
      <div
        className={cn(
          'flex flex-1 flex-col items-center overflow-y-auto',
          typewriterScrolling && 'focus-mode--typewriter',
        )}
        data-testid="focus-mode-content"
      >
        {/* Centered prose container */}
        <Flex
          vertical
          className="w-full max-w-[72ch] flex-1 px-6 py-16"
          data-testid="focus-mode-writing-area"
        >
          {children}
        </Flex>
      </div>

      {/* Floating bottom toolbar — auto-hides */}
      <FocusModeToolbar
        wordCount={wordCount}
        typewriterScrolling={typewriterScrolling}
        ambientSoundsEnabled={ambientSoundsEnabled}
        onToggleTypewriter={toggleTypewriterScrolling}
        onToggleAmbientSounds={toggleAmbientSounds}
        onExit={exitFocusMode}
        visible={toolbarVisible}
      />
    </div>
  );
}

FocusMode.displayName = 'FocusMode';
