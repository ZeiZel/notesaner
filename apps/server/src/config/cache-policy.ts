/**
 * Cache policy configuration -- defines Cache-Control header strategies
 * for different route patterns.
 *
 * These policies are applied by the CacheControlMiddleware based on URL
 * pattern matching, and can be overridden at the route level via the
 * @CachePolicy() decorator (read by CacheControlInterceptor).
 *
 * Policy hierarchy (first match wins):
 *   1. @CachePolicy() decorator on the handler/controller
 *   2. Route pattern match from this configuration
 *   3. Default: private, no-cache
 *
 * Cache-Control reference:
 *   - immutable: resource will never change (hashed filenames)
 *   - stale-while-revalidate: serve stale while revalidating in background
 *   - no-cache: must revalidate with server every time (ETag/304 supported)
 *   - no-store: do not cache at all (sensitive data)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CachePolicyEntry {
  /** Glob-like pattern matched against the request path (supports * wildcard). */
  pattern: string;
  /** The Cache-Control header value to set. */
  cacheControl: string;
  /** Optional Vary header value. */
  vary?: string;
  /** Whether to add Surrogate-Control for CDN-specific caching. */
  surrogateControl?: string;
  /** Human-readable description for documentation. */
  description: string;
}

// ─── Policies ───────────────────────────────────────────────────────────────

/**
 * Immutable policy: for hashed/versioned static assets.
 * These assets have content-addressed filenames, so they never change.
 * CDN and browser cache for 1 year.
 */
const IMMUTABLE: CachePolicyEntry = {
  pattern: '/static/*',
  cacheControl: 'public, max-age=31536000, immutable',
  surrogateControl: 'max-age=31536000',
  description: 'Hashed static assets -- immutable, cache for 1 year.',
};

/**
 * Static assets with fingerprinted filenames (JS, CSS, images built by Next.js).
 */
const HASHED_ASSETS: CachePolicyEntry = {
  pattern: '/_next/static/*',
  cacheControl: 'public, max-age=31536000, immutable',
  surrogateControl: 'max-age=31536000',
  description: 'Next.js build assets with content hash -- immutable.',
};

/**
 * User-uploaded attachments served via the backend.
 * Moderate cache with revalidation support.
 */
const ATTACHMENTS: CachePolicyEntry = {
  pattern: '/api/workspaces/*/attachments/*',
  cacheControl: 'private, max-age=3600, stale-while-revalidate=600',
  vary: 'Authorization',
  description: 'User attachments -- private, 1h cache with SWR.',
};

/**
 * Public vault / published note content.
 * CDN can cache for 5 minutes; stale-while-revalidate for 1 minute.
 */
const PUBLIC_CONTENT: CachePolicyEntry = {
  pattern: '/public/*',
  cacheControl: 'public, max-age=300, stale-while-revalidate=60',
  surrogateControl: 'max-age=300',
  vary: 'Accept-Encoding',
  description: 'Published public content -- CDN cacheable for 5 minutes.',
};

/**
 * API responses for authenticated endpoints.
 * Allow stale-while-revalidate for list endpoints.
 */
const API_SWR: CachePolicyEntry = {
  pattern: '/api/workspaces/*/notes',
  cacheControl: 'private, max-age=0, stale-while-revalidate=30',
  vary: 'Authorization, Accept-Encoding',
  description: 'Note list API -- private, SWR for 30 seconds.',
};

/**
 * Note content endpoints -- ETag-based validation.
 * no-cache forces revalidation on every request (ETag comparison).
 */
const NOTE_CONTENT: CachePolicyEntry = {
  pattern: '/api/workspaces/*/notes/*/content',
  cacheControl: 'private, no-cache',
  vary: 'Authorization',
  description: 'Note content -- always revalidate, ETag supported.',
};

/**
 * Auth endpoints -- never cache.
 */
const AUTH_NO_STORE: CachePolicyEntry = {
  pattern: '/api/auth/*',
  cacheControl: 'no-store, no-cache, must-revalidate, proxy-revalidate',
  description: 'Auth endpoints -- never cache (tokens, credentials).',
};

/**
 * API key management -- never cache.
 */
const API_KEYS_NO_STORE: CachePolicyEntry = {
  pattern: '/api/keys/*',
  cacheControl: 'no-store, no-cache, must-revalidate, proxy-revalidate',
  description: 'API key management -- never cache.',
};

/**
 * Health and metrics -- short-lived public cache for monitoring proxies.
 */
const HEALTH: CachePolicyEntry = {
  pattern: '/health*',
  cacheControl: 'public, max-age=10',
  description: 'Health checks -- 10 second public cache.',
};

/**
 * Metrics endpoint -- short-lived.
 */
const METRICS: CachePolicyEntry = {
  pattern: '/metrics',
  cacheControl: 'no-cache',
  description: 'Prometheus metrics -- always fresh.',
};

/**
 * Swagger / API documentation.
 */
const DOCS: CachePolicyEntry = {
  pattern: '/api/docs*',
  cacheControl: 'public, max-age=3600',
  description: 'API documentation -- 1 hour public cache.',
};

// ─── Ordered Policy List ────────────────────────────────────────────────────

/**
 * Ordered list of cache policies. Matched top-to-bottom; first match wins.
 * More specific patterns should appear before broader patterns.
 */
export const CACHE_POLICIES: CachePolicyEntry[] = [
  // Static / immutable assets
  HASHED_ASSETS,
  IMMUTABLE,

  // Auth -- never cache
  AUTH_NO_STORE,
  API_KEYS_NO_STORE,

  // Specific API endpoints
  NOTE_CONTENT,
  API_SWR,
  ATTACHMENTS,

  // Public content
  PUBLIC_CONTENT,

  // Infrastructure
  HEALTH,
  METRICS,
  DOCS,
];

// ─── Default Policy ─────────────────────────────────────────────────────────

/** Default Cache-Control for routes that do not match any policy. */
export const DEFAULT_CACHE_CONTROL = 'private, no-cache';

// ─── Matcher ────────────────────────────────────────────────────────────────

/**
 * Simple glob matcher supporting `*` as wildcard.
 * Converts the glob pattern to a regex and tests the path.
 */
export function matchPattern(pattern: string, path: string): boolean {
  // Escape regex special chars except `*`, then replace `*` with `.*`
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(path);
}

/**
 * Resolves the cache policy for a given request path.
 * Returns the first matching policy, or undefined if no pattern matches.
 */
export function resolveCachePolicyForPath(path: string): CachePolicyEntry | undefined {
  return CACHE_POLICIES.find((policy) => matchPattern(policy.pattern, path));
}
