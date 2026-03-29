import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * User Help sidebar — maps to apps/docs/help/ directory
 * Served at /help/...
 */
const sidebars: SidebarsConfig = {
  helpSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      collapsed: false,
      items: [
        'getting-started/what-is-notesaner',
        'getting-started/install-setup',
        'getting-started/first-note',
        'getting-started/folders-tags',
        'getting-started/link-notes',
        'getting-started/graph-view',
        'getting-started/import',
        'getting-started/keyboard-shortcuts',
        'getting-started/mobile',
        'getting-started/glossary',
      ],
    },
    {
      type: 'category',
      label: 'User Guide',
      items: [
        {
          type: 'category',
          label: 'Editor',
          items: [
            'user-guide/editor/markdown-syntax',
            'user-guide/editor/rich-text',
            'user-guide/editor/tables',
            'user-guide/editor/code-blocks',
            'user-guide/editor/embeds',
            'user-guide/editor/callouts',
            'user-guide/editor/front-matter',
          ],
        },
        {
          type: 'category',
          label: 'Notes & Folders',
          items: [
            'user-guide/notes-folders/create-rename',
            'user-guide/notes-folders/move-organize',
            'user-guide/notes-folders/attachments',
            'user-guide/notes-folders/templates',
            'user-guide/notes-folders/history',
          ],
        },
        {
          type: 'category',
          label: 'Linking & Knowledge Graph',
          items: [
            'user-guide/linking/internal-links',
            'user-guide/linking/backlinks',
            'user-guide/linking/graph-view',
            'user-guide/linking/outgoing-links',
            'user-guide/linking/zettelkasten',
          ],
        },
        {
          type: 'category',
          label: 'Search',
          items: [
            'user-guide/search/full-text-search',
            'user-guide/search/advanced-syntax',
            'user-guide/search/saved-searches',
          ],
        },
        {
          type: 'category',
          label: 'Tags & Metadata',
          items: [
            'user-guide/tags-metadata/tags',
            'user-guide/tags-metadata/properties',
            'user-guide/tags-metadata/filtering',
          ],
        },
        {
          type: 'category',
          label: 'Workspaces & Layout',
          items: [
            'user-guide/workspaces/panels-tabs',
            'user-guide/workspaces/split-views',
            'user-guide/workspaces/sidebar',
            'user-guide/workspaces/workspace-presets',
          ],
        },
        {
          type: 'category',
          label: 'Daily Notes & Journals',
          items: [
            'user-guide/daily-notes/setup',
            'user-guide/daily-notes/templates',
            'user-guide/daily-notes/calendar',
          ],
        },
        {
          type: 'category',
          label: 'Appearance & Theming',
          items: [
            'user-guide/appearance/themes',
            'user-guide/appearance/custom-css',
            'user-guide/appearance/light-dark',
          ],
        },
      ],
    },
    {
      type: 'category',
      label: 'Collaboration',
      items: [
        'collaboration/overview',
        'collaboration/invite',
        'collaboration/shared-workspaces',
        'collaboration/comments',
        'collaboration/presence',
        'collaboration/conflict-resolution',
      ],
    },
    {
      type: 'category',
      label: 'Plugins',
      items: [
        'plugins/core-plugins',
        'plugins/ai-assistant',
        'plugins/backlinks-panel',
        'plugins/calendar-daily-notes',
        'plugins/database-view',
        'plugins/diagrams-mermaid',
        'plugins/drawing-excalidraw',
        'plugins/focus-mode',
        'plugins/graph-view',
        'plugins/kanban-board',
        'plugins/pdf-export',
        'plugins/slides',
        'plugins/spaced-repetition',
        'plugins/templates',
        'plugins/web-clipper',
        'plugins/install-plugins',
        'plugins/manage-plugins',
        'plugins/plugin-settings',
      ],
    },
    {
      type: 'category',
      label: 'Account & Settings',
      items: [
        'account/account-profile',
        'account/notifications',
        'account/security-2fa',
        'account/billing',
        'account/export-data',
      ],
    },
    {
      type: 'category',
      label: 'Troubleshooting',
      items: [
        'troubleshooting/login-access',
        'troubleshooting/sync-issues',
        'troubleshooting/editor-performance',
        'troubleshooting/plugin-errors',
        'troubleshooting/contact-support',
      ],
    },
  ],
};

export default sidebars;
