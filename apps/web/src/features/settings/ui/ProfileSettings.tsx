'use client';

/**
 * ProfileSettings -- user profile editing form.
 *
 * Fields: display name, email, avatar upload (file -> base64 preview).
 * Uses React 19 useActionState for form submission -- no useEffect.
 * Styled with Ant Design Form, Input, Button, Avatar, Upload.
 */

import { useActionState, useRef, useState } from 'react';
import { Input, Button, Avatar, Typography, Space } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import { Box } from '@/shared/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'displayName' | 'email', string>>;
}

// ---------------------------------------------------------------------------
// Fake server action (replace with real API call when auth store is available)
// ---------------------------------------------------------------------------

async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const displayName = (formData.get('displayName') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim() ?? '';

  const errors: ProfileFormState['errors'] = {};

  if (!displayName) errors.displayName = 'Display name is required.';
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  // TODO: call apiClient.patch('/api/users/me', { displayName, email }, { token })
  await new Promise((r) => setTimeout(r, 400)); // simulate network
  return { success: true, message: 'Profile updated successfully.', errors: {} };
}

// ---------------------------------------------------------------------------
// ProfileSettings
// ---------------------------------------------------------------------------

export function ProfileSettings() {
  // In a real app these would come from an auth store / server component
  const [displayName, setDisplayName] = useState('');
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    { success: false, message: '', errors: {} },
  );

  const initials = displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') setAvatarSrc(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <Box className="max-w-lg">
      {/* Avatar section */}
      <Space align="center" size="middle" style={{ marginBottom: 24 }}>
        <Avatar
          size={64}
          src={avatarSrc}
          icon={!avatarSrc && !initials ? <UserOutlined /> : undefined}
          style={{ cursor: 'pointer' }}
          onClick={() => inputRef.current?.click()}
        >
          {!avatarSrc && initials ? initials : undefined}
        </Avatar>
        <Box>
          <Button
            type="link"
            size="small"
            icon={<UploadOutlined />}
            onClick={() => inputRef.current?.click()}
            style={{ paddingLeft: 0 }}
          >
            Upload photo
          </Button>
          <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
            JPG, PNG or GIF. Max 2 MB.
          </Typography.Text>
        </Box>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleFileChange}
        />
      </Space>

      {/* Profile form */}
      <form action={formAction}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          {/* Display name */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              Display name
            </Typography.Text>
            <Input
              name="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              disabled={isPending}
              autoComplete="name"
              status={state.errors.displayName ? 'error' : undefined}
            />
            {state.errors.displayName && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {state.errors.displayName}
              </Typography.Text>
            )}
          </Box>

          {/* Email */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              Email address
            </Typography.Text>
            <Input
              name="email"
              type="email"
              placeholder="you@example.com"
              disabled={isPending}
              autoComplete="email"
              status={state.errors.email ? 'error' : undefined}
            />
            {state.errors.email && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {state.errors.email}
              </Typography.Text>
            )}
          </Box>

          {/* Feedback */}
          {state.message && (
            <Typography.Text type={state.success ? 'success' : 'danger'}>
              {state.message}
            </Typography.Text>
          )}

          <Button type="primary" htmlType="submit" loading={isPending}>
            Save changes
          </Button>
        </Space>
      </form>
    </Box>
  );
}
