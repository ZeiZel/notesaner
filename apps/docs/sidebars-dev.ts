import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

/**
 * Developer Docs sidebar — maps to apps/docs/dev/ directory
 * Served at /docs/...
 */
const sidebars: SidebarsConfig = {
  devSidebar: [
    {
      type: 'category',
      label: 'Self-Hosting Guide',
      collapsed: false,
      items: [
        'self-hosting/overview',
        'self-hosting/docker-compose',
        'self-hosting/env-vars',
        'self-hosting/postgresql',
        'self-hosting/valkey',
        'self-hosting/file-storage',
        'self-hosting/reverse-proxy',
        'self-hosting/https-tls',
        {
          type: 'category',
          label: 'Authentication',
          items: [
            'self-hosting/auth/built-in',
            'self-hosting/auth/saml-sso',
            'self-hosting/auth/oidc',
          ],
        },
        'self-hosting/upgrading',
        'self-hosting/backup-restore',
        'self-hosting/monitoring',
        'self-hosting/troubleshooting',
      ],
    },
    {
      type: 'category',
      label: 'Architecture Overview',
      items: [
        'architecture/system-diagram',
        'architecture/monorepo',
        'architecture/frontend-fsd',
        'architecture/backend-clean-arch',
        'architecture/yjs-crdt',
        'architecture/plugin-system',
        'architecture/storage-model',
        'architecture/auth-flow',
        'architecture/event-driven',
        'architecture/dependency-graph',
      ],
    },
    {
      type: 'category',
      label: 'API Reference',
      items: [
        'api-reference/overview',
        'api-reference/authentication',
        'api-reference/rate-limiting',
        {
          type: 'category',
          label: 'Endpoints',
          items: [
            'api-reference/endpoints/notes',
            'api-reference/endpoints/folders',
            'api-reference/endpoints/tags',
            'api-reference/endpoints/search',
            'api-reference/endpoints/users-workspaces',
            'api-reference/endpoints/plugins',
            'api-reference/endpoints/webhooks',
          ],
        },
        'api-reference/websocket-events',
        'api-reference/error-codes',
        'api-reference/changelog',
      ],
    },
    {
      type: 'category',
      label: 'Component Library',
      items: [
        'component-library/overview',
        'component-library/design-tokens',
        {
          type: 'category',
          label: 'Components',
          items: [
            'component-library/components/layout',
            'component-library/components/typography',
            'component-library/components/inputs',
            'component-library/components/overlays',
            'component-library/components/feedback',
            'component-library/components/navigation',
            'component-library/components/editor',
          ],
        },
        'component-library/theming',
        'component-library/contributing',
      ],
    },
    {
      type: 'category',
      label: 'Plugin Development Guide',
      items: [
        {
          type: 'category',
          label: 'Getting Started',
          items: [
            'plugin-development/getting-started/architecture',
            'plugin-development/getting-started/hello-world',
            'plugin-development/getting-started/dev-setup',
            'plugin-development/getting-started/manifest',
          ],
        },
        {
          type: 'category',
          label: 'Plugin SDK',
          items: [
            'plugin-development/sdk/overview',
            'plugin-development/sdk/editor-api',
            'plugin-development/sdk/storage-api',
            'plugin-development/sdk/ui-api',
            'plugin-development/sdk/events-api',
            'plugin-development/sdk/settings-api',
          ],
        },
        {
          type: 'category',
          label: 'Guides',
          items: [
            'plugin-development/guides/reading-writing',
            'plugin-development/guides/toolbar-buttons',
            'plugin-development/guides/settings-panel',
            'plugin-development/guides/postmessage',
            'plugin-development/guides/external-libraries',
            'plugin-development/guides/i18n',
          ],
        },
        {
          type: 'category',
          label: 'Security Model',
          items: [
            'plugin-development/security/sandbox',
            'plugin-development/security/permissions',
            'plugin-development/security/review-process',
          ],
        },
        {
          type: 'category',
          label: 'Publishing',
          items: [
            'plugin-development/publishing/registry',
            'plugin-development/publishing/submit',
            'plugin-development/publishing/versioning',
            'plugin-development/publishing/guidelines',
          ],
        },
        'plugin-development/api-reference',
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: [
        'contributing/overview',
        'contributing/dev-setup',
        'contributing/repo-structure',
        {
          type: 'category',
          label: 'Coding Standards',
          items: [
            'contributing/standards/typescript',
            'contributing/standards/frontend',
            'contributing/standards/backend',
            'contributing/standards/testing',
          ],
        },
        {
          type: 'category',
          label: 'Running Tests',
          items: ['contributing/tests/unit-tests', 'contributing/tests/e2e-tests'],
        },
        'contributing/pull-request',
        'contributing/issue-reporting',
        'contributing/docs-contributions',
        'contributing/code-of-conduct',
      ],
    },
  ],
};

export default sidebars;
