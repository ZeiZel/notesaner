'use client';

/**
 * CopyButton — Reusable copy-to-clipboard button with animated feedback.
 *
 * Features:
 *   - Animated icon transition: clipboard -> checkmark on success
 *   - Configurable size and variant (icon-only, with label)
 *   - Accessible: aria-label, role, live region for screen readers
 *   - Inline toast: brief "Copied!" label that fades after 2s
 *   - Works standalone (internal state) or controlled (external copied prop)
 *
 * The component manages its own clipboard interaction. Pass `value` for plain
 * text, or `onCopy` for custom copy logic (e.g. rich text, code blocks).
 */

import * as React from 'react';
import { cn } from '../lib/cn';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CopyButtonProps {
  /** The text value to copy. Ignored when `onCopy` is provided. */
  value?: string;

  /**
   * Custom copy handler. When provided, the component calls this instead
   * of using the built-in clipboard write. Must return a boolean or Promise<boolean>.
   */
  onCopy?: () => boolean | Promise<boolean>;

  /**
   * External controlled "copied" state. When provided, the component
   * skips its internal timer and reflects this value directly.
   */
  copied?: boolean;

  /**
   * Duration in ms before the success state resets (only in uncontrolled mode).
   * @default 2000
   */
  resetMs?: number;

  /**
   * Visual variant.
   * - 'icon'  — icon-only, compact (default)
   * - 'label' — icon + "Copy"/"Copied!" text
   */
  variant?: 'icon' | 'label';

  /**
   * Size of the icon.
   * @default 16
   */
  size?: number;

  /** Additional CSS classes. */
  className?: string;

  /** Accessible label override. */
  'aria-label'?: string;

  /** Whether the button is disabled. */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function CopyButtonImpl(
  {
    value,
    onCopy,
    copied: controlledCopied,
    resetMs = 2000,
    variant = 'icon',
    size = 16,
    className,
    'aria-label': ariaLabel,
    disabled = false,
  }: CopyButtonProps,
  ref: React.ForwardedRef<HTMLButtonElement>,
) {
  const [internalCopied, setInternalCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isControlled = controlledCopied !== undefined;
  const isCopied = isControlled ? controlledCopied : internalCopied;

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  async function handleClick() {
    if (disabled || isCopied) return;

    let success = false;

    if (onCopy) {
      success = await Promise.resolve(onCopy());
    } else if (value !== undefined) {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(value);
          success = true;
        } else {
          success = fallbackCopy(value);
        }
      } catch {
        success = fallbackCopy(value);
      }
    }

    if (success && !isControlled) {
      setInternalCopied(true);
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        setInternalCopied(false);
        timeoutRef.current = null;
      }, resetMs);
    }
  }

  const label = ariaLabel ?? (isCopied ? 'Copied' : 'Copy to clipboard');

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'inline-flex items-center justify-center gap-1.5',
        'rounded-md transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:pointer-events-none disabled:opacity-50',
        variant === 'icon' ? 'h-7 w-7 hover:bg-muted/50' : 'h-7 px-2 text-xs hover:bg-muted/50',
        isCopied
          ? 'text-green-600 dark:text-green-400'
          : 'text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {/* Animated icon: crossfade between clipboard and check */}
      <span className="relative" style={{ width: size, height: size }} aria-hidden="true">
        {/* Clipboard icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'absolute inset-0 transition-all duration-200',
            isCopied ? 'opacity-0 scale-50' : 'opacity-100 scale-100',
          )}
          width={size}
          height={size}
        >
          <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>

        {/* Checkmark icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(
            'absolute inset-0 transition-all duration-200',
            isCopied ? 'opacity-100 scale-100' : 'opacity-0 scale-50',
          )}
          width={size}
          height={size}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>

      {/* Label text */}
      {variant === 'label' && <span className="select-none">{isCopied ? 'Copied!' : 'Copy'}</span>}

      {/* Screen reader live region */}
      {isCopied && (
        <span className="sr-only" role="status" aria-live="polite">
          Copied to clipboard
        </span>
      )}
    </button>
  );
}

/**
 * Fallback clipboard write for browsers without Clipboard API.
 */
function fallbackCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }

  document.body.removeChild(textarea);
  return success;
}

export const CopyButton = React.forwardRef(CopyButtonImpl);
CopyButton.displayName = 'CopyButton';
