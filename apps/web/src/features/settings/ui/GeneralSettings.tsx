'use client';

/**
 * GeneralSettings -- workspace name, description, slug, and icon.
 *
 * Uses React 19 useActionState for form submission -- no useEffect for
 * form state synchronization. The form reads initial values from the
 * workspace settings store and submits via the API client.
 *
 * Styled with Ant Design Form, Input, Button, Typography, Avatar.
 */

import { useActionState, useState } from 'react';
import { useParams } from 'next/navigation';
import { Input, Button, Typography, Space, Avatar } from 'antd';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
import { workspaceSettingsApi } from '@/shared/api/workspace-settings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneralFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'name' | 'slug' | 'description', string>>;
}

// ---------------------------------------------------------------------------
// Save action
// ---------------------------------------------------------------------------

async function saveGeneralAction(
  _prev: GeneralFormState,
  formData: FormData,
): Promise<GeneralFormState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const workspaceId = formData.get('workspaceId') as string;
  const token = formData.get('token') as string;

  const errors: GeneralFormState['errors'] = {};

  if (!name) errors.name = 'Workspace name is required.';
  if (name.length > 64) errors.name = 'Name must be 64 characters or fewer.';

  if (!slug) {
    errors.slug = 'Slug is required.';
  } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    errors.slug =
      'Slug may only contain lowercase letters, numbers, and hyphens. Must start and end with a letter or number.';
  } else if (slug.length < 2) {
    errors.slug = 'Slug must be at least 2 characters.';
  } else if (slug.length > 48) {
    errors.slug = 'Slug must be 48 characters or fewer.';
  }

  if (description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  try {
    await workspaceSettingsApi.updateGeneral(token, workspaceId, {
      name,
      slug,
      description: description || null,
    });
    return { success: true, message: 'Settings saved.', errors: {} };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save settings.';
    return { success: false, message, errors: {} };
  }
}

// ---------------------------------------------------------------------------
// GeneralSettings
// ---------------------------------------------------------------------------

export function GeneralSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);
  const settings = useWorkspaceSettingsStore((s) => s.settings);

  const [_iconPreview] = useState<string | null>(settings?.iconUrl ?? null);

  const [state, formAction, isPending] = useActionState<GeneralFormState, FormData>(
    saveGeneralAction,
    { success: false, message: '', errors: {} },
  );

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Page header */}
      <Box>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          General
        </Typography.Title>
        <Typography.Text type="secondary">
          Workspace name, description, and URL slug.
        </Typography.Text>
      </Box>

      <form action={formAction} style={{ maxWidth: 480 }}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          {/* Hidden fields for the action */}
          <input type="hidden" name="workspaceId" value={workspaceId} />
          <input type="hidden" name="token" value={accessToken ?? ''} />

          {/* Icon */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 8, fontSize: 14 }}>
              Workspace icon
            </Typography.Text>
            <Space size="middle" align="center">
              <Avatar
                size={64}
                shape="square"
                src={_iconPreview ?? undefined}
                style={{ fontSize: 24, fontWeight: 700 }}
              >
                {!_iconPreview && (settings?.name?.[0]?.toUpperCase() ?? 'W')}
              </Avatar>
              <Box>
                <Button size="small">Change icon</Button>
                <Typography.Text
                  type="secondary"
                  style={{ display: 'block', marginTop: 4, fontSize: 12 }}
                >
                  Recommended: 256x256px, PNG or SVG
                </Typography.Text>
              </Box>
            </Space>
          </Box>

          {/* Name */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              Workspace name
            </Typography.Text>
            <Input
              name="name"
              defaultValue={settings?.name ?? ''}
              placeholder="My Workspace"
              disabled={isPending}
              maxLength={64}
              status={state.errors.name ? 'error' : undefined}
            />
            {state.errors.name && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {state.errors.name}
              </Typography.Text>
            )}
          </Box>

          {/* Slug */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              URL slug
            </Typography.Text>
            <Input
              name="slug"
              defaultValue={settings?.slug ?? ''}
              placeholder="my-workspace"
              disabled={isPending}
              maxLength={48}
              addonBefore="/workspaces/"
              status={state.errors.slug ? 'error' : undefined}
              style={{ fontFamily: 'monospace' }}
            />
            {state.errors.slug && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {state.errors.slug}
              </Typography.Text>
            )}
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            >
              Only lowercase letters, numbers, and hyphens. Changing the slug may break existing
              links.
            </Typography.Text>
          </Box>

          {/* Description */}
          <Box>
            <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
              Description
            </Typography.Text>
            <Input.TextArea
              name="description"
              rows={3}
              defaultValue={settings?.description ?? ''}
              placeholder="A short description of this workspace..."
              disabled={isPending}
              maxLength={500}
              status={state.errors.description ? 'error' : undefined}
            />
            {state.errors.description && (
              <Typography.Text type="danger" style={{ fontSize: 12 }}>
                {state.errors.description}
              </Typography.Text>
            )}
            <Typography.Text
              type="secondary"
              style={{ fontSize: 12, display: 'block', marginTop: 4 }}
            >
              Visible to all workspace members. Max 500 characters.
            </Typography.Text>
          </Box>

          {/* Status message */}
          {state.message && (
            <Typography.Text type={state.success ? 'success' : 'danger'}>
              {state.message}
            </Typography.Text>
          )}

          {/* Submit */}
          <Button type="primary" htmlType="submit" loading={isPending}>
            Save changes
          </Button>
        </Space>
      </form>
    </Box>
  );
}
