/**
 * shared/ — FSD shared layer.
 *
 * Import from individual segments instead of this barrel to avoid
 * namespace collisions and enable precise tree-shaking:
 *
 *   import { Box, ErrorBoundary } from '@/shared/ui';
 *   import { apiClient, ApiError } from '@/shared/api';
 *   import { cn, debounce } from '@/shared/lib';
 *   import { useBreakpoint } from '@/shared/hooks';
 *   import { useAuthStore } from '@/shared/stores';
 *   import { clientEnv } from '@/shared/config';
 *
 * The theme sub-system has its own deep export path:
 *   import { useTheme, ThemeToggle } from '@/shared/lib/theme';
 *
 * This file intentionally does NOT re-export from segments to prevent
 * name collisions (e.g., PanelConfig exists in both layout and sidebar
 * stores) and to encourage explicit, segment-qualified imports.
 */
