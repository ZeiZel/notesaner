import type { Config } from 'tailwindcss';

/**
 * Tailwind CSS 4 configuration for apps/web.
 *
 * Note: In Tailwind CSS 4, most configuration is done via @theme in the CSS file
 * (packages/ui/src/styles/main.css). This config primarily sets up content paths
 * and any remaining JS-level configuration.
 *
 * Design tokens are defined in: packages/ui/src/styles/tokens.css
 * Tailwind theme mapping is in: packages/ui/src/styles/main.css
 */
const config: Config = {
  // Tailwind CSS 4 uses CSS-first configuration, but content paths
  // are still needed for the purge/tree-shaking step.
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  // Dark mode is controlled via data-theme attribute on <html>
  // (set to "dark" by default in root layout)
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {},
  },
  plugins: [],
};

export default config;
