import { themes as prismThemes } from 'prism-react-renderer';
import type { Config } from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: 'Notesaner',
  tagline: 'The open-source, collaborative note-taking platform',
  favicon: 'img/favicon.ico',

  url: 'https://docs.notesaner.com',
  baseUrl: '/',

  organizationName: 'notesaner',
  projectName: 'notesaner',

  onBrokenLinks: 'warn',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        // Disable default docs — we use multi-instance below
        docs: false,
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
        sitemap: {
          changefreq: 'weekly',
          priority: 0.5,
        },
      } satisfies Preset.Options,
    ],
  ],

  plugins: [
    // User Help docs — /help/...
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'help',
        path: 'help',
        routeBasePath: 'help',
        sidebarPath: './sidebars.ts',
        editUrl: 'https://github.com/notesaner/notesaner/tree/main/apps/docs/',
        showLastUpdateTime: true,
        showLastUpdateAuthor: false,
      },
    ],
    // Developer Docs — /docs/...
    [
      '@docusaurus/plugin-content-docs',
      {
        id: 'dev',
        path: 'dev',
        routeBasePath: 'docs',
        sidebarPath: './sidebars-dev.ts',
        editUrl: 'https://github.com/notesaner/notesaner/tree/main/apps/docs/',
        showLastUpdateTime: true,
        showLastUpdateAuthor: false,
      },
    ],
  ],

  themeConfig: {
    image: 'img/notesaner-social-card.png',

    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },

    navbar: {
      title: 'Notesaner',
      logo: {
        alt: 'Notesaner Logo',
        src: 'img/logo.svg',
        srcDark: 'img/logo-dark.svg',
      },
      items: [
        {
          to: '/help',
          label: 'Help Center',
          position: 'left',
          activeBaseRegex: '^/help',
        },
        {
          to: '/docs',
          label: 'Developer Docs',
          position: 'left',
          activeBaseRegex: '^/docs',
        },
        {
          to: '/docs/api-reference/overview',
          label: 'API',
          position: 'left',
        },
        {
          to: '/storybook',
          label: 'Components',
          position: 'left',
        },
        {
          to: '/api-explorer',
          label: 'API Explorer',
          position: 'left',
        },
        {
          href: 'https://github.com/notesaner/notesaner',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },

    footer: {
      style: 'dark',
      links: [
        {
          title: 'Help Center',
          items: [
            { label: 'Getting Started', to: '/help/getting-started/what-is-notesaner' },
            { label: 'User Guide', to: '/help/user-guide/editor/markdown-syntax' },
            { label: 'Collaboration', to: '/help/collaboration/overview' },
            { label: 'Plugins', to: '/help/plugins/core-plugins' },
          ],
        },
        {
          title: 'Developer Docs',
          items: [
            { label: 'Self-Hosting', to: '/docs/self-hosting/overview' },
            { label: 'Architecture', to: '/docs/architecture/system-diagram' },
            { label: 'API Reference', to: '/docs/api-reference/overview' },
            { label: 'API Explorer', to: '/api-explorer' },
            {
              label: 'Plugin Development',
              to: '/docs/plugin-development/getting-started/architecture',
            },
            { label: 'Component Library', to: '/storybook' },
          ],
        },
        {
          title: 'Community',
          items: [
            { label: 'GitHub', href: 'https://github.com/notesaner/notesaner' },
            { label: 'Contributing', to: '/docs/contributing/overview' },
            { label: 'Code of Conduct', to: '/docs/contributing/code-of-conduct' },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} Notesaner. Built with Docusaurus.`,
    },

    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: [
        'bash',
        'typescript',
        'json',
        'yaml',
        'docker',
        'nginx',
        'sql',
        'markdown',
      ],
    },

    // Algolia DocSearch — configure when index is ready
    // algolia: {
    //   appId: 'YOUR_APP_ID',
    //   apiKey: 'YOUR_SEARCH_API_KEY',
    //   indexName: 'notesaner',
    //   contextualSearch: true,
    //   searchPagePath: 'search',
    // },
  } satisfies Preset.ThemeConfig,
};

export default config;
