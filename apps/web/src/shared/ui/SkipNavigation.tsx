/**
 * SkipNavigation — "Skip to main content" link for keyboard/screen-reader users.
 *
 * WCAG 2.1 SC 2.4.1 (Bypass Blocks — Level A) requires a mechanism to skip
 * repetitive navigation. This component renders a visually-hidden link that
 * becomes visible on focus (Tab key), allowing users to jump directly to
 * the main content area.
 *
 * Usage:
 *   1. Place <SkipNavigation /> as the first child inside <body> (root layout).
 *   2. Ensure the target element has id="main-content".
 *      The WorkspaceShell and public layout <main> tags should include this ID.
 *
 * @module shared/lib/SkipNavigation
 */

'use client';

/**
 * Props for SkipNavigation.
 */
interface SkipNavigationProps {
  /** Target element ID to jump to. Defaults to "main-content". */
  targetId?: string;
  /** Label text shown to screen readers and on focus. */
  label?: string;
}

export function SkipNavigation({
  targetId = 'main-content',
  label = 'Skip to main content',
}: SkipNavigationProps) {
  return (
    <a
      href={`#${targetId}`}
      className="skip-nav-link"
      // Inline styles as fallback in case the CSS class is not yet loaded.
      // The CSS class in main.css provides the final styling.
    >
      {label}
    </a>
  );
}

SkipNavigation.displayName = 'SkipNavigation';
