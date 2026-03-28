/**
 * Centralized lazy-loaded component registry.
 *
 * All heavy feature components that should NOT be in the initial bundle are
 * defined here using `next/dynamic()`. Importing from this module triggers the
 * dynamic import only when the component is first rendered.
 *
 * Preload functions are also exported for hover-based preloading.
 *
 * @module shared/lib/lazy-components
 */

import dynamic from 'next/dynamic';
import { preloadOnHover } from './lazy';

// ---------------------------------------------------------------------------
// Graph View (heavy: WebGL/SVG canvas, force simulation)
// ---------------------------------------------------------------------------

export const LazyLocalGraphPanel = dynamic(
  () => import('@/features/workspace/ui/LocalGraphPanel').then((m) => m.LocalGraphPanel),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Settings Dialog (many sub-tabs, form components)
// ---------------------------------------------------------------------------

export const LazySettingsDialog = dynamic(
  () => import('@/features/settings/ui/SettingsDialog').then((m) => m.SettingsDialog),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Plugin Browser (grid, modals, search, filters)
// ---------------------------------------------------------------------------

export const LazyPluginBrowser = dynamic(
  () => import('@/features/plugins/ui/PluginBrowser').then((m) => m.PluginBrowser),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Plugin Settings Page
// ---------------------------------------------------------------------------

export const LazyPluginSettingsPage = dynamic(
  () => import('@/features/plugins/ui/PluginSettingsPage').then((m) => m.PluginSettingsPage),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Audit Log Viewer (admin only — large table, filters, export)
// ---------------------------------------------------------------------------

export const LazyAuditLogViewer = dynamic(
  () => import('@/features/admin/ui/AuditLogViewer').then((m) => m.AuditLogViewer),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Publish Features (analytics, domain settings, theme settings)
// ---------------------------------------------------------------------------

export const LazyAnalyticsDashboard = dynamic(
  () => import('@/features/publish/ui/AnalyticsDashboard').then((m) => m.AnalyticsDashboard),
  { ssr: false, loading: () => null },
);

export const LazyDomainSettings = dynamic(
  () => import('@/features/publish/ui/DomainSettings').then((m) => m.DomainSettings),
  { ssr: false, loading: () => null },
);

export const LazyPublicThemeSettings = dynamic(
  () => import('@/features/publish/ui/PublicThemeSettings').then((m) => m.PublicThemeSettings),
  { ssr: false, loading: () => null },
);

export const LazyCommentModerationQueue = dynamic(
  () =>
    import('@/features/publish/ui/CommentModerationQueue').then((m) => m.CommentModerationQueue),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Properties Panel (right sidebar — loaded on demand)
// ---------------------------------------------------------------------------

export const LazyPropertiesPanel = dynamic(
  () => import('@/features/workspace/ui/PropertiesPanel').then((m) => m.PropertiesPanel),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Unlinked Mentions Panel (right sidebar)
// ---------------------------------------------------------------------------

export const LazyUnlinkedMentionsPanel = dynamic(
  () =>
    import('@/features/workspace/ui/UnlinkedMentionsPanel').then((m) => m.UnlinkedMentionsPanel),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Command Palette
// ---------------------------------------------------------------------------

export const LazyCommandPaletteDialog = dynamic(
  () => import('@/features/workspace/ui/CommandPaletteDialog').then((m) => m.CommandPaletteDialog),
  { ssr: false, loading: () => null },
);

// ---------------------------------------------------------------------------
// Preload helpers (attach to navigation links for hover preloading)
// ---------------------------------------------------------------------------

export const preloadGraph = preloadOnHover(
  'graph-panel',
  () => import('@/features/workspace/ui/LocalGraphPanel'),
);

export const preloadSettings = preloadOnHover(
  'settings-dialog',
  () => import('@/features/settings/ui/SettingsDialog'),
);

export const preloadPluginBrowser = preloadOnHover(
  'plugin-browser',
  () => import('@/features/plugins/ui/PluginBrowser'),
);

export const preloadAuditLog = preloadOnHover(
  'audit-log',
  () => import('@/features/admin/ui/AuditLogViewer'),
);
