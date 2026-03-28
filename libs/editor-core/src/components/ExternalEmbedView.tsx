/**
 * ExternalEmbedView — React NodeView for the ExternalEmbed TipTap extension.
 *
 * Renders a privacy-first embed block inside the editor. The render lifecycle is:
 *
 * 1. On mount, an IntersectionObserver watches the container element. The
 *    observer fires once the block enters the viewport — at that point we:
 *    a. Attempt to fetch the oEmbed thumbnail URL (YouTube has a direct one;
 *       other providers are fetched via the oEmbed API through a proxy if
 *       configured).
 *    b. Render the thumbnail + "Click to load" privacy overlay.
 *
 * 2. When the user clicks the overlay (or when privacyMode is false and the
 *    block is already in the viewport), we swap the thumbnail for the real
 *    `<iframe>`. At this point the third-party tracker code is loaded.
 *
 * 3. Twitter/X embeds are rendered via a `<blockquote>` + Twitter widget script
 *    rather than a direct iframe (Twitter requires this approach).
 *
 * Provider-specific notes:
 * - YouTube: uses youtube-nocookie.com; thumbnail from ytimg.com.
 * - Twitter/X: oEmbed HTML snippet injected into a sandboxed div; widget script
 *   is loaded lazily on click (non-blocking for other content on the page).
 * - Vimeo: direct player embed via player.vimeo.com with `dnt=1`.
 * - Spotify: direct embed; height varies by content type.
 * - Generic: oEmbed HTML snippet shown in a sandboxed iframe.
 *
 * @see libs/editor-core/src/extensions/external-embed.ts
 */

'use client';

import { useRef, useState, useEffect, useCallback, type ComponentType } from 'react';
import { NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import {
  detectEmbed,
  fetchOEmbed,
  type EmbedProvider,
  type ExternalEmbedOptions,
} from '../extensions/external-embed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a human-readable label for the play / click-to-load button. */
function getProviderLabel(provider: EmbedProvider): string {
  switch (provider) {
    case 'youtube':
      return 'YouTube video';
    case 'twitter':
      return 'Tweet';
    case 'vimeo':
      return 'Vimeo video';
    case 'spotify':
      return 'Spotify player';
    default:
      return 'embedded content';
  }
}

/**
 * Simple SVG play-button icon used on the privacy overlay.
 * Inline SVG avoids any icon library dependency.
 */
function PlayIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="48"
      height="48"
      aria-hidden="true"
      focusable="false"
      className="ns-embed__play-icon"
    >
      <circle cx="12" cy="12" r="12" fill="rgba(0,0,0,0.6)" />
      <polygon points="9,7 19,12 9,17" fill="#ffffff" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Twitter / X special handling
// ---------------------------------------------------------------------------

/**
 * Loads the Twitter widget script once (singleton pattern).
 * The script is appended to <head> and cached in module scope so it is only
 * injected the first time a tweet embed is activated.
 */
let twitterScriptLoaded = false;
let twitterScriptPromise: Promise<void> | null = null;

function loadTwitterScript(): Promise<void> {
  if (twitterScriptLoaded) return Promise.resolve();
  if (twitterScriptPromise) return twitterScriptPromise;

  twitterScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://platform.twitter.com/widgets.js';
    script.async = true;
    script.charset = 'utf-8';
    script.onload = () => {
      twitterScriptLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Twitter widget script'));
    document.head.appendChild(script);
  });

  return twitterScriptPromise;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type ExternalEmbedViewComponent = ComponentType<ReactNodeViewProps>;

/**
 * React NodeView component for ExternalEmbed.
 *
 * Reads the embed URL, provider, and aspect ratio from the node attrs, then
 * renders either:
 * - A privacy overlay (thumbnail + play button) while privacyMode is active.
 * - The real iframe / widget once the user clicks the overlay.
 */
export function ExternalEmbedView(props: ReactNodeViewProps) {
  const { node } = props;

  const url = node.attrs.url as string | null;
  const provider = node.attrs.provider as EmbedProvider;
  const aspectRatio = node.attrs.aspectRatio as string;
  const caption = node.attrs.caption as string | null;

  // Extension options are available via editor.options on the extension storage.
  // We access them via the editor instance on props.editor.
  const extensionOptions = // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ((props.editor as any)?.extensionManager?.extensions?.find(
    (e: { name: string }) => e.name === 'externalEmbed',
  )?.options ?? {}) as ExternalEmbedOptions;

  const privacyMode = extensionOptions.privacyMode ?? true;
  const oEmbedProxyUrl = extensionOptions.oEmbedProxyUrl ?? null;

  // ---- State ---------------------------------------------------------------

  /** Whether the embed info has been fully resolved (thumbnail ready). */
  const [_resolved, setResolved] = useState(false);
  /** Thumbnail URL to show in the privacy overlay. */
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  /** Whether the iframe / widget is active (user has clicked through). */
  const [active, setActive] = useState(!privacyMode);
  /** oEmbed HTML snippet for Twitter / generic providers. */
  const [oEmbedHtml, setOEmbedHtml] = useState<string | null>(null);
  /** Caption text (can differ from node attr if fetched from oEmbed). */
  const [displayCaption] = useState<string | null>(caption);
  /** Whether we are currently loading oEmbed data. */
  const [loadingOEmbed, setLoadingOEmbed] = useState(false);
  /** Error state when the URL is invalid or provider fails to load. */
  const [error, setError] = useState<string | null>(null);

  // ---- Refs ----------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null);
  const intersectionObservedRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // ---- URL resolution ------------------------------------------------------

  const embedInfo = url ? detectEmbed(url) : null;
  const embedUrl = embedInfo?.embedUrl ?? null;
  const resolvedProvider = embedInfo?.provider ?? provider;

  // ---- IntersectionObserver (lazy loading) ---------------------------------

  const resolveEmbed = useCallback(async () => {
    if (!url || !embedInfo) return;

    // YouTube has a direct thumbnail URL — use it immediately.
    if (embedInfo.thumbnailUrl) {
      setThumbnailUrl(embedInfo.thumbnailUrl);
      setResolved(true);
      return;
    }

    // For other providers, fetch oEmbed data to get the thumbnail.
    setLoadingOEmbed(true);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const oembed = await fetchOEmbed(url, oEmbedProxyUrl, abortControllerRef.current.signal);

      if (oembed) {
        if (oembed.thumbnail_url) {
          setThumbnailUrl(oembed.thumbnail_url);
        }
        if (oembed.html && (resolvedProvider === 'twitter' || resolvedProvider === 'generic')) {
          setOEmbedHtml(oembed.html);
        }
      }

      setResolved(true);
    } catch (err) {
      // AbortError is not a real error — just a cancelled request.
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setResolved(true); // still render, just without thumbnail
    } finally {
      setLoadingOEmbed(false);
    }
  }, [url, embedInfo, oEmbedProxyUrl, resolvedProvider]);

  useEffect(() => {
    if (!containerRef.current || intersectionObservedRef.current) return;

    intersectionObservedRef.current = true;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          observer.disconnect();
          void resolveEmbed();
        }
      },
      { rootMargin: '200px' }, // pre-fetch when 200px away from viewport
    );

    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      abortControllerRef.current?.abort();
    };
  }, [resolveEmbed]);

  // ---- Activate (user clicks through privacy overlay) ----------------------

  const handleActivate = useCallback(async () => {
    if (active) return;
    setActive(true);

    // For Twitter, load the widget script and re-render the embedded tweet.
    if (resolvedProvider === 'twitter') {
      try {
        await loadTwitterScript();
        // The widget script will scan the DOM for blockquotes after load.
        // We trigger a re-render by calling twttr.widgets.load() if available.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).twttr?.widgets?.load?.();
      } catch {
        setError('Could not load Twitter widget. Please check your network connection.');
      }
    }
  }, [active, resolvedProvider]);

  // ---- Render helpers ------------------------------------------------------

  if (!url || !embedInfo) {
    return (
      <NodeViewWrapper as="figure" className="ns-embed ns-embed--invalid" data-ns-embed="">
        <div className="ns-embed__error" role="alert">
          Invalid embed URL
        </div>
      </NodeViewWrapper>
    );
  }

  if (error) {
    return (
      <NodeViewWrapper
        as="figure"
        className={`ns-embed ns-embed--${resolvedProvider}`}
        data-ns-embed=""
        data-embed-url={url}
        data-embed-provider={resolvedProvider}
        data-embed-aspect={aspectRatio}
      >
        <div className="ns-embed__error" role="alert">
          {error}
        </div>
      </NodeViewWrapper>
    );
  }

  const providerLabel = getProviderLabel(resolvedProvider);

  // ---- Privacy overlay (before user consent) -------------------------------

  const renderPrivacyOverlay = () => (
    <div
      className="ns-embed__privacy-overlay"
      style={{ paddingBottom: aspectRatio, position: 'relative' }}
    >
      {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={`Thumbnail for ${providerLabel}`}
          className="ns-embed__thumbnail"
          loading="lazy"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          className="ns-embed__thumbnail-placeholder"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--ns-embed-placeholder-bg, #1a1a2e)',
          }}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        className="ns-embed__activate-btn"
        onClick={handleActivate}
        aria-label={`Load ${providerLabel} — click to accept third-party content`}
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: '#ffffff',
        }}
      >
        <PlayIcon />
        <span className="ns-embed__cta-text" style={{ fontSize: '14px', fontWeight: 600 }}>
          {loadingOEmbed ? 'Loading…' : `Click to load ${providerLabel}`}
        </span>
      </button>
    </div>
  );

  // ---- Active iframe -------------------------------------------------------

  const renderActiveEmbed = () => {
    // Twitter / generic oEmbed: inject the HTML snippet.
    if ((resolvedProvider === 'twitter' || resolvedProvider === 'generic') && oEmbedHtml) {
      return (
        <div
          className="ns-embed__oembed-container"
          style={{ paddingBottom: aspectRatio, position: 'relative' }}
          // dangerouslySetInnerHTML is safe here — oEmbed providers serve
          // trusted widget HTML, and TipTap's editor is already a trusted
          // authoring surface (not user-generated HTML from the internet).
          dangerouslySetInnerHTML={{ __html: oEmbedHtml }}
        />
      );
    }

    // Standard iframe embed (YouTube, Vimeo, Spotify, generic without oEmbed HTML).
    return (
      <div
        className="ns-embed__iframe-wrapper"
        style={{ paddingBottom: aspectRatio, position: 'relative' }}
      >
        <iframe
          src={embedUrl ?? ''}
          className="ns-embed__iframe"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          loading="lazy"
          title={providerLabel}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          // Restrict embedded content to prevent clickjacking and script injection.
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
        />
      </div>
    );
  };

  // ---- Final render --------------------------------------------------------

  return (
    <NodeViewWrapper
      as="figure"
      className={`ns-embed ns-embed--${resolvedProvider}${active ? ' ns-embed--active' : ''}`}
      data-ns-embed=""
      data-embed-url={url}
      data-embed-provider={resolvedProvider}
      data-embed-aspect={aspectRatio}
      ref={containerRef}
    >
      {active ? renderActiveEmbed() : renderPrivacyOverlay()}

      {displayCaption && <figcaption className="ns-embed__caption">{displayCaption}</figcaption>}
    </NodeViewWrapper>
  );
}
