/**
 * Next.js middleware — locale detection cookie for next-intl.
 *
 * Since the app uses localePrefix: 'never' WITHOUT a [locale] segment
 * in the App Router directory structure, we cannot use next-intl's
 * createMiddleware (which performs internal rewrites to /{locale}/...,
 * requiring a [locale] layout wrapper).
 *
 * Instead, this middleware detects the preferred locale from:
 * 1. NEXT_LOCALE cookie (explicit user preference)
 * 2. Accept-Language header (browser preference)
 * 3. Default locale fallback
 *
 * It sets the NEXT_LOCALE cookie so that next-intl's getRequestConfig
 * can resolve the locale on the server side via getLocale().
 */

import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'ru'];
const DEFAULT_LOCALE = 'en';
const LOCALE_COOKIE = 'NEXT_LOCALE';

function detectLocale(request: NextRequest): string {
  // 1. Explicit cookie
  const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Accept-Language header
  const acceptLanguage = request.headers.get('accept-language');
  if (acceptLanguage) {
    const preferred = acceptLanguage
      .split(',')
      .map((part) => {
        const [lang] = part.trim().split(';');
        return lang.trim().split('-')[0].toLowerCase();
      })
      .find((lang) => SUPPORTED_LOCALES.includes(lang));
    if (preferred) return preferred;
  }

  // 3. Default
  return DEFAULT_LOCALE;
}

export default function middleware(request: NextRequest) {
  const locale = detectLocale(request);
  const response = NextResponse.next();

  // Set/refresh the locale cookie so server components can read it
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    sameSite: 'lax',
    // No maxAge = session cookie; persists until browser closes
    // unless the user explicitly selects a locale (handled by UI)
  });

  return response;
}

export const config = {
  // Match all paths except:
  // - api/ routes (including trpc)
  // - _next/ (internal Next.js assets)
  // - _vercel/ (Vercel internals)
  // - Files with extensions (static assets like .ico, .png, .svg, etc.)
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
