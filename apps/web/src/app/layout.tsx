import type { Metadata, Viewport } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Providers } from '@/shared/lib/providers';

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
};

interface RootLayoutProps {
  children: React.ReactNode;
}

/**
 * Root layout — wraps the entire application.
 *
 * Sets up:
 * - Google Fonts (Inter Variable + JetBrains Mono)
 * - dark theme as default via data-theme attribute
 * - Global providers (QueryClient, Theme)
 * - Font CSS variables for use in tokens.css
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html
      lang="en"
      data-theme="dark"
      className={`${inter.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
