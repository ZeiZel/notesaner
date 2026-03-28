/**
 * Content script helpers for the web clipper browser extension.
 *
 * These functions run in the context of the browser tab (content script)
 * and are responsible for:
 * - Extracting selected HTML from the page
 * - Getting the full page HTML
 * - Reading Open Graph and meta tag metadata
 * - Providing a placeholder for screenshot capture (requires background script)
 *
 * NOTE: These helpers depend on the browser DOM APIs. In a real extension,
 * they are injected into page context via the manifest content_scripts config.
 * The functions are also exported for unit testing with a simulated DOM.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PageMetadata {
  /** Page title from <title> or og:title. */
  title: string;
  /** Canonical URL from <link rel="canonical"> or og:url, or window.location.href. */
  url: string;
  /** Author from meta author or article:author. */
  author: string | null;
  /** Publication date from article:published_time or similar. */
  publishedDate: string | null;
  /** Site name from og:site_name. */
  siteName: string | null;
  /** Meta description or og:description. */
  description: string | null;
  /** Open Graph image URL. */
  ogImage: string | null;
}

// ---------------------------------------------------------------------------
// HTML extraction
// ---------------------------------------------------------------------------

/**
 * Returns the HTML of the user's current selection, or an empty string when
 * nothing is selected.
 *
 * Wraps the selected content in a temporary container to obtain its
 * outerHTML without modifying the page.
 */
export function getSelectedHTML(): string {
  if (typeof window === 'undefined') return '';

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
    return '';
  }

  const range = selection.getRangeAt(0);
  const fragment = range.cloneContents();
  const container = document.createElement('div');
  container.appendChild(fragment);
  return container.innerHTML;
}

/**
 * Returns the full HTML of the page's <body> element.
 * Falls back to `document.documentElement.outerHTML` when body is absent.
 */
export function getPageHTML(): string {
  if (typeof document === 'undefined') return '';
  return document.body?.innerHTML ?? document.documentElement.outerHTML;
}

/**
 * Returns the full outer HTML of the page, including <html>, <head>, and <body>.
 * Used by the readability extractor which needs access to <head> meta tags.
 */
export function getFullPageHTML(): string {
  if (typeof document === 'undefined') return '';
  return document.documentElement.outerHTML;
}

// ---------------------------------------------------------------------------
// Metadata extraction
// ---------------------------------------------------------------------------

/**
 * Reads page metadata from Open Graph meta tags, standard meta tags,
 * and <title> / <link> elements in the document <head>.
 *
 * Safe to call with a simulated `document` object in tests.
 */
export function getPageMetadata(): PageMetadata {
  if (typeof document === 'undefined') {
    return {
      title: '',
      url: '',
      author: null,
      publishedDate: null,
      siteName: null,
      description: null,
      ogImage: null,
    };
  }

  const getMeta = (selector: string): string | null => {
    const el = document.querySelector<HTMLMetaElement>(selector);
    return el?.content ?? null;
  };

  const title =
    getMeta('meta[property="og:title"]') ??
    getMeta('meta[name="twitter:title"]') ??
    document.title ??
    '';

  const url =
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ??
    getMeta('meta[property="og:url"]') ??
    (typeof window !== 'undefined' ? window.location.href : '');

  const author =
    getMeta('meta[name="author"]') ??
    getMeta('meta[property="article:author"]') ??
    document.querySelector<HTMLElement>('[rel="author"], .author, .byline')?.textContent?.trim() ??
    null;

  const publishedDate =
    getMeta('meta[property="article:published_time"]') ??
    getMeta('meta[property="og:published_time"]') ??
    getMeta('meta[name="publish-date"]') ??
    getMeta('meta[name="date"]') ??
    document.querySelector<HTMLTimeElement>('time[datetime]')?.getAttribute('datetime') ??
    null;

  const siteName = getMeta('meta[property="og:site_name"]') ?? null;

  const description =
    getMeta('meta[property="og:description"]') ??
    getMeta('meta[name="description"]') ??
    getMeta('meta[name="twitter:description"]') ??
    null;

  const ogImage =
    getMeta('meta[property="og:image"]') ?? getMeta('meta[name="twitter:image"]') ?? null;

  return { title, url, author, publishedDate, siteName, description, ogImage };
}

// ---------------------------------------------------------------------------
// Screenshot placeholder
// ---------------------------------------------------------------------------

/**
 * Requests a screenshot of the current visible tab.
 *
 * In a real Chrome extension, this must be delegated to the background
 * service worker via `chrome.runtime.sendMessage` because `captureVisibleTab`
 * is only available in the background context.
 *
 * This function sends a message to the background script and awaits the
 * base64-encoded PNG data URL in the response.
 *
 * @returns Base64 data URL of the screenshot, or null if unavailable.
 */
export async function captureVisibleTab(): Promise<string | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage) {
    // Not in an extension context — return null gracefully
    return null;
  }

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: 'CAPTURE_SCREENSHOT' },
      (response: { dataUrl?: string } | undefined) => {
        if (chrome.runtime.lastError || !response) {
          resolve(null);
          return;
        }
        resolve(response.dataUrl ?? null);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// Type declaration for chrome extension APIs (browser extension context only)
// ---------------------------------------------------------------------------

declare const chrome: {
  runtime: {
    sendMessage(
      message: { type: string },
      callback: (response: { dataUrl?: string } | undefined) => void,
    ): void;
    lastError: { message: string } | undefined;
  };
};
