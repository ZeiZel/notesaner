/**
 * shared/ui — Reusable UI primitives.
 *
 * Components here are generic, design-system-level building blocks
 * with no business logic. They may only import from shared/lib and shared/config.
 */

// Layout primitive
export { Box, type BoxProps } from './Box';

// Error isolation
export {
  ErrorBoundary,
  type ErrorBoundaryProps,
  type ErrorBoundaryFallbackProps,
} from './ErrorBoundary';

// Connectivity fallback
export { OfflineFallback, OfflinePage, useOnlineStatus } from './OfflineFallback';

// Accessibility — skip navigation link (WCAG 2.4.1)
export { SkipNavigation } from './SkipNavigation';

// Virtualization
export { VirtualList, type VirtualListProps, type VirtualListHandle } from './VirtualList';
export {
  VirtualTree,
  type TreeNode,
  type FlatNode,
  type VirtualTreeProps,
  type VirtualTreeHandle,
} from './VirtualTree';

// Loading skeletons
export {
  InlineSpinner,
  PanelSpinner,
  EditorSkeleton,
  GraphSkeleton,
  PluginBrowserSkeleton,
  SettingsSkeleton,
  AuditLogSkeleton,
  FileTreeSkeleton,
  SearchResultsSkeleton,
} from './skeletons';
