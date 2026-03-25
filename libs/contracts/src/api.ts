/** API route definitions shared between frontend and backend */

export const API_ROUTES = {
  auth: {
    login: '/api/auth/login',
    register: '/api/auth/register',
    refresh: '/api/auth/refresh',
    logout: '/api/auth/logout',
    me: '/api/auth/me',
    providers: '/api/auth/providers',
    saml: {
      callback: '/api/auth/saml/callback',
      metadata: '/api/auth/saml/metadata',
    },
    oidc: {
      callback: '/api/auth/oidc/callback',
    },
  },
  workspaces: {
    list: '/api/workspaces',
    create: '/api/workspaces',
    get: (id: string) => `/api/workspaces/${id}`,
    update: (id: string) => `/api/workspaces/${id}`,
    delete: (id: string) => `/api/workspaces/${id}`,
    members: (id: string) => `/api/workspaces/${id}/members`,
  },
  notes: {
    list: (workspaceId: string) => `/api/workspaces/${workspaceId}/notes`,
    create: (workspaceId: string) => `/api/workspaces/${workspaceId}/notes`,
    get: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}`,
    update: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}`,
    delete: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}`,
    content: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}/content`,
    versions: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}/versions`,
    links: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}/links`,
    backlinks: (workspaceId: string, noteId: string) =>
      `/api/workspaces/${workspaceId}/notes/${noteId}/backlinks`,
    search: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/notes/search`,
    graph: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/graph`,
  },
  tags: {
    list: (workspaceId: string) => `/api/workspaces/${workspaceId}/tags`,
  },
  plugins: {
    search: '/api/plugins/search',
    installed: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/plugins`,
    install: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/plugins/install`,
    uninstall: (workspaceId: string, pluginId: string) =>
      `/api/workspaces/${workspaceId}/plugins/${pluginId}`,
    toggle: (workspaceId: string, pluginId: string) =>
      `/api/workspaces/${workspaceId}/plugins/${pluginId}/toggle`,
    settings: (workspaceId: string, pluginId: string) =>
      `/api/workspaces/${workspaceId}/plugins/${pluginId}/settings`,
  },
  publish: {
    config: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/publish`,
    public: (slug: string) => `/public/${slug}`,
    note: (slug: string, notePath: string) =>
      `/public/${slug}/${notePath}`,
  },
  layouts: {
    list: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/layouts`,
    save: (workspaceId: string) =>
      `/api/workspaces/${workspaceId}/layouts`,
  },
  health: '/api/health',
} as const;
