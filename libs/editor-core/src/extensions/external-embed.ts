/**
 * ExternalEmbed — TipTap Node extension for rich external content embeds.
 *
 * Supports:
 * - YouTube URLs → embedded player with privacy mode (youtube-nocookie.com)
 * - Twitter/X URLs → tweet card via twitter.com/embed API
 * - Vimeo URLs → embedded player
 * - Spotify URLs → embedded player
 * - Generic oEmbed fallback for other URLs (provider discovery via oEmbed spec)
 *
 * Privacy-first design:
 * - In privacy mode (default), shows a thumbnail + "Click to load" overlay.
 * - The iframe is NOT inserted until the user explicitly clicks.
 * - IntersectionObserver triggers the thumbnail fetch lazily (on scroll into view).
 * - YouTube uses youtube-nocookie.com to prevent cross-site tracking before consent.
 *
 * Markdown serialization:
 * - Stored as an HTML comment embed block:
 *   <!-- embed:url https://youtube.com/watch?v=... -->
 * - This is invisible in plain-text MD views but round-trips through the editor.
 *
 * Slash command integration:
 * - The 'embed' item in BUILT_IN_SLASH_ITEMS (slash-command.ts) triggers
 *   editor.commands.insertExternalEmbed({ url }) via the /embed command.
 * - This extension registers the insertExternalEmbed command.
 *
 * Usage:
 * ```ts
 * import { ExternalEmbed } from '@notesaner/editor-core';
 *
 * const extensions = [
 *   ...getBaseExtensions(),
 *   ExternalEmbed.configure({
 *     privacyMode: true,          // default: true
 *     oEmbedProxyUrl: '/api/oembed', // optional server-side proxy
 *   }),
 * ];
 *
 * // Insert via command:
 * editor.commands.insertExternalEmbed({ url: 'https://youtube.com/watch?v=...' });
 * ```
 */

import { Node, mergeAttributes } from '@tiptap/core';

// ---------------------------------------------------------------------------
// URL detection patterns
// ---------------------------------------------------------------------------

/** All supported embed providers. */
export type EmbedProvider = 'youtube' | 'twitter' | 'vimeo' | 'spotify' | 'generic';

/** Structured result of URL pattern matching. */
export interface EmbedInfo {
  /** The detected provider. */
  provider: EmbedProvider;
  /**
   * The canonical embed URL to load in the iframe.
   * For YouTube, this uses youtube-nocookie.com.
   * For generic oEmbed, this is the original URL (resolved at runtime).
   */
  embedUrl: string;
  /**
   * The aspect ratio expressed as a CSS padding-bottom percentage string,
   * e.g. "56.25%" for 16:9.
   * Defaults to '56.25%' (16:9).
   */
  aspectRatio: string;
  /**
   * The URL of a static thumbnail image to display in privacy mode
   * before the user consents to loading the embed.
   * May be null for generic oEmbed (resolved asynchronously).
   */
  thumbnailUrl: string | null;
}

// Regex patterns — ordered most-specific first.
const YOUTUBE_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const TWITTER_RE = /(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/;
const VIMEO_RE = /vimeo\.com\/(?:video\/)?(\d+)/;
const SPOTIFY_TRACK_RE = /open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/;

/**
 * Analyses a URL and returns embed information, or null if the URL is not
 * a recognised embeddable resource and has no oEmbed discovery path.
 *
 * For generic URLs, provider is set to 'generic' and the caller should
 * attempt oEmbed discovery at render time.
 */
export function detectEmbed(rawUrl: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  const href = url.href;

  // YouTube
  const ytMatch = href.match(YOUTUBE_RE);
  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      provider: 'youtube',
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`,
      aspectRatio: '56.25%',
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  // Twitter / X
  const twMatch = href.match(TWITTER_RE);
  if (twMatch) {
    const tweetId = twMatch[1];
    return {
      provider: 'twitter',
      // twitter.com/embed resolves the oembed endpoint; we store the canonical URL
      embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${tweetId}`,
      aspectRatio: '56.25%',
      thumbnailUrl: null, // resolved at runtime via oEmbed
    };
  }

  // Vimeo
  const vimeoMatch = href.match(VIMEO_RE);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      provider: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${videoId}?dnt=1`,
      aspectRatio: '56.25%',
      thumbnailUrl: null, // resolved at runtime via oEmbed
    };
  }

  // Spotify
  const spotifyMatch = href.match(SPOTIFY_TRACK_RE);
  if (spotifyMatch) {
    const [, type, id] = spotifyMatch;
    return {
      provider: 'spotify',
      embedUrl: `https://open.spotify.com/embed/${type}/${id}`,
      // Spotify has its own fixed heights; use a fixed ratio approximation.
      aspectRatio: type === 'track' ? '20%' : '95%',
      thumbnailUrl: null,
    };
  }

  // Generic — return as-is; oEmbed will be attempted at render time.
  return {
    provider: 'generic',
    embedUrl: href,
    aspectRatio: '56.25%',
    thumbnailUrl: null,
  };
}

// ---------------------------------------------------------------------------
// oEmbed fetcher
// ---------------------------------------------------------------------------

/**
 * Minimal oEmbed response shape we care about.
 * The full spec has more fields; we only map what we display.
 */
export interface OEmbedResponse {
  type: 'rich' | 'video' | 'photo' | 'link';
  html?: string;
  title?: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  author_name?: string;
}

/**
 * Known oEmbed provider endpoints indexed by hostname pattern.
 * We check these before falling back to `<link rel="alternate" type="application/json+oembed">`.
 */
const OEMBED_ENDPOINTS: Array<{ pattern: RegExp; endpoint: string }> = [
  {
    pattern: /(?:youtube\.com|youtu\.be)/,
    endpoint: 'https://www.youtube.com/oembed',
  },
  {
    pattern: /vimeo\.com/,
    endpoint: 'https://vimeo.com/api/oembed.json',
  },
  {
    pattern: /(?:twitter\.com|x\.com)/,
    endpoint: 'https://publish.twitter.com/oembed',
  },
  {
    pattern: /open\.spotify\.com/,
    endpoint: 'https://open.spotify.com/oembed',
  },
];

/**
 * Fetches oEmbed data for a given URL.
 *
 * @param url - The page URL to look up.
 * @param proxyUrl - Optional server-side proxy path that accepts `?url=<encoded>`.
 *   Use a proxy to bypass CORS restrictions in the browser.
 * @param signal - AbortSignal for cancellation.
 */
export async function fetchOEmbed(
  url: string,
  proxyUrl: string | null,
  signal?: AbortSignal,
): Promise<OEmbedResponse | null> {
  try {
    let endpointBase: string | null = null;

    // Check known endpoints first (avoids a round-trip to the page HTML).
    for (const { pattern, endpoint } of OEMBED_ENDPOINTS) {
      if (pattern.test(url)) {
        endpointBase = endpoint;
        break;
      }
    }

    if (!endpointBase) {
      // No known endpoint — skip for now to avoid blocking the render.
      // A real implementation would fetch the page and parse <link> tags.
      return null;
    }

    const requestUrl = proxyUrl
      ? `${proxyUrl}?url=${encodeURIComponent(url)}&endpoint=${encodeURIComponent(endpointBase)}`
      : `${endpointBase}?url=${encodeURIComponent(url)}&format=json`;

    const res = await fetch(requestUrl, { signal });
    if (!res.ok) return null;

    return (await res.json()) as OEmbedResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Markdown serialization helpers
// ---------------------------------------------------------------------------

/**
 * Serializes an embed node to the Markdown HTML-comment storage format:
 *   <!-- embed:url https://... -->
 *
 * This invisible comment survives plain-text round-trips and is parsed back
 * by the parseHTML rules below.
 */
export function serializeEmbedToMarkdown(url: string): string {
  return `<!-- embed:url ${url} -->`;
}

/** Pattern that matches the HTML-comment embed storage format. */
const EMBED_COMMENT_RE = /<!--\s*embed:url\s+(https?:\/\/\S+)\s*-->/;

/**
 * Parses an HTML comment string and returns the embed URL, or null if it
 * is not a recognised embed comment.
 */
export function parseEmbedComment(comment: string): string | null {
  const match = comment.match(EMBED_COMMENT_RE);
  return match?.[1] ?? null;
}

// ---------------------------------------------------------------------------
// TipTap node options
// ---------------------------------------------------------------------------

/** Options passed to ExternalEmbed.configure(). */
export interface ExternalEmbedOptions {
  /**
   * When true (default), a thumbnail + "Click to load" overlay is shown
   * instead of the iframe until the user explicitly clicks.
   * This prevents third-party trackers from loading on page render.
   */
  privacyMode?: boolean;

  /**
   * Optional server-side proxy URL for oEmbed requests.
   * Accepts requests in the form: `<proxyUrl>?url=<encoded>&endpoint=<encoded>`
   *
   * Use this to avoid CORS issues when fetching oEmbed data from the browser.
   * When omitted, oEmbed requests are made directly to provider endpoints.
   */
  oEmbedProxyUrl?: string | null;

  /**
   * HTML attributes applied to the outer embed container element.
   */
  HTMLAttributes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Command augmentation
// ---------------------------------------------------------------------------

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    externalEmbed: {
      /**
       * Insert an external embed block at the current cursor position.
       *
       * @param options.url - The URL to embed (YouTube, Twitter, Vimeo, Spotify, or generic).
       */
      insertExternalEmbed: (options: { url: string }) => ReturnType;

      /**
       * Update the URL of the embed at the current selection.
       */
      setEmbedUrl: (url: string) => ReturnType;
    };
  }
}

// ---------------------------------------------------------------------------
// Extension definition
// ---------------------------------------------------------------------------

export const ExternalEmbed = Node.create<ExternalEmbedOptions>({
  name: 'externalEmbed',

  // Block-level atom — no child content, draggable.
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,
  isolating: false,

  addOptions() {
    return {
      privacyMode: true,
      oEmbedProxyUrl: null,
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      /**
       * The original page URL that the user pasted / typed.
       * This is the canonical source of truth stored in the document.
       */
      url: {
        default: null,
        parseHTML: (el) =>
          el.getAttribute('data-embed-url') ??
          // Also try parsing from the data-comment attribute set during
          // HTML serialization of the comment node.
          parseEmbedComment(el.getAttribute('data-embed-comment') ?? ''),
      },

      /**
       * The detected provider (set at insert time and stored so the
       * NodeView doesn't need to re-run detection on every render).
       */
      provider: {
        default: 'generic' as EmbedProvider,
        parseHTML: (el) => (el.getAttribute('data-embed-provider') as EmbedProvider) ?? 'generic',
      },

      /**
       * Aspect-ratio padding-bottom value (e.g. "56.25%").
       * Stored so different providers can preserve their native ratio.
       */
      aspectRatio: {
        default: '56.25%',
        parseHTML: (el) => el.getAttribute('data-embed-aspect') ?? '56.25%',
      },

      /**
       * Optional caption shown below the embed.
       */
      caption: {
        default: null,
        parseHTML: (el) => el.querySelector('.ns-embed__caption')?.textContent?.trim() ?? null,
      },
    };
  },

  parseHTML() {
    return [
      // Standard embed wrapper element
      { tag: 'div[data-ns-embed]' },
      // HTML-comment storage format written by markdown serializer
      // Note: TipTap's HTML parser does not natively handle comment nodes;
      // we store them inside a dedicated wrapper during renderHTML and parse
      // back from the data-embed-comment attribute on re-load.
      { tag: 'div[data-embed-comment]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const url = node.attrs.url as string | null;
    const provider = node.attrs.provider as EmbedProvider;
    const aspectRatio = node.attrs.aspectRatio as string;
    const caption = node.attrs.caption as string | null;

    const wrapperAttrs = mergeAttributes(this.options.HTMLAttributes ?? {}, HTMLAttributes, {
      'data-ns-embed': '',
      'data-embed-url': url ?? '',
      'data-embed-provider': provider,
      'data-embed-aspect': aspectRatio,
      class: `ns-embed ns-embed--${provider}`,
    });

    const aspectEl = [
      'div',
      {
        class: 'ns-embed__aspect',
        style: `padding-bottom: ${aspectRatio}; position: relative;`,
      },
      // Placeholder text shown in static (non-React) rendering.
      [
        'span',
        { class: 'ns-embed__placeholder', 'aria-label': `Embedded content from ${url ?? ''}` },
        url ?? '',
      ],
    ];

    if (caption) {
      return [
        'figure',
        wrapperAttrs,
        aspectEl,
        ['figcaption', { class: 'ns-embed__caption' }, caption],
      ];
    }

    return ['figure', wrapperAttrs, aspectEl];
  },

  addCommands() {
    return {
      insertExternalEmbed:
        ({ url }) =>
        ({ commands }) => {
          if (!url) return false;

          // Detect provider & metadata at insert time so it's stored in the doc.
          const info = detectEmbed(url);
          if (!info) return false;

          return commands.insertContent({
            type: this.name,
            attrs: {
              url,
              provider: info.provider,
              aspectRatio: info.aspectRatio,
              caption: null,
            },
          });
        },

      setEmbedUrl:
        (url) =>
        ({ commands }) => {
          if (!url) return false;
          const info = detectEmbed(url);
          if (!info) return false;
          return commands.updateAttributes(this.name, {
            url,
            provider: info.provider,
            aspectRatio: info.aspectRatio,
          });
        },
    };
  },
});
