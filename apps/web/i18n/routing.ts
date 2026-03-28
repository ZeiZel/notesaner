/**
 * i18n/routing — next-intl routing configuration.
 *
 * Defines the routing strategy for locale handling. Currently uses
 * a single locale (English) without URL-based locale prefixes.
 *
 * When a second locale is added, switch to `defineRouting` with
 * `localePrefix: 'as-needed'` to enable URL-based locale switching
 * (e.g., /ru/workspaces) while keeping the default locale prefix-free.
 */

import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from '@/shared/config/i18n';

export const routing = defineRouting({
  locales,
  defaultLocale,

  // 'never' = no locale prefix in URLs while we have a single locale.
  // Change to 'as-needed' when adding a second locale.
  localePrefix: 'never',
});
