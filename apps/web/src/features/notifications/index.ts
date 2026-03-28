/**
 * features/notifications -- public API (FSD barrel export).
 *
 * All imports from this feature MUST go through this file.
 */

// ---- UI components ----
export { NotificationBell } from './ui/NotificationBell';
export { NotificationPanel } from './ui/NotificationPanel';
export { NotificationSettings } from './ui/NotificationSettings';
export { NotificationEmptyState } from './ui/NotificationEmptyState';
export { NotificationItem } from './ui/NotificationItem';

// ---- Lib / Hooks ----
export { useNotificationWebSocket } from './lib/useNotificationWebSocket';
export {
  getNotificationUrl,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_DESCRIPTIONS,
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_ICONS,
} from './lib/notification-helpers';
