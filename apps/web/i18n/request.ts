/**
 * i18n/request — next-intl server request configuration.
 *
 * This file is automatically discovered by the next-intl plugin.
 * It runs on every request and provides the resolved locale and
 * message bundle to both Server Components and Client Components.
 *
 * The locale is determined by:
 * 1. The middleware (sets the `x-next-intl-locale` header)
 * 2. Fallback to the default locale
 *
 * Messages are loaded lazily via dynamic import to enable
 * code-splitting per locale when multiple locales are added.
 */

import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  // The locale resolved by middleware or routing
  const requested = await requestLocale;

  // Validate against supported locales, fall back to default
  const locale =
    requested && (routing.locales as readonly string[]).includes(requested)
      ? requested
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,

    // ICU message format options
    formats: {
      dateTime: {
        short: {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        },
        long: {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
        },
        relative: {
          style: 'long',
          numeric: 'auto',
        },
      },
      number: {
        compact: {
          notation: 'compact',
          compactDisplay: 'short',
        },
        percent: {
          style: 'percent',
          minimumFractionDigits: 0,
          maximumFractionDigits: 1,
        },
      },
    },

    // Timestamp zone — used for date formatting in server components
    timeZone: 'UTC',

    // Development: show warning for missing translations
    // Production: silently fall back to key
    onError(error) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[next-intl]', error.message);
      }
    },
    getMessageFallback({ namespace, key }) {
      // Return the key path so missing translations are visible in the UI
      return namespace ? `${namespace}.${key}` : key;
    },
  };
});
