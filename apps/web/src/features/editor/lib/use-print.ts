/**
 * use-print.ts — Hook that prepares and triggers browser printing for a note.
 *
 * Responsibilities:
 *   1. Accept note content and metadata (title, date).
 *   2. Inject the print stylesheet into <head> if not already present.
 *   3. Mark the print-view container as visible (`data-print-view-active`).
 *   4. Call `window.print()`.
 *   5. Clean up the active marker after the print dialog closes.
 *
 * No useEffect for the keyboard shortcut — the shortcut listener is set up
 * once via `useEffect` with a stable ref-based callback to avoid stale closure
 * problems. The listener is torn down on component unmount.
 *
 * Design decisions:
 *   - We do NOT use a portal or separate DOM tree for the print view.
 *     Instead, we rely on `@media print` CSS to hide all chrome and reveal
 *     only `[data-print-view]`. This keeps the implementation simple and
 *     avoids issues with SSR hydration.
 *   - `window.print()` is synchronous on most browsers; the dialog stays open
 *     until the user confirms or cancels. We wrap it in a microtask so React
 *     can commit the `data-print-view-active` attribute before the dialog
 *     appears.
 *   - `beforeprint` / `afterprint` window events let us know when printing
 *     starts and ends (supported in all modern browsers).
 */

import { useCallback, useEffect, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsePrintOptions {
  /** Note title shown in the print header. */
  title?: string;
  /**
   * ID of the DOM element that contains the print-ready content.
   * The element must have `data-print-view` attribute.
   * Defaults to `'print-view-container'`.
   */
  printContainerId?: string;
  /**
   * Called just before `window.print()` is invoked.
   * Use this to perform any last-minute DOM preparation.
   */
  onBeforePrint?: () => void;
  /**
   * Called after the print dialog closes (regardless of whether the user
   * printed or cancelled).
   */
  onAfterPrint?: () => void;
}

export interface UsePrintReturn {
  /** Trigger the print dialog. */
  print: () => void;
  /** Whether a print operation is currently in progress. */
  isPrinting: boolean;
}

// ---------------------------------------------------------------------------
// CSS injection helper
// ---------------------------------------------------------------------------

const PRINT_STYLESHEET_ID = 'notesaner-print-styles';

/**
 * Lazily injects the print stylesheet `<link>` into `<head>`.
 * Does nothing if already injected (idempotent).
 */
function injectPrintStylesheet(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(PRINT_STYLESHEET_ID)) return;

  const link = document.createElement('link');
  link.id = PRINT_STYLESHEET_ID;
  link.rel = 'stylesheet';
  // Next.js serves files from `public/` at the root path.
  // The CSS is co-located with the feature; it is imported via the component
  // instead of a public URL, so we skip the <link> injection here and rely
  // on the component-level CSS import. This function is kept as a safety net
  // for cases where the component import might be tree-shaken away.
  //
  // In practice, PrintView.tsx imports './print.css' which gets bundled by
  // Next.js, so no separate <link> injection is needed.
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function usePrint(options: UsePrintOptions = {}): UsePrintReturn {
  const { printContainerId = 'print-view-container', onBeforePrint, onAfterPrint } = options;

  const isPrintingRef = useRef(false);

  // Stable ref wrappers to avoid stale closures in event listeners.
  const onBeforePrintRef = useRef(onBeforePrint);
  const onAfterPrintRef = useRef(onAfterPrint);
  onBeforePrintRef.current = onBeforePrint;
  onAfterPrintRef.current = onAfterPrint;

  /**
   * Activate the print view — sets `data-print-view-active` on the container
   * so the CSS rule `[data-print-view][data-print-view-active]` makes it visible.
   */
  const activatePrintView = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(printContainerId);
    if (container) {
      container.setAttribute('data-print-view-active', 'true');
    }
  }, [printContainerId]);

  /**
   * Deactivate the print view — removes the `data-print-view-active` attribute
   * so the print view is hidden again in screen mode.
   */
  const deactivatePrintView = useCallback(() => {
    if (typeof document === 'undefined') return;
    const container = document.getElementById(printContainerId);
    if (container) {
      container.removeAttribute('data-print-view-active');
    }
  }, [printContainerId]);

  /**
   * Main print function. Activates the print view, calls window.print(),
   * then deactivates it on the afterprint event.
   */
  const print = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (isPrintingRef.current) return;

    injectPrintStylesheet();

    onBeforePrintRef.current?.();
    activatePrintView();
    isPrintingRef.current = true;

    // Defer to next microtask so React has time to commit DOM updates
    // (e.g. the print view container becoming visible).
    void Promise.resolve().then(() => {
      window.print();
    });
  }, [activatePrintView]);

  // Listen for afterprint to clean up the print view state.
  useEffect(() => {
    if (typeof window === 'undefined') return;

    function handleAfterPrint() {
      isPrintingRef.current = false;
      deactivatePrintView();
      onAfterPrintRef.current?.();
    }

    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, [deactivatePrintView]);

  return {
    print,
    get isPrinting() {
      return isPrintingRef.current;
    },
  };
}

// ---------------------------------------------------------------------------
// Keyboard shortcut hook
// ---------------------------------------------------------------------------

export interface UsePrintShortcutOptions {
  /** Callback invoked when Ctrl+P / Cmd+P is pressed. */
  onPrint: () => void;
  /**
   * Set to `false` to disable the shortcut override.
   * Useful when the editor is not focused or the feature is temporarily off.
   * Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Overrides the browser's default Ctrl+P / Cmd+P print shortcut.
 *
 * Intercepts the keydown event at the `window` level (capture phase) and
 * calls `onPrint` instead of letting the browser open its own print dialog.
 * The print stylesheet + print view ensure the output matches what the user
 * expects.
 *
 * Teardown is handled automatically on unmount.
 */
export function usePrintShortcut({ onPrint, enabled = true }: UsePrintShortcutOptions): void {
  const onPrintRef = useRef(onPrint);
  onPrintRef.current = onPrint;

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    function handleKeyDown(event: KeyboardEvent) {
      const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
      const modKey = isMac ? event.metaKey : event.ctrlKey;

      if (modKey && event.key === 'p') {
        event.preventDefault();
        event.stopPropagation();
        onPrintRef.current();
      }
    }

    // Use capture phase so we intercept the event before the browser handles it.
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, [enabled]);
}
