'use client';

/**
 * CssSnippetInjector -- Injects workspace CSS snippets into the document head.
 *
 * This component renders nothing visible; it manages a <style> element
 * in the document head that contains the combined CSS from all enabled
 * workspace snippets.
 *
 * Uses useEffect to manage the DOM <style> element -- this is a valid
 * use case since we are synchronizing with an external system (the DOM
 * <head> element) that is not controlled by React.
 *
 * Security: All CSS is sanitized via the css-sanitizer utility before
 * injection. @import and url() are stripped.
 */

import { useEffect, useRef } from 'react';
import { combineSnippets } from '@/shared/lib/css-sanitizer';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WORKSPACE_SNIPPETS_STYLE_ID = 'notesaner-workspace-snippets';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CssSnippetInjectorProps {
  /** Array of CSS snippets from workspace settings. */
  snippets: { id: string; name: string; css: string; enabled: boolean }[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CssSnippetInjector({ snippets }: CssSnippetInjectorProps) {
  const styleRef = useRef<HTMLStyleElement | null>(null);

  useEffect(() => {
    // Create or find the style element
    let styleEl = document.getElementById(WORKSPACE_SNIPPETS_STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = WORKSPACE_SNIPPETS_STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleRef.current = styleEl;

    // Combine and sanitize all enabled snippets
    const { css } = combineSnippets(snippets);
    styleEl.textContent = css;

    // Cleanup on unmount
    return () => {
      styleEl?.remove();
      styleRef.current = null;
    };
  }, [snippets]);

  return null;
}
