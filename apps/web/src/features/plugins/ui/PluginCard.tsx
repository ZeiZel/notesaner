'use client';

/**
 * PluginCard
 *
 * Displays a registry plugin entry as a card. Migrated from shadcn/ui to Ant Design.
 */

import * as React from 'react';
import { Card, Button, Tag, Flex, Typography } from 'antd';
import { StarFilled } from '@ant-design/icons';
import type { RegistryPlugin } from '../api/plugin-registry-api';
import type { PluginBrowserOpState } from '../model/plugin-browser-store';

const { Text, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// App version for compatibility check
// ---------------------------------------------------------------------------
const APP_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a semver string into [major, minor, patch]. */
function parseSemVer(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isCompatible(minAppVersion: string, appVersion: string): boolean {
  const [minMaj, minMin, minPat] = parseSemVer(minAppVersion);
  const [appMaj, appMin, appPat] = parseSemVer(appVersion);
  if (appMaj !== minMaj) return appMaj > minMaj;
  if (appMin !== minMin) return appMin > minMin;
  return appPat >= minPat;
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginCardProps {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  operation: PluginBrowserOpState;
  onInstall: (plugin: RegistryPlugin) => void;
  onUninstall: (pluginId: string) => void;
  onOpenDetail: (plugin: RegistryPlugin) => void;
  onTagClick?: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginCard({
  plugin,
  isInstalled,
  operation,
  onInstall,
  onUninstall,
  onOpenDetail,
  onTagClick,
}: PluginCardProps) {
  const isPending = operation.status === 'loading';
  const compatible = plugin.latestVersion !== 'unknown';

  const handleInstallToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) return;
    if (isInstalled) {
      onUninstall(plugin.id);
    } else {
      onInstall(plugin);
    }
  };

  return (
    <Card
      hoverable
      size="small"
      onClick={() => onOpenDetail(plugin)}
      aria-label={`View details for ${plugin.name}`}
      styles={{ body: { display: 'flex', flexDirection: 'column', gap: 12, padding: 16 } }}
    >
      {/* Header */}
      <Flex justify="space-between" gap={12} align="start">
        <Flex
          align="center"
          justify="center"
          style={{
            width: 40,
            height: 40,
            flexShrink: 0,
            borderRadius: 8,
            background: 'var(--ant-color-primary-bg)',
            color: 'var(--ant-color-primary)',
            fontWeight: 700,
            fontSize: 14,
            userSelect: 'none',
          }}
          aria-hidden="true"
        >
          {plugin.name.slice(0, 2).toUpperCase()}
        </Flex>

        <Flex vertical gap={2} flex={1} style={{ minWidth: 0 }}>
          <Flex align="center" gap={8} wrap>
            <Text strong ellipsis style={{ fontSize: 14 }}>
              {plugin.name}
            </Text>
            {isInstalled && <Tag color="success">Installed</Tag>}
            {!compatible && <Tag color="warning">Incompatible</Tag>}
          </Flex>
          <Text type="secondary" ellipsis style={{ fontSize: 12 }}>
            by {plugin.author}
          </Text>
        </Flex>

        <Text
          type="secondary"
          style={{ fontSize: 12, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}
        >
          v{plugin.latestVersion}
        </Text>
      </Flex>

      {/* Description */}
      <Paragraph
        type="secondary"
        ellipsis={{ rows: 2 }}
        style={{ fontSize: 14, margin: 0, flex: 1 }}
      >
        {plugin.description || 'No description provided.'}
      </Paragraph>

      {/* Tags */}
      {plugin.tags.length > 0 && (
        <Flex wrap gap={6}>
          {plugin.tags.slice(0, 5).map((tag) => (
            <Tag
              key={tag}
              style={{ cursor: 'pointer', margin: 0 }}
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
            >
              {tag}
            </Tag>
          ))}
          {plugin.tags.length > 5 && <Tag>+{plugin.tags.length - 5}</Tag>}
        </Flex>
      )}

      {/* Footer */}
      <Flex align="center" justify="space-between" gap={8} style={{ paddingTop: 4 }}>
        <Flex align="center" gap={4}>
          <StarFilled style={{ fontSize: 14, color: '#faad14' }} />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {formatStars(plugin.stars)}
          </Text>
        </Flex>

        <Button
          size="small"
          type={isInstalled ? 'default' : 'primary'}
          loading={isPending}
          disabled={isPending || !compatible}
          onClick={handleInstallToggle}
          aria-label={isInstalled ? `Uninstall ${plugin.name}` : `Install ${plugin.name}`}
        >
          {isInstalled ? 'Uninstall' : 'Install'}
        </Button>
      </Flex>

      {/* Error message */}
      {operation.status === 'error' && operation.error && (
        <Text type="danger" style={{ fontSize: 12 }}>
          {operation.error}
        </Text>
      )}
    </Card>
  );
}

export { isCompatible, APP_VERSION };
