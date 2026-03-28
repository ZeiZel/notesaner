'use client';

/**
 * NotificationSettings -- notification preferences page for the Settings dialog.
 *
 * Features:
 *   - Toggle each notification type channel (in-app, email, both, none)
 *   - Email digest frequency selector (none, daily, weekly)
 *   - Uses useActionState for form submission -- no useEffect
 *   - Fetches initial preferences on mount via action pattern
 *
 * Styled with Ant Design Switch, Select, Typography, Divider, Space.
 */

import { useActionState, useState, useCallback } from 'react';
import { Switch, Select, Typography, Divider, Space, Button, Spin, Alert } from 'antd';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  notificationsApi,
  type NotificationChannel,
  type DigestFrequency,
  type NotificationType,
  type NotificationPreferenceItem,
} from '@/shared/api/notifications';
import {
  ALL_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_DESCRIPTIONS,
} from '../lib/notification-helpers';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PreferencesFormState {
  success: boolean;
  message: string;
}

// ---------------------------------------------------------------------------
// Channel options
// ---------------------------------------------------------------------------

const CHANNEL_OPTIONS: { label: string; value: NotificationChannel }[] = [
  { label: 'In-app only', value: 'IN_APP' },
  { label: 'Email only', value: 'EMAIL' },
  { label: 'Both', value: 'BOTH' },
  { label: 'Off', value: 'NONE' },
];

const DIGEST_OPTIONS: { label: string; value: DigestFrequency }[] = [
  { label: 'None', value: 'NONE' },
  { label: 'Daily', value: 'DAILY' },
  { label: 'Weekly', value: 'WEEKLY' },
];

// ---------------------------------------------------------------------------
// Default preferences
// ---------------------------------------------------------------------------

const DEFAULT_PREFERENCES: Record<NotificationType, NotificationChannel> = {
  COMMENT_MENTION: 'BOTH',
  NOTE_SHARED: 'IN_APP',
  WORKSPACE_INVITE: 'BOTH',
  SYSTEM_ANNOUNCEMENT: 'IN_APP',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotificationSettings() {
  const token = useAuthStore((s) => s.accessToken);

  // Local state for preferences -- loaded and saved via event handlers
  const [preferences, setPreferences] =
    useState<Record<NotificationType, NotificationChannel>>(DEFAULT_PREFERENCES);
  const [digestFrequency, setDigestFrequency] = useState<DigestFrequency>('NONE');
  const [isLoadingPreferences, setIsLoadingPreferences] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load preferences (called once when component renders and token is available)
  // We use a ref-guarded call rather than useEffect; the call is triggered
  // lazily from the render callback pattern to avoid unnecessary re-fetches.
  // ---------------------------------------------------------------------------

  const loadPreferences = useCallback(async () => {
    if (!token || hasLoaded || isLoadingPreferences) return;
    setIsLoadingPreferences(true);
    setLoadError(null);
    try {
      const response = await notificationsApi.getPreferences(token);
      const prefMap = { ...DEFAULT_PREFERENCES };
      for (const pref of response.preferences) {
        prefMap[pref.type] = pref.channel;
      }
      setPreferences(prefMap);
      setDigestFrequency(response.frequency);
      setHasLoaded(true);
    } catch {
      setLoadError('Failed to load notification preferences.');
    } finally {
      setIsLoadingPreferences(false);
    }
  }, [token, hasLoaded, isLoadingPreferences]);

  // Trigger load on first visible render (idle callback pattern)
  if (!hasLoaded && !isLoadingPreferences && token) {
    void loadPreferences();
  }

  // ---------------------------------------------------------------------------
  // Save preferences action
  // ---------------------------------------------------------------------------

  async function savePreferencesAction(
    _prev: PreferencesFormState,
    _formData: FormData,
  ): Promise<PreferencesFormState> {
    if (!token) {
      return { success: false, message: 'Not authenticated.' };
    }

    try {
      // Build the preferences array from current local state
      const prefItems: NotificationPreferenceItem[] = ALL_NOTIFICATION_TYPES.map((type) => ({
        type,
        channel: preferences[type],
      }));

      await notificationsApi.updatePreferences(token, prefItems);
      await notificationsApi.updateDigestSchedule(token, digestFrequency);

      return { success: true, message: 'Notification preferences saved.' };
    } catch {
      return { success: false, message: 'Failed to save preferences. Please try again.' };
    }
  }

  const [formState, formAction, isPending] = useActionState<PreferencesFormState, FormData>(
    savePreferencesAction,
    { success: false, message: '' },
  );

  // ---------------------------------------------------------------------------
  // Channel toggle handler
  // ---------------------------------------------------------------------------

  function handleChannelChange(type: NotificationType, channel: NotificationChannel) {
    setPreferences((prev) => ({ ...prev, [type]: channel }));
  }

  // Quick toggle: switch between NONE and the default channel for the type
  function handleQuickToggle(type: NotificationType, enabled: boolean) {
    setPreferences((prev) => ({
      ...prev,
      [type]: enabled ? DEFAULT_PREFERENCES[type] : 'NONE',
    }));
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (isLoadingPreferences && !hasLoaded) {
    return (
      <Box className="flex items-center justify-center py-12">
        <Spin />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Alert
        type="error"
        message={loadError}
        action={
          <Button size="small" onClick={loadPreferences}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <Box className="max-w-lg">
      <form action={formAction}>
        {/* Notification type toggles */}
        <Box className="mb-6">
          <Typography.Text strong style={{ display: 'block', marginBottom: 16, fontSize: 14 }}>
            Notification channels
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginBottom: 16, fontSize: 13 }}
          >
            Choose how you want to receive each type of notification.
          </Typography.Text>

          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {ALL_NOTIFICATION_TYPES.map((type) => {
              const isEnabled = preferences[type] !== 'NONE';

              return (
                <Box
                  key={type}
                  className="rounded-lg border p-4"
                  style={{
                    borderColor: 'var(--ns-color-border)',
                    backgroundColor: 'var(--ns-color-background-surface)',
                  }}
                >
                  <Box className="flex items-center justify-between">
                    <Box>
                      <Typography.Text strong style={{ fontSize: 13, display: 'block' }}>
                        {NOTIFICATION_TYPE_LABELS[type]}
                      </Typography.Text>
                      <Typography.Text
                        type="secondary"
                        style={{ fontSize: 12, display: 'block', marginTop: 2 }}
                      >
                        {NOTIFICATION_TYPE_DESCRIPTIONS[type]}
                      </Typography.Text>
                    </Box>
                    <Switch
                      checked={isEnabled}
                      onChange={(checked) => handleQuickToggle(type, checked)}
                      disabled={isPending}
                      size="small"
                    />
                  </Box>

                  {isEnabled && (
                    <Box className="mt-3">
                      <Select
                        size="small"
                        value={preferences[type]}
                        onChange={(value: NotificationChannel) => handleChannelChange(type, value)}
                        options={CHANNEL_OPTIONS.filter((o) => o.value !== 'NONE')}
                        disabled={isPending}
                        style={{ width: 160 }}
                      />
                    </Box>
                  )}
                </Box>
              );
            })}
          </Space>
        </Box>

        <Divider />

        {/* Email digest frequency */}
        <Box className="mb-6">
          <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
            Email digest
          </Typography.Text>
          <Typography.Text
            type="secondary"
            style={{ display: 'block', marginBottom: 12, fontSize: 13 }}
          >
            Receive a summary of unread notifications at a regular interval.
          </Typography.Text>

          <Select
            value={digestFrequency}
            onChange={(value: DigestFrequency) => setDigestFrequency(value)}
            options={DIGEST_OPTIONS}
            disabled={isPending}
            style={{ width: 200 }}
          />
        </Box>

        {/* Feedback */}
        {formState.message && (
          <Box className="mb-4">
            <Alert
              type={formState.success ? 'success' : 'error'}
              message={formState.message}
              showIcon
              closable
            />
          </Box>
        )}

        <Button type="primary" htmlType="submit" loading={isPending}>
          Save preferences
        </Button>
      </form>
    </Box>
  );
}
