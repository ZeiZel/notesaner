import { apiClient } from './client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'COMMENT_MENTION'
  | 'NOTE_SHARED'
  | 'WORKSPACE_INVITE'
  | 'SYSTEM_ANNOUNCEMENT';

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'BOTH' | 'NONE';

export type DigestFrequency = 'DAILY' | 'WEEKLY' | 'NONE';

export interface NotificationDto {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  isRead: boolean;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface NotificationListResponse {
  data: NotificationDto[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  unreadCount: number;
}

export interface UnreadCountResponse {
  count: number;
}

export interface NotificationPreferenceItem {
  type: NotificationType;
  channel: NotificationChannel;
}

export interface PreferencesResponse {
  preferences: NotificationPreferenceItem[];
  frequency: DigestFrequency;
  lastSentAt: string | null;
}

export interface DigestScheduleResponse {
  frequency: DigestFrequency;
  lastSentAt: string | null;
}

export interface GetNotificationsParams {
  limit?: number;
  offset?: number;
  type?: NotificationType;
  isRead?: boolean;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export const notificationsApi = {
  /**
   * GET /api/notifications
   *
   * Returns a paginated list of notifications for the authenticated user.
   */
  getNotifications: (
    token: string,
    params: GetNotificationsParams = {},
  ): Promise<NotificationListResponse> => {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', String(params.limit));
    if (params.offset !== undefined) searchParams.set('offset', String(params.offset));
    if (params.type) searchParams.set('type', params.type);
    if (params.isRead !== undefined) searchParams.set('isRead', String(params.isRead));

    const qs = searchParams.toString();
    const url = `/api/notifications${qs ? `?${qs}` : ''}`;

    return apiClient.get<NotificationListResponse>(url, { token });
  },

  /**
   * GET /api/notifications/unread-count
   *
   * Returns the unread notification count for the authenticated user.
   */
  getUnreadCount: (token: string): Promise<UnreadCountResponse> =>
    apiClient.get<UnreadCountResponse>('/api/notifications/unread-count', { token }),

  /**
   * PATCH /api/notifications/:id/read
   *
   * Marks a single notification as read.
   */
  markAsRead: (token: string, notificationId: string): Promise<NotificationDto> =>
    apiClient.patch<NotificationDto>(`/api/notifications/${notificationId}/read`, {}, { token }),

  /**
   * POST /api/notifications/read-all
   *
   * Marks all notifications as read.
   */
  markAllAsRead: (token: string): Promise<{ updated: number }> =>
    apiClient.post<{ updated: number }>('/api/notifications/read-all', {}, { token }),

  /**
   * GET /api/notifications/preferences
   *
   * Returns notification preferences and digest schedule.
   */
  getPreferences: (token: string): Promise<PreferencesResponse> =>
    apiClient.get<PreferencesResponse>('/api/notifications/preferences', { token }),

  /**
   * PUT /api/notifications/preferences
   *
   * Updates notification channel preferences.
   */
  updatePreferences: (
    token: string,
    preferences: NotificationPreferenceItem[],
  ): Promise<NotificationPreferenceItem[]> =>
    apiClient.put<NotificationPreferenceItem[]>(
      '/api/notifications/preferences',
      { preferences },
      { token },
    ),

  /**
   * PUT /api/notifications/digest
   *
   * Updates the digest email schedule.
   */
  updateDigestSchedule: (
    token: string,
    frequency: DigestFrequency,
  ): Promise<DigestScheduleResponse> =>
    apiClient.put<DigestScheduleResponse>('/api/notifications/digest', { frequency }, { token }),
};
