import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/shared/lib/providers';
import { SkipNavigation } from '@/shared/lib/SkipNavigation';

// Import global styles — design tokens + Tailwind CSS 4 utilities.
// The local globals.css re-exports from packages/ui/src/styles/main.css.
import '@/styles/globals.css';

// Inter Variable — primary UI font
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  // Load the full variable font axes for weight 100-900
  axes: ['opsz'],
});

// JetBrains Mono — code blocks, inline code, frontmatter
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Notesaner',
    template: '%s — Notesaner',
  },
  description:
    'A web-first knowledge workspace with real-time collaboration, Zettelkasten support, and plugin system.',
  keywords: ['notes', 'knowledge base', 'markdown', 'collaboration', 'zettelkasten'],
  authors: [{ name: 'Notesaner' }],
  creator: 'Notesaner',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'Notesaner',
  },
  robots: {
    index: false, // Do not index private workspace content by default
    follow: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#1e1e2e' },
    { media: '(prefers-color-scheme: light)', color: '#eff1f5' },
  ],
  colorScheme: 'dark light',
  // `interactive-widget=resizes-content` tells mobile browsers to resize the
  // layout viewport when the virtual keyboard opens (instead of overlaying).
  // This avoids the editor being hidden behind the keyboard.
  interactiveWidget: 'resizes-content',
  // Ensure the viewport covers the full device screen including notch/safe areas.
  viewportFit: 'cover',
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Inline script that runs before React hydration to prevent flash of wrong theme.
 *
 * Reads the persisted theme preference from localStorage (Zustand persist format)
 * and applies the correct data-theme attribute and color-scheme immediately.
 * This runs synchronously in the <head> before any paint, so the user never
 * sees a flash of the wrong theme.
 *
 * The script is intentionally minimal and self-contained — it cannot import
 * from the module system. It duplicates just enough logic from the theme store
 * to read the persisted value.
 */
const THEME_FLASH_PREVENTION_SCRIPT = `
(function() {
  try {
    var raw = localStorage.getItem('notesaner-theme');
    if (!raw) return;
    var parsed = JSON.parse(raw);
    var pref = parsed && parsed.state && parsed.state.preference;
    if (!pref) return;

    var theme = pref;
    if (pref === 'system') {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    var isDark = theme === 'dark' || theme === 'ayu-dark' || theme === 'nord';
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  } catch (e) {}
})();
`;

/**
 * Root layout — wraps the entire application.
 *
 * Sets up:
 * - Google Fonts (Inter Variable + JetBrains Mono)
 * - dark theme as default via data-theme attribute
 * - Global providers (QueryClient, Theme)
 * - Font CSS variables for use in tokens.css
 * - Flash-prevention script to apply persisted theme before first paint
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Inline script to prevent flash of wrong theme — runs before any paint */}
        <script dangerouslySetInnerHTML={{ __html: THEME_FLASH_PREVENTION_SCRIPT }} />
      </head>
      <body>
        <SkipNavigation />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
