import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { locales } from '@/shared/config/i18n';

/**
 * Locale layout — validates the `[locale]` parameter from the URL.
 *
 * next-intl middleware rewrites requests to include the locale segment
 * (e.g., `/workspaces` becomes `/en/workspaces`). This layout validates
 * that the locale is supported and renders children. If the locale is
 * invalid, it triggers a 404.
 *
 * The actual i18n providers (NextIntlClientProvider) are set up in the
 * root layout above this, which uses `getLocale()` / `getMessages()`
 * from next-intl/server.
 */

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;

  // Validate the locale parameter against supported locales
  if (!locales.includes(locale as (typeof locales)[number])) {
    notFound();
  }

  return <>{children}</>;
}
