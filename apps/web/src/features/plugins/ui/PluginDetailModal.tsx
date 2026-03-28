'use client';

/**
 * PluginDetailModal
 *
 * Full detail view for a single registry plugin. Migrated from shadcn/ui Dialog to Ant Design Modal.
 */

import * as React from 'react';
import { Modal, Button, Tag, Skeleton, Alert, Flex, Typography, Descriptions } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { RegistryPlugin } from '../api/plugin-registry-api';
import type { PluginBrowserOpState } from '../model/plugin-browser-store';
import { APP_VERSION, isCompatible } from './PluginCard';

const { Text, Paragraph, Title, Link } = Typography;

// ---------------------------------------------------------------------------
// Screenshots carousel
// ---------------------------------------------------------------------------

function ScreenshotsCarousel({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = React.useState(0);

  if (screenshots.length === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + screenshots.length) % screenshots.length);
  const next = () => setCurrent((c) => (c + 1) % screenshots.length);

  return (
    <section
      aria-label="Plugin screenshots"
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 8,
        border: '1px solid var(--ant-color-border)',
      }}
    >
      <img
        src={screenshots[current]}
        alt={`Screenshot ${current + 1} of ${screenshots.length}`}
        style={{ width: '100%', objectFit: 'cover', maxHeight: 288 }}
        loading="lazy"
      />

      {screenshots.length > 1 && (
        <>
          <Button
            type="text"
            shape="circle"
            icon={<LeftOutlined />}
            onClick={prev}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
            }}
            aria-label="Previous screenshot"
          />
          <Button
            type="text"
            shape="circle"
            icon={<RightOutlined />}
            onClick={next}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'rgba(0,0,0,0.5)',
              color: '#fff',
            }}
            aria-label="Next screenshot"
          />
          <Flex
            gap={6}
            justify="center"
            style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)' }}
          >
            {screenshots.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrent(i)}
                aria-label={`Screenshot ${i + 1}`}
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  borderRadius: 3,
                  background: i === current ? '#fff' : 'rgba(255,255,255,0.5)',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  padding: 0,
                }}
              />
            ))}
          </Flex>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Changelog section
// ---------------------------------------------------------------------------

function ChangelogSection({ changelog }: { changelog: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const lines = changelog.trim().split('\n');
  const preview = lines.slice(0, 10).join('\n');
  const hasMore = lines.length > 10;

  return (
    <section>
      <Title level={5} style={{ marginBottom: 8 }}>
        Changelog
      </Title>
      <pre
        style={{
          whiteSpace: 'pre-wrap',
          fontSize: 12,
          fontFamily: 'monospace',
          background: 'var(--ant-color-fill-tertiary)',
          borderRadius: 8,
          padding: 12,
          overflow: 'auto',
          maxHeight: expanded ? undefined : 160,
        }}
      >
        {expanded ? changelog : preview}
        {!expanded && hasMore && '...'}
      </pre>
      {hasMore && (
        <Button
          type="link"
          size="small"
          onClick={() => setExpanded((v) => !v)}
          style={{ paddingLeft: 0 }}
        >
          {expanded ? 'Show less' : 'Show full changelog'}
        </Button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginDetailModalProps {
  plugin: RegistryPlugin | null;
  open: boolean;
  detailStatus: 'idle' | 'loading' | 'success' | 'error';
  detailError: string | null;
  isInstalled: boolean;
  operation: PluginBrowserOpState;
  onClose: () => void;
  onInstall: (plugin: RegistryPlugin) => void;
  onUninstall: (pluginId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginDetailModal({
  plugin,
  open,
  detailStatus,
  detailError,
  isInstalled,
  operation,
  onClose,
  onInstall,
  onUninstall,
}: PluginDetailModalProps) {
  const isPending = operation.status === 'loading';
  const compatible = plugin ? isCompatible(plugin.latestVersion, APP_VERSION) : false;

  const handleInstallToggle = () => {
    if (!plugin || isPending) return;
    if (isInstalled) {
      onUninstall(plugin.id);
    } else {
      onInstall(plugin);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={672}
      footer={null}
      styles={{ body: { maxHeight: '75vh', overflowY: 'auto' } }}
    >
      {plugin && (
        <Flex vertical gap={16}>
          {/* Header */}
          <Flex gap={16} align="start">
            <Flex
              align="center"
              justify="center"
              style={{
                width: 48,
                height: 48,
                flexShrink: 0,
                borderRadius: 12,
                background: 'var(--ant-color-primary-bg)',
                color: 'var(--ant-color-primary)',
                fontWeight: 700,
                fontSize: 16,
                userSelect: 'none',
              }}
              aria-hidden="true"
            >
              {plugin.name.slice(0, 2).toUpperCase()}
            </Flex>

            <Flex vertical flex={1} style={{ minWidth: 0 }}>
              <Flex align="center" gap={8} wrap>
                <Title level={5} style={{ margin: 0 }}>
                  {plugin.name}
                </Title>
                {isInstalled && <Tag color="success">Installed</Tag>}
                {!compatible && <Tag color="warning">Incompatible</Tag>}
              </Flex>
              <Text type="secondary">
                by {plugin.author} · v{plugin.latestVersion}
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

          {/* Operation error */}
          {operation.status === 'error' && operation.error && (
            <Alert type="error" message={operation.error} showIcon />
          )}

          {/* Metadata */}
          <Descriptions size="small" column={3} colon={false}>
            <Descriptions.Item label="Repository">
              <Link href={plugin.repository} target="_blank" onClick={(e) => e.stopPropagation()}>
                {plugin.repository.replace('https://github.com/', '')}
              </Link>
            </Descriptions.Item>
            <Descriptions.Item label="Updated">
              {new Date(plugin.updatedAt).toLocaleDateString()}
            </Descriptions.Item>
            <Descriptions.Item label="Stars">{plugin.stars.toLocaleString()}</Descriptions.Item>
          </Descriptions>

          {/* Tags */}
          {plugin.tags.length > 0 && (
            <Flex wrap gap={6}>
              {plugin.tags.map((tag) => (
                <Tag key={tag}>{tag}</Tag>
              ))}
            </Flex>
          )}

          {/* Content area */}
          {detailStatus === 'loading' && <Skeleton active paragraph={{ rows: 6 }} />}

          {detailStatus === 'error' && detailError && (
            <Alert type="error" message={`Failed to load full details: ${detailError}`} />
          )}

          {(detailStatus === 'success' || detailStatus === 'idle') && (
            <Flex vertical gap={20}>
              {plugin.screenshots && plugin.screenshots.length > 0 && (
                <ScreenshotsCarousel screenshots={plugin.screenshots} />
              )}

              {plugin.readme ? (
                <section>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    Description
                  </Title>
                  <pre
                    style={{
                      whiteSpace: 'pre-wrap',
                      fontFamily: 'inherit',
                      fontSize: 14,
                      lineHeight: 1.6,
                      margin: 0,
                    }}
                  >
                    {plugin.readme}
                  </pre>
                </section>
              ) : (
                <section>
                  <Title level={5} style={{ marginBottom: 8 }}>
                    Description
                  </Title>
                  <Paragraph type="secondary">
                    {plugin.description || 'No description provided.'}
                  </Paragraph>
                </section>
              )}

              {plugin.changelog && <ChangelogSection changelog={plugin.changelog} />}

              <section>
                <Title level={5} style={{ marginBottom: 8 }}>
                  Version Info
                </Title>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Latest version">
                    {plugin.latestVersion}
                  </Descriptions.Item>
                  <Descriptions.Item label="Compatibility">
                    {compatible ? (
                      <Text type="success" strong>
                        Compatible with your version
                      </Text>
                    ) : (
                      <Text type="warning" strong>
                        Requires a newer app version
                      </Text>
                    )}
                  </Descriptions.Item>
                </Descriptions>
              </section>
            </Flex>
          )}
        </Flex>
      )}
    </Modal>
  );
}
