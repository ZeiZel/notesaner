/**
 * Next.js middleware — locale detection and i18n routing.
 *
 * Uses next-intl middleware to:
 * 1. Detect the user's preferred locale from the Accept-Language header
 * 2. Set the resolved locale in a request header for server components
 * 3. (Future) Redirect to locale-prefixed URLs when multiple locales are enabled
 *
 * The matcher excludes API routes, static files, and Next.js internals.
 */

import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Match all paths except:
  // - api/ routes (including trpc)
  // - _next/ (internal Next.js assets)
  // - _vercel/ (Vercel internals)
  // - Files with extensions (static assets like .ico, .png, .svg, etc.)
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
