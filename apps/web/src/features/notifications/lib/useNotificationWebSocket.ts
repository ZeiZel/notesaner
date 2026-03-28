'use client';

/**
 * useNotificationWebSocket -- connects to the notification WebSocket gateway
 * and dispatches real-time events to the notification Zustand store.
 *
 * Valid useEffect use case: third-party/browser API integration (WebSocket)
 * that has no React equivalent. The WebSocket is a persistent external
 * subscription that must be managed imperatively.
 *
 * Reconnects automatically on disconnect with exponential back-off.
 */

import { useEffect, useRef } from 'react';
import { clientEnv } from '@/shared/config/env';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useNotificationStore } from '@/shared/stores/notification-store';
import type { NotificationDto } from '@/shared/api/notifications';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** WebSocket event names — must match backend constants. */
const WS_NOTIFICATION_NEW = 'notification:new';
const WS_UNREAD_COUNT = 'notification:unread-count';

/** Reconnection parameters. */
const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 30_000;
const RECONNECT_BACKOFF_MULTIPLIER = 2;

// ---------------------------------------------------------------------------
// WebSocket message types
// ---------------------------------------------------------------------------

interface WsNewNotificationMessage {
  event: typeof WS_NOTIFICATION_NEW;
  data: NotificationDto;
}

interface WsUnreadCountMessage {
  event: typeof WS_UNREAD_COUNT;
  data: { count: number };
}

type WsNotificationMessage = WsNewNotificationMessage | WsUnreadCountMessage;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useNotificationWebSocket(): void {
  const userId = useAuthStore((s) => s.user?.id);
  const token = useAuthStore((s) => s.accessToken);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const reconnectDelayRef = useRef(INITIAL_RECONNECT_DELAY_MS);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Valid useEffect: WebSocket is an external subscription (browser API)
  // that cannot be expressed as a React state derivation or event handler.
  useEffect(() => {
    if (!isAuthenticated || !userId || !token) {
      return;
    }

    let isCancelled = false;

    function connect() {
      if (isCancelled) return;

      // userId and token are guaranteed non-null by the guard above
      const wsUrl = `${clientEnv.wsUrl}/notifications?userId=${encodeURIComponent(userId as string)}&token=${encodeURIComponent(token as string)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelayRef.current = INITIAL_RECONNECT_DELAY_MS;
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data as string) as WsNotificationMessage;

          if (message.event === WS_NOTIFICATION_NEW) {
            const notification = message.data as NotificationDto;
            const store = useNotificationStore.getState();

            // Prepend the new notification to the list (most recent first)
            useNotificationStore.setState(
              {
                notifications: [notification, ...store.notifications],
                unreadCount: store.unreadCount + 1,
                total: store.total + 1,
              },
              false,
              'notifications/wsNewNotification' as never,
            );
          }

          if (message.event === WS_UNREAD_COUNT) {
            const { count } = message.data;
            useNotificationStore.setState(
              { unreadCount: count },
              false,
              'notifications/wsUnreadCount' as never,
            );
          }
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!isCancelled) {
          scheduleReconnect();
        }
      };

      ws.onerror = () => {
        // The WebSocket will fire 'close' after 'error', triggering reconnect.
        // Nothing extra needed here.
      };
    }

    function scheduleReconnect() {
      if (isCancelled) return;

      reconnectTimerRef.current = setTimeout(() => {
        reconnectDelayRef.current = Math.min(
          reconnectDelayRef.current * RECONNECT_BACKOFF_MULTIPLIER,
          MAX_RECONNECT_DELAY_MS,
        );
        connect();
      }, reconnectDelayRef.current);
    }

    connect();

    return () => {
      isCancelled = true;

      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [isAuthenticated, userId, token]);
}
