/**
 * Unit tests for the ExternalEmbed TipTap extension.
 *
 * Tests cover:
 * - detectEmbed URL pattern matching for all supported providers
 * - detectEmbed edge cases (invalid URLs, unknown hosts, query-param variants)
 * - fetchOEmbed with known provider endpoints, proxy routing, and error cases
 * - serializeEmbedToMarkdown / parseEmbedComment round-trip
 * - TipTap extension option defaults
 * - insertExternalEmbed command shape validation
 * - setEmbedUrl command shape validation
 *
 * The ProseMirror internals (NodeView rendering, IntersectionObserver) are
 * covered at the component level and not tested here to keep tests fast and
 * headless-friendly.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectEmbed,
  fetchOEmbed,
  serializeEmbedToMarkdown,
  parseEmbedComment,
  ExternalEmbed,
  type EmbedInfo,
  type EmbedProvider,
  type ExternalEmbedOptions,
  type OEmbedResponse,
} from '../extensions/external-embed';

// ---------------------------------------------------------------------------
// detectEmbed — YouTube variants
// ---------------------------------------------------------------------------

describe('detectEmbed — YouTube', () => {
  const VIDEO_ID = 'dQw4w9WgXcQ';

  it('detects standard watch URL', () => {
    const info = detectEmbed(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('youtube');
    expect(info!.embedUrl).toContain('youtube-nocookie.com');
    expect(info!.embedUrl).toContain(VIDEO_ID);
  });

  it('detects short youtu.be URL', () => {
    const info = detectEmbed(`https://youtu.be/${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('youtube');
    expect(info!.embedUrl).toContain(VIDEO_ID);
  });

  it('detects /embed/ URL', () => {
    const info = detectEmbed(`https://www.youtube.com/embed/${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('youtube');
  });

  it('detects Shorts URL', () => {
    const info = detectEmbed(`https://www.youtube.com/shorts/${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('youtube');
  });

  it('returns a youtube-nocookie.com embed URL (privacy protection)', () => {
    const info = detectEmbed(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(info!.embedUrl).toContain('youtube-nocookie.com');
    expect(info!.embedUrl).not.toContain('youtube.com/embed');
  });

  it('returns a thumbnail URL from ytimg.com', () => {
    const info = detectEmbed(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(info!.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${VIDEO_ID}/hqdefault.jpg`);
  });

  it('returns 16:9 aspect ratio', () => {
    const info = detectEmbed(`https://www.youtube.com/watch?v=${VIDEO_ID}`);
    expect(info!.aspectRatio).toBe('56.25%');
  });
});

// ---------------------------------------------------------------------------
// detectEmbed — Twitter / X variants
// ---------------------------------------------------------------------------

describe('detectEmbed — Twitter/X', () => {
  const TWEET_ID = '1234567890123456789';

  it('detects twitter.com status URL', () => {
    const info = detectEmbed(`https://twitter.com/user/status/${TWEET_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('twitter');
  });

  it('detects x.com status URL', () => {
    const info = detectEmbed(`https://x.com/user/status/${TWEET_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('twitter');
  });

  it('includes tweet ID in embed URL', () => {
    const info = detectEmbed(`https://twitter.com/user/status/${TWEET_ID}`);
    expect(info!.embedUrl).toContain(TWEET_ID);
  });

  it('returns null thumbnail (resolved async via oEmbed)', () => {
    const info = detectEmbed(`https://twitter.com/user/status/${TWEET_ID}`);
    expect(info!.thumbnailUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectEmbed — Vimeo variants
// ---------------------------------------------------------------------------

describe('detectEmbed — Vimeo', () => {
  const VIDEO_ID = '123456789';

  it('detects vimeo.com URL', () => {
    const info = detectEmbed(`https://vimeo.com/${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('vimeo');
    expect(info!.embedUrl).toContain(VIDEO_ID);
  });

  it('detects vimeo.com/video/ URL', () => {
    const info = detectEmbed(`https://vimeo.com/video/${VIDEO_ID}`);
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('vimeo');
  });

  it('uses dnt=1 in embed URL (privacy protection)', () => {
    const info = detectEmbed(`https://vimeo.com/${VIDEO_ID}`);
    expect(info!.embedUrl).toContain('dnt=1');
  });

  it('returns null thumbnail (fetched via oEmbed)', () => {
    const info = detectEmbed(`https://vimeo.com/${VIDEO_ID}`);
    expect(info!.thumbnailUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectEmbed — Spotify variants
// ---------------------------------------------------------------------------

describe('detectEmbed — Spotify', () => {
  it('detects Spotify track URL', () => {
    const info = detectEmbed('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('spotify');
    expect(info!.embedUrl).toContain('/embed/track/');
  });

  it('detects Spotify album URL', () => {
    const info = detectEmbed('https://open.spotify.com/album/0sNOF9WDwhWunNAHPD3Baj');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('spotify');
    expect(info!.embedUrl).toContain('/embed/album/');
  });

  it('detects Spotify playlist URL', () => {
    const info = detectEmbed('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('spotify');
    expect(info!.embedUrl).toContain('/embed/playlist/');
  });

  it('detects Spotify episode URL', () => {
    const info = detectEmbed('https://open.spotify.com/episode/3L3vBw1Bv1mGv5LRTE0dWq');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('spotify');
    expect(info!.embedUrl).toContain('/embed/episode/');
  });

  it('returns smaller aspect ratio for track (bar height)', () => {
    const info = detectEmbed('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC');
    expect(info!.aspectRatio).toBe('20%');
  });

  it('returns taller aspect ratio for album/playlist', () => {
    const info = detectEmbed('https://open.spotify.com/album/0sNOF9WDwhWunNAHPD3Baj');
    expect(info!.aspectRatio).toBe('95%');
  });
});

// ---------------------------------------------------------------------------
// detectEmbed — Generic / fallback
// ---------------------------------------------------------------------------

describe('detectEmbed — generic fallback', () => {
  it('returns provider=generic for unknown HTTPS URL', () => {
    const info = detectEmbed('https://example.com/some/page');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('generic');
    expect(info!.embedUrl).toBe('https://example.com/some/page');
  });

  it('returns 16:9 default aspect ratio', () => {
    const info = detectEmbed('https://example.com/video');
    expect(info!.aspectRatio).toBe('56.25%');
  });

  it('returns null thumbnail for generic URLs', () => {
    const info = detectEmbed('https://example.com/page');
    expect(info!.thumbnailUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// detectEmbed — Invalid / edge cases
// ---------------------------------------------------------------------------

describe('detectEmbed — invalid input', () => {
  it('returns null for empty string', () => {
    expect(detectEmbed('')).toBeNull();
  });

  it('returns null for non-URL string', () => {
    expect(detectEmbed('not a url at all')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(detectEmbed('http://')).toBeNull();
  });

  it('returns null for protocol-relative URLs', () => {
    // new URL('//example.com') throws in Node.js environments
    expect(detectEmbed('//example.com')).toBeNull();
  });

  it('handles YouTube URL with extra query params gracefully', () => {
    const info = detectEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1234');
    expect(info).not.toBeNull();
    expect(info!.provider).toBe('youtube');
    expect(info!.embedUrl).toContain('dQw4w9WgXcQ');
  });
});

// ---------------------------------------------------------------------------
// EmbedInfo shape validation
// ---------------------------------------------------------------------------

describe('EmbedInfo shape', () => {
  it('all fields are present for a YouTube URL', () => {
    const info = detectEmbed('https://youtu.be/dQw4w9WgXcQ');
    expect(info).toMatchObject<Partial<EmbedInfo>>({
      provider: 'youtube',
      embedUrl: expect.stringContaining('youtube-nocookie.com'),
      aspectRatio: '56.25%',
      thumbnailUrl: expect.stringContaining('ytimg.com'),
    });
  });

  it('generic embed has all required fields', () => {
    const info = detectEmbed('https://example.com');
    expect(typeof info!.provider).toBe('string');
    expect(typeof info!.embedUrl).toBe('string');
    expect(typeof info!.aspectRatio).toBe('string');
    // thumbnailUrl can be null for generic
    expect(info!.thumbnailUrl === null || typeof info!.thumbnailUrl === 'string').toBe(true);
  });
});

// ---------------------------------------------------------------------------
// serializeEmbedToMarkdown / parseEmbedComment
// ---------------------------------------------------------------------------

describe('serializeEmbedToMarkdown', () => {
  it('wraps URL in HTML comment format', () => {
    const md = serializeEmbedToMarkdown('https://youtube.com/watch?v=abc123');
    expect(md).toBe('<!-- embed:url https://youtube.com/watch?v=abc123 -->');
  });

  it('handles URLs with special characters', () => {
    const url = 'https://example.com/path?foo=bar&baz=qux';
    const md = serializeEmbedToMarkdown(url);
    expect(md).toContain(url);
    expect(md).toMatch(/^<!--/);
    expect(md).toMatch(/-->$/);
  });
});

describe('parseEmbedComment', () => {
  it('parses a valid embed comment', () => {
    const url = parseEmbedComment('<!-- embed:url https://youtube.com/watch?v=abc123 -->');
    expect(url).toBe('https://youtube.com/watch?v=abc123');
  });

  it('returns null for a regular HTML comment', () => {
    expect(parseEmbedComment('<!-- this is a comment -->')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseEmbedComment('')).toBeNull();
  });

  it('is tolerant of extra whitespace', () => {
    const url = parseEmbedComment('<!--  embed:url   https://example.com  -->');
    expect(url).toBe('https://example.com');
  });
});

describe('round-trip: serialize then parse', () => {
  it('round-trips a YouTube URL', () => {
    const original = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const comment = serializeEmbedToMarkdown(original);
    const parsed = parseEmbedComment(comment);
    expect(parsed).toBe(original);
  });

  it('round-trips a generic URL', () => {
    const original = 'https://example.com/page?foo=bar';
    const comment = serializeEmbedToMarkdown(original);
    const parsed = parseEmbedComment(comment);
    expect(parsed).toBe(original);
  });

  it('round-trips a Twitter URL', () => {
    const original = 'https://twitter.com/user/status/1234567890';
    const comment = serializeEmbedToMarkdown(original);
    const parsed = parseEmbedComment(comment);
    expect(parsed).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// fetchOEmbed
// ---------------------------------------------------------------------------

describe('fetchOEmbed', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('calls the known YouTube endpoint directly when no proxy is set', async () => {
    const mockResponse: OEmbedResponse = {
      type: 'video',
      title: 'Test Video',
      thumbnail_url: 'https://i.ytimg.com/vi/abc/hq720.jpg',
      html: '<iframe src="..." />',
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchOEmbed('https://www.youtube.com/watch?v=dQw4w9WgXcQ', null);

    expect(mockFetch).toHaveBeenCalledOnce();
    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('youtube.com/oembed');
    expect(result).toEqual(mockResponse);
  });

  it('routes request through the proxy when proxyUrl is set', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'video', title: 'Proxied', thumbnail_url: null }),
    });

    await fetchOEmbed('https://vimeo.com/123456789', '/api/oembed');

    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('/api/oembed');
    expect(calledUrl).toContain('vimeo.com');
  });

  it('returns null when the HTTP response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({}),
    });

    const result = await fetchOEmbed('https://vimeo.com/99999', null);
    expect(result).toBeNull();
  });

  it('returns null for unknown providers (no matching endpoint)', async () => {
    const result = await fetchOEmbed('https://unknown-provider.example.com/video', null);
    // No fetch should be made for unknown providers.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    const result = await fetchOEmbed('https://vimeo.com/123456789', null);
    expect(result).toBeNull();
  });

  it('returns null when cancelled via AbortSignal', async () => {
    const controller = new AbortController();

    mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
      if (opts?.signal instanceof AbortSignal && opts.signal.aborted) {
        return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
      }
      return new Promise<never>((_resolve, reject) => {
        opts?.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });

    const fetchPromise = fetchOEmbed('https://vimeo.com/123456789', null, controller.signal);
    controller.abort();

    const result = await fetchPromise;
    expect(result).toBeNull();
  });

  it('passes the AbortSignal to fetch', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'video' }),
    });

    const controller = new AbortController();
    await fetchOEmbed('https://vimeo.com/123456789', null, controller.signal);

    expect(mockFetch).toHaveBeenCalledOnce();
    const fetchOptions = mockFetch.mock.calls[0][1] as RequestInit;
    expect(fetchOptions?.signal).toBe(controller.signal);
  });

  it('calls the Vimeo oEmbed endpoint for Vimeo URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'video', title: 'Vimeo Video' }),
    });

    await fetchOEmbed('https://vimeo.com/123456789', null);

    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('vimeo.com/api/oembed');
  });

  it('calls the Twitter oEmbed endpoint for Twitter URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'rich', html: '<blockquote>tweet</blockquote>' }),
    });

    await fetchOEmbed('https://twitter.com/user/status/1234567890', null);

    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('publish.twitter.com/oembed');
  });

  it('calls the Spotify oEmbed endpoint for Spotify URLs', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ type: 'rich', html: '<iframe src="..."></iframe>' }),
    });

    await fetchOEmbed('https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC', null);

    const calledUrl: string = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('open.spotify.com/oembed');
  });
});

// ---------------------------------------------------------------------------
// ExternalEmbed extension — option defaults
// ---------------------------------------------------------------------------

describe('ExternalEmbed extension options', () => {
  it('has privacyMode enabled by default', () => {
    const ext = ExternalEmbed;
    // addOptions() is a factory — we call it directly.
    const opts: ExternalEmbedOptions = ext.config.addOptions?.call({ options: {} }) ?? {};
    expect(opts.privacyMode).toBe(true);
  });

  it('has oEmbedProxyUrl as null by default', () => {
    const opts: ExternalEmbedOptions = ExternalEmbed.config.addOptions?.call({ options: {} }) ?? {};
    expect(opts.oEmbedProxyUrl).toBeNull();
  });

  it('has HTMLAttributes as empty object by default', () => {
    const opts: ExternalEmbedOptions = ExternalEmbed.config.addOptions?.call({ options: {} }) ?? {};
    expect(opts.HTMLAttributes).toEqual({});
  });

  it('configure() accepts privacyMode: false', () => {
    const configured = ExternalEmbed.configure({ privacyMode: false });
    expect(configured).toBeDefined();
    expect(configured.name).toBe('externalEmbed');
  });

  it('configure() accepts a custom oEmbedProxyUrl', () => {
    const configured = ExternalEmbed.configure({ oEmbedProxyUrl: '/api/oembed' });
    expect(configured).toBeDefined();
  });

  it('configure() does not throw with empty options', () => {
    expect(() => ExternalEmbed.configure({})).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// ExternalEmbed extension — attributes definition
// ---------------------------------------------------------------------------

describe('ExternalEmbed attributes', () => {
  it('has url attribute with null default', () => {
    const attrs = ExternalEmbed.config.addAttributes?.call({ options: {} });
    expect(attrs).toBeDefined();
    expect(attrs!.url.default).toBeNull();
  });

  it('has provider attribute with generic default', () => {
    const attrs = ExternalEmbed.config.addAttributes?.call({ options: {} });
    expect(attrs!.provider.default).toBe('generic');
  });

  it('has aspectRatio attribute with 16:9 default', () => {
    const attrs = ExternalEmbed.config.addAttributes?.call({ options: {} });
    expect(attrs!.aspectRatio.default).toBe('56.25%');
  });

  it('has caption attribute with null default', () => {
    const attrs = ExternalEmbed.config.addAttributes?.call({ options: {} });
    expect(attrs!.caption.default).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ExternalEmbed extension — command contracts
// ---------------------------------------------------------------------------

describe('insertExternalEmbed command', () => {
  function makeCommandContext(commandResult: boolean): {
    commands: {
      insertContent: ReturnType<typeof vi.fn>;
      updateAttributes: ReturnType<typeof vi.fn>;
    };
  } {
    return {
      commands: {
        insertContent: vi.fn(() => commandResult),
        updateAttributes: vi.fn(() => commandResult),
      },
    };
  }

  it('returns false for an empty URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    const result = insertExternalEmbed?.({ url: '' })(ctx as never);
    expect(result).toBe(false);
  });

  it('returns false for an unparseable URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    const result = insertExternalEmbed?.({ url: 'not a url' })(ctx as never);
    expect(result).toBe(false);
  });

  it('calls commands.insertContent for a valid YouTube URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    const result = insertExternalEmbed?.({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })(
      ctx as never,
    );

    expect(ctx.commands.insertContent).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('calls commands.insertContent with correct provider attribute for YouTube', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    insertExternalEmbed?.({ url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' })(ctx as never);

    const insertedContent = ctx.commands.insertContent.mock.calls[0][0] as {
      type: string;
      attrs: Record<string, unknown>;
    };
    expect(insertedContent.type).toBe('externalEmbed');
    expect(insertedContent.attrs.provider).toBe('youtube');
    expect(insertedContent.attrs.url).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  });

  it('calls commands.insertContent with correct provider for Twitter URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    insertExternalEmbed?.({ url: 'https://twitter.com/user/status/1234567890123456789' })(
      ctx as never,
    );

    const insertedContent = ctx.commands.insertContent.mock.calls[0][0] as {
      type: string;
      attrs: Record<string, unknown>;
    };
    expect(insertedContent.attrs.provider).toBe('twitter');
  });

  it('calls commands.insertContent with correct provider for generic URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const insertExternalEmbed = addCommands?.insertExternalEmbed;
    const ctx = makeCommandContext(true);

    insertExternalEmbed?.({ url: 'https://example.com/some/page' })(ctx as never);

    const insertedContent = ctx.commands.insertContent.mock.calls[0][0] as {
      type: string;
      attrs: Record<string, unknown>;
    };
    expect(insertedContent.attrs.provider).toBe('generic');
  });
});

describe('setEmbedUrl command', () => {
  function makeCtx(): {
    commands: { updateAttributes: ReturnType<typeof vi.fn> };
  } {
    return { commands: { updateAttributes: vi.fn(() => true) } };
  }

  it('returns false for an empty URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const setEmbedUrl = addCommands?.setEmbedUrl;
    const result = setEmbedUrl?.('')(makeCtx() as never);
    expect(result).toBe(false);
  });

  it('returns false for an unparseable URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const setEmbedUrl = addCommands?.setEmbedUrl;
    const result = setEmbedUrl?.('not a url')(makeCtx() as never);
    expect(result).toBe(false);
  });

  it('calls updateAttributes for a valid URL', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const setEmbedUrl = addCommands?.setEmbedUrl;
    const ctx = makeCtx();

    const result = setEmbedUrl?.('https://vimeo.com/123456789')(ctx as never);

    expect(ctx.commands.updateAttributes).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('updates provider attribute when URL changes', () => {
    const addCommands = ExternalEmbed.config.addCommands?.call({
      name: 'externalEmbed',
      type: {} as never,
      options: { privacyMode: true },
    });
    const setEmbedUrl = addCommands?.setEmbedUrl;
    const ctx = makeCtx();

    setEmbedUrl?.('https://vimeo.com/123456789')(ctx as never);

    const updatedAttrs = ctx.commands.updateAttributes.mock.calls[0][1] as Record<string, unknown>;
    expect(updatedAttrs.provider).toBe('vimeo');
    expect(updatedAttrs.url).toBe('https://vimeo.com/123456789');
  });
});

// ---------------------------------------------------------------------------
// Provider detection coverage — additional edge cases
// ---------------------------------------------------------------------------

describe('detectEmbed — provider detection coverage', () => {
  it('correctly identifies all supported providers', () => {
    const testCases: Array<[string, EmbedProvider]> = [
      ['https://youtube.com/watch?v=abc1234abcd', 'youtube'],
      ['https://youtu.be/abc1234abcd', 'youtube'],
      ['https://twitter.com/anyuser/status/1', 'twitter'],
      ['https://x.com/anyuser/status/1', 'twitter'],
      ['https://vimeo.com/99999', 'vimeo'],
      ['https://open.spotify.com/track/abc123', 'spotify'],
      ['https://open.spotify.com/album/abc123', 'spotify'],
      ['https://open.spotify.com/playlist/abc123', 'spotify'],
      ['https://example.com/', 'generic'],
      ['https://notion.so/some-page', 'generic'],
    ];

    for (const [url, expectedProvider] of testCases) {
      const info = detectEmbed(url);
      expect(info?.provider, `Failed for ${url}`).toBe(expectedProvider);
    }
  });

  it('returns distinct embed URLs for different YouTube video IDs', () => {
    const info1 = detectEmbed('https://youtu.be/aaaaaaaaaa1');
    const info2 = detectEmbed('https://youtu.be/bbbbbbbbbbb');
    expect(info1!.embedUrl).not.toBe(info2!.embedUrl);
  });
});
