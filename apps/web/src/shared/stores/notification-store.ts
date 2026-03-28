import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  notificationsApi,
  type NotificationDto,
  type NotificationType,
} from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationState {
  // State
  notifications: NotificationDto[];
  unreadCount: number;
  total: number;
  isLoading: boolean;
  isOpen: boolean;
  hasMore: boolean;
  offset: number;
  filterType: NotificationType | null;

  // Actions
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setFilterType: (type: NotificationType | null) => void;

  // Async actions (require token)
  fetchNotifications: (token: string, reset?: boolean) => Promise<void>;
  fetchUnreadCount: (token: string) => Promise<void>;
  markAsRead: (token: string, notificationId: string) => Promise<void>;
  markAllAsRead: (token: string) => Promise<void>;
  loadMore: (token: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 20;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useNotificationStore = create<NotificationState>()(
  devtools(
    (set, get) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      total: 0,
      isLoading: false,
      isOpen: false,
      hasMore: false,
      offset: 0,
      filterType: null,

      // ── Sync actions ────────────────────────────────────────────────────

      setOpen: (open) => set({ isOpen: open }, false, 'notifications/setOpen'),

      toggleOpen: () =>
        set((state) => ({ isOpen: !state.isOpen }), false, 'notifications/toggleOpen'),

      setFilterType: (type) =>
        set(
          { filterType: type, offset: 0, notifications: [] },
          false,
          'notifications/setFilterType',
        ),

      // ── Async actions ───────────────────────────────────────────────────

      fetchNotifications: async (token, reset = false) => {
        const { filterType } = get();
        const offset = reset ? 0 : get().offset;

        set({ isLoading: true }, false, 'notifications/fetchStart');

        try {
          const response = await notificationsApi.getNotifications(token, {
            limit: PAGE_SIZE,
            offset,
            ...(filterType ? { type: filterType } : {}),
          });

          set(
            {
              notifications: reset ? response.data : [...get().notifications, ...response.data],
              unreadCount: response.unreadCount,
              total: response.pagination.total,
              hasMore: response.pagination.hasMore,
              offset: offset + response.data.length,
              isLoading: false,
            },
            false,
            'notifications/fetchSuccess',
          );
        } catch {
          set({ isLoading: false }, false, 'notifications/fetchError');
        }
      },

      fetchUnreadCount: async (token) => {
        try {
          const response = await notificationsApi.getUnreadCount(token);
          set({ unreadCount: response.count }, false, 'notifications/unreadCountUpdate');
        } catch {
          // Silently fail — unread count is non-critical
        }
      },

      markAsRead: async (token, notificationId) => {
        // Optimistic update
        set(
          (state) => ({
            notifications: state.notifications.map((n) =>
              n.id === notificationId ? { ...n, isRead: true } : n,
            ),
            unreadCount: Math.max(0, state.unreadCount - 1),
          }),
          false,
          'notifications/markAsReadOptimistic',
        );

        try {
          await notificationsApi.markAsRead(token, notificationId);
        } catch {
          // Revert optimistic update on failure
          set(
            (state) => ({
              notifications: state.notifications.map((n) =>
                n.id === notificationId ? { ...n, isRead: false } : n,
              ),
              unreadCount: state.unreadCount + 1,
            }),
            false,
            'notifications/markAsReadRevert',
          );
        }
      },

      markAllAsRead: async (token) => {
        const previousNotifications = get().notifications;
        const previousUnreadCount = get().unreadCount;

        // Optimistic update
        set(
          (state) => ({
            notifications: state.notifications.map((n) => ({ ...n, isRead: true })),
            unreadCount: 0,
          }),
          false,
          'notifications/markAllAsReadOptimistic',
        );

        try {
          await notificationsApi.markAllAsRead(token);
        } catch {
          // Revert on failure
          set(
            {
              notifications: previousNotifications,
              unreadCount: previousUnreadCount,
            },
            false,
            'notifications/markAllAsReadRevert',
          );
        }
      },

      loadMore: async (token) => {
        const { hasMore, isLoading } = get();
        if (!hasMore || isLoading) return;
        await get().fetchNotifications(token, false);
      },
    }),
    { name: 'NotificationStore' },
  ),
);
