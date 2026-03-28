'use client';

/**
 * WorkspaceSettings -- workspace name, slug, and auth provider configuration.
 *
 * Admin-only section. Reads the current workspace from URL params.
 * Uses React 19 useActionState for form -- no useEffect.
 * Styled with Ant Design Form, Input, Button, Typography, Card, Divider.
 */

import { useActionState } from 'react';
import { Button, Input, Typography, Card, Divider, Space } from 'antd';
import { Box } from '@/shared/ui';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'name' | 'slug', string>>;
}

// ---------------------------------------------------------------------------
// Save action
// ---------------------------------------------------------------------------

async function saveWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';

  const errors: WorkspaceFormState['errors'] = {};

  if (!name) errors.name = 'Workspace name is required.';
  if (!slug) {
    errors.slug = 'Slug is required.';
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug may only contain lowercase letters, numbers and hyphens.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  await new Promise((r) => setTimeout(r, 400));
  return { success: true, message: 'Workspace settings saved.', errors: {} };
}

// ---------------------------------------------------------------------------
// WorkspaceSettings
// ---------------------------------------------------------------------------

export function WorkspaceSettings() {
  const [state, formAction, isPending] = useActionState<WorkspaceFormState, FormData>(
    saveWorkspaceAction,
    { success: false, message: '', errors: {} },
  );

  return (
    <Box className="max-w-lg" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* General */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 16, fontSize: 14 }}>
          General
        </Typography.Text>
        <form action={formAction}>
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {/* Name */}
            <Box>
              <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
                Workspace name
              </Typography.Text>
              <Input
                name="name"
                placeholder="My Workspace"
                disabled={isPending}
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
                Slug
              </Typography.Text>
              <Input
                name="slug"
                placeholder="my-workspace"
                disabled={isPending}
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
                Only lowercase letters, numbers, and hyphens. Cannot be changed after creation.
              </Typography.Text>
            </Box>

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

      <Divider />

      {/* Auth providers */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Authentication providers
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginBottom: 12, fontSize: 12 }}
        >
          Configure SAML or OIDC providers for this workspace. Changes require a server restart.
        </Typography.Text>
        <Card size="small">
          {[
            { id: 'saml', label: 'SAML 2.0', description: 'Keycloak, Authentik, Okta' },
            { id: 'oidc', label: 'OIDC', description: 'Google, GitHub, custom IdP' },
          ].map((provider) => (
            <Box
              key={provider.id}
              className="flex items-center justify-between py-2.5 border-b last:border-0"
              style={{ borderColor: 'var(--ns-color-border)' }}
            >
              <Box>
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {provider.label}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                  {provider.description}
                </Typography.Text>
              </Box>
              <Button size="small">Configure</Button>
            </Box>
          ))}
        </Card>
      </Box>

      <Divider />

      {/* Danger zone */}
      <Box as="section">
        <Typography.Text
          type="danger"
          strong
          style={{ display: 'block', marginBottom: 12, fontSize: 14 }}
        >
          Danger zone
        </Typography.Text>
        <Card size="small" style={{ borderColor: 'var(--ns-color-destructive)' }}>
          <Box className="flex items-center justify-between">
            <Box>
              <Typography.Text strong style={{ fontSize: 14 }}>
                Delete workspace
              </Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                Permanently delete this workspace and all its notes.
              </Typography.Text>
            </Box>
            <Button danger type="primary">
              Delete workspace
            </Button>
          </Box>
        </Card>
      </Box>
    </Box>
  );
}
