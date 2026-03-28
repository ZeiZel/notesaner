/**
 * shared/config/i18n — Internationalization constants and configuration.
 *
 * Central source of truth for supported locales, default locale, and
 * locale metadata. All i18n-related code should import from here
 * rather than hardcoding locale strings.
 *
 * @module shared/config/i18n
 */

/** BCP 47 locale identifier. */
export type Locale = (typeof locales)[number];

/** All locales the application supports. */
export const locales = ['en'] as const;

/** Fallback locale when the user's preferred locale is not supported. */
export const defaultLocale: Locale = 'en';

/** Locale metadata for the switcher and RTL handling. */
export interface LocaleMetadata {
  /** BCP 47 locale code */
  code: Locale;
  /** Native display name (shown in the locale switcher) */
  nativeName: string;
  /** English display name (for logs and admin views) */
  englishName: string;
  /** Text direction */
  dir: 'ltr' | 'rtl';
}

/**
 * Registry of all supported locales with metadata.
 *
 * When adding a new locale:
 * 1. Add the BCP 47 code to the `locales` tuple above.
 * 2. Add a `LocaleMetadata` entry here.
 * 3. Create `messages/{locale}.json` with all required namespaces.
 * 4. The LocaleSwitcher component will automatically display the new locale.
 */
export const localeMetadata: Record<Locale, LocaleMetadata> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    dir: 'ltr',
  },
  // Future locales:
  // ru: { code: 'ru', nativeName: 'Русский', englishName: 'Russian', dir: 'ltr' },
  // ar: { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', dir: 'rtl' },
  // ja: { code: 'ja', nativeName: '日本語', englishName: 'Japanese', dir: 'ltr' },
};

/**
 * Message namespaces used in the application.
 *
 * Each namespace maps to a top-level key in the messages JSON file.
 * Components should use `useTranslations('namespace')` to scope their translations.
 */
export const messageNamespaces = [
  'common',
  'auth',
  'editor',
  'workspace',
  'settings',
  'search',
  'notifications',
  'errors',
] as const;

export type MessageNamespace = (typeof messageNamespaces)[number];

/**
 * Returns the text direction for a given locale.
 * Falls back to 'ltr' for unknown locales.
 */
export function getLocaleDirection(locale: string): 'ltr' | 'rtl' {
  const meta = localeMetadata[locale as Locale];
  return meta?.dir ?? 'ltr';
}

/**
 * Checks if a given string is a supported locale.
 */
export function isSupportedLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
