'use client';

/**
 * LocaleSwitcher — dropdown for switching the application locale.
 *
 * Automatically hidden when only a single locale is configured.
 * When multiple locales are available, renders a dropdown using
 * Ant Design's Select component with native names for each locale.
 *
 * Usage:
 *   <LocaleSwitcher />
 *
 * The component reads the active locale from next-intl and updates it
 * via router navigation (adding the locale prefix to the URL).
 *
 * RTL support: The component works correctly in both LTR and RTL layouts
 * because Ant Design's Select handles bidirectional text automatically.
 *
 * @module shared/ui/LocaleSwitcher
 */

import { useLocale } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Select } from 'antd';
import { locales, localeMetadata, type Locale } from '@/shared/config/i18n';

const localeOptions = locales.map((code) => ({
  value: code,
  label: localeMetadata[code].nativeName,
}));

/**
 * Renders a locale switcher dropdown.
 *
 * Automatically hides itself when only one locale is configured.
 * This ensures zero UI footprint until a second locale is added.
 */
export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const handleLocaleChange = useCallback(
    (newLocale: Locale) => {
      // When `localePrefix: 'never'` is active (single locale mode),
      // changing the locale requires a cookie-based approach.
      // When multiple locales are enabled with `localePrefix: 'as-needed'`,
      // this navigates to the locale-prefixed URL.
      //
      // For now with a single locale, this is a no-op.
      // When a second locale is added and routing config changes,
      // this will navigate to e.g., /ru/workspaces.
      document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
      router.replace(pathname);
      router.refresh();
    },
    [router, pathname],
  );

  // Hide when only a single locale is available
  if (locales.length <= 1) {
    return null;
  }

  return (
    <Select
      value={currentLocale}
      onChange={handleLocaleChange}
      options={localeOptions}
      size="small"
      variant="borderless"
      popupMatchSelectWidth={false}
      aria-label="Change language"
      style={{ minWidth: 100 }}
    />
  );
}

LocaleSwitcher.displayName = 'LocaleSwitcher';
