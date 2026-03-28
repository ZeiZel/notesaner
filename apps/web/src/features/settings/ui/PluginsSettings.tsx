'use client';

/**
 * PluginsSettings -- workspace plugin management tab.
 *
 * Reuses the existing installed plugin store and renders:
 *   - Installed plugins with enable/disable toggles
 *   - Per-plugin settings link
 *   - Install from URL form
 *   - Browse plugin registry link
 *
 * No useEffect for state management -- reads directly from the
 * installed plugin store.
 *
 * Styled with Ant Design Switch, Button, Input, Typography, Card, Empty.
 */

import { useActionState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Switch, Button, Input, Typography, Card, Empty, Space, Avatar } from 'antd';
import { Box } from '@/shared/ui';
import {
  useInstalledPluginStore,
  selectInstalledPlugins,
  selectPluginOperation,
  type InstalledPluginMeta,
} from '@/features/plugins/model/plugin-store';

// ---------------------------------------------------------------------------
// Install action
// ---------------------------------------------------------------------------

interface InstallState {
  success: boolean;
  message: string;
}

async function installFromUrlAction(
  _prev: InstallState,
  formData: FormData,
): Promise<InstallState> {
  const url = (formData.get('releaseUrl') as string | null)?.trim() ?? '';
  if (!url) return { success: false, message: 'Please enter a GitHub release URL.' };
  if (!url.startsWith('https://github.com')) {
    return { success: false, message: 'Only GitHub release URLs are supported.' };
  }

  return {
    success: false,
    message:
      'Plugin installation from settings is not yet connected to the runtime loader. Use the plugin browser for now.',
  };
}

// ---------------------------------------------------------------------------
// PluginRow
// ---------------------------------------------------------------------------

interface PluginRowProps {
  meta: InstalledPluginMeta;
  isEnabled: boolean;
  isPending: boolean;
  error?: string;
  onToggle: () => void;
}

function PluginRow({ meta, isEnabled, isPending, error, onToggle }: PluginRowProps) {
  const { manifest } = meta;

  return (
    <Box
      className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      <Avatar shape="square" size={40} style={{ flexShrink: 0 }}>
        {manifest.name[0]?.toUpperCase() ?? 'P'}
      </Avatar>

      <Box className="flex-1 min-w-0">
        <Space size={8} align="center">
          <Typography.Text strong style={{ fontSize: 14 }}>
            {manifest.name}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            v{manifest.version}
          </Typography.Text>
        </Space>
        <Typography.Paragraph
          type="secondary"
          ellipsis
          style={{ fontSize: 12, marginBottom: 0, marginTop: 2 }}
        >
          {manifest.description ?? 'No description.'}
        </Typography.Paragraph>
        {error && (
          <Typography.Text type="danger" style={{ fontSize: 12 }}>
            {error}
          </Typography.Text>
        )}
      </Box>

      <Button size="small" title={`Settings for ${manifest.name}`}>
        Settings
      </Button>

      <Switch
        checked={isEnabled}
        loading={isPending}
        onChange={onToggle}
        aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${manifest.name}`}
      />
    </Box>
  );
}

// ---------------------------------------------------------------------------
// PluginsSettings
// ---------------------------------------------------------------------------

export function PluginsSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';

  const installed = useInstalledPluginStore((s) => s.installed);
  const operations = useInstalledPluginStore((s) => s.operations);
  const enablePlugin = useInstalledPluginStore((s) => s.enablePlugin);
  const disablePlugin = useInstalledPluginStore((s) => s.disablePlugin);
  const isPluginEnabled = useInstalledPluginStore((s) => s.isPluginEnabled);

  const plugins = selectInstalledPlugins(installed);

  const [installState, installAction, isInstalling] = useActionState<InstallState, FormData>(
    installFromUrlAction,
    { success: false, message: '' },
  );

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Page header */}
      <Box>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          Plugins
        </Typography.Title>
        <Typography.Text type="secondary">
          Manage installed plugins and their settings for this workspace.
        </Typography.Text>
      </Box>

      {/* Installed plugins */}
      <Box as="section">
        <Box className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <Typography.Text strong style={{ fontSize: 14 }}>
            Installed plugins
            {plugins.length > 0 && (
              <Typography.Text
                type="secondary"
                style={{ marginLeft: 8, fontWeight: 'normal', fontSize: 12 }}
              >
                ({plugins.length})
              </Typography.Text>
            )}
          </Typography.Text>
          <Link href={`/workspaces/${workspaceId}/plugins`} style={{ fontSize: 12 }}>
            Browse registry
          </Link>
        </Box>

        {plugins.length === 0 ? (
          <Card>
            <Empty description="No plugins installed yet.">
              <Link href={`/workspaces/${workspaceId}/plugins`}>
                <Button type="link">Browse the plugin registry</Button>
              </Link>
            </Empty>
          </Card>
        ) : (
          <Card size="small" styles={{ body: { padding: '0 16px' } }}>
            {plugins.map((meta) => {
              const op = selectPluginOperation(operations, meta.pluginId);
              return (
                <PluginRow
                  key={meta.pluginId}
                  meta={meta}
                  isEnabled={workspaceId ? isPluginEnabled(meta.pluginId, workspaceId) : false}
                  isPending={op.status === 'pending'}
                  error={op.status === 'error' ? op.error : undefined}
                  onToggle={() => {
                    if (!workspaceId) return;
                    if (isPluginEnabled(meta.pluginId, workspaceId)) {
                      disablePlugin(meta.pluginId, workspaceId);
                    } else {
                      enablePlugin(meta.pluginId, workspaceId);
                    }
                  }}
                />
              );
            })}
          </Card>
        )}
      </Box>

      {/* Install from URL */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Install from URL
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginBottom: 12, fontSize: 12 }}
        >
          Paste a GitHub release URL to install a plugin manually.
        </Typography.Text>
        <form action={installAction}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              name="releaseUrl"
              type="url"
              placeholder="https://github.com/user/repo/releases/tag/v1.0.0"
              disabled={isInstalling}
              style={{ flex: 1 }}
            />
            <Button type="primary" htmlType="submit" loading={isInstalling}>
              Install
            </Button>
          </Space.Compact>
          {installState.message && (
            <Typography.Text
              type={installState.success ? 'success' : 'secondary'}
              style={{ fontSize: 12, display: 'block', marginTop: 8 }}
            >
              {installState.message}
            </Typography.Text>
          )}
        </form>
      </Box>
    </Box>
  );
}
