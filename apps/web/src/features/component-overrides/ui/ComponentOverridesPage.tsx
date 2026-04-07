'use client';

/**
 * ComponentOverridesPage
 *
 * Settings page (admin only) listing all overridable components
 * and their current override status, with an "Edit" button that opens
 * the OverrideEditor in a full-screen drawer.
 */

import * as React from 'react';
import { Alert, Badge, Button, Drawer, Flex, Skeleton, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { OverridableComponentMeta } from '@notesaner/component-sdk';
import { useOverridesStore, selectOverrideOp } from '../model/overrides-store';
import { OverrideEditor } from './OverrideEditor';

const { Title, Text } = Typography;

export interface ComponentOverridesPageProps {
  accessToken: string;
  workspaceId: string;
}

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  active: 'success',
  error: 'error',
  reverted: 'warning',
};

export function ComponentOverridesPage({ accessToken, workspaceId }: ComponentOverridesPageProps) {
  const store = useOverridesStore();
  const { registry, overrides, operations } = store;

  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editingMeta, setEditingMeta] = React.useState<OverridableComponentMeta | null>(null);

  // Load registry + existing overrides once on mount.
  React.useEffect(() => {
    Promise.all([
      store.loadRegistry(accessToken, workspaceId),
      store.loadOverrides(accessToken, workspaceId),
    ])
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Failed to load component overrides.');
      })
      .finally(() => setLoading(false));
  }, [accessToken, workspaceId]);

  const handleEdit = (meta: OverridableComponentMeta) => {
    store.openEditor(meta.id);
    setEditingMeta(meta);
    setEditorOpen(true);
  };

  const handleEditorClose = () => {
    setEditorOpen(false);
    store.closeEditor();
    setEditingMeta(null);
  };

  const columns: ColumnsType<OverridableComponentMeta> = [
    {
      title: 'Component',
      dataIndex: 'displayName',
      key: 'displayName',
      render: (name: string, meta) => (
        <Flex vertical gap={2}>
          <Text strong>{name}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {meta.description}
          </Text>
        </Flex>
      ),
    },
    {
      title: 'Base version',
      dataIndex: 'baseVersion',
      key: 'baseVersion',
      width: 120,
      render: (v: string) => <Tag>{v}</Tag>,
    },
    {
      title: 'Override status',
      key: 'status',
      width: 140,
      render: (_, meta) => {
        const override = overrides[meta.id];
        if (!override)
          return (
            <Text type="secondary" style={{ fontSize: 12 }}>
              No override
            </Text>
          );
        return <Tag color={STATUS_COLOR[override.status] ?? 'default'}>{override.status}</Tag>;
      },
    },
    {
      title: 'Active',
      key: 'active',
      width: 80,
      render: (_, meta) => {
        const override = overrides[meta.id];
        return (
          <Badge
            status={override?.status === 'active' ? 'success' : 'default'}
            text={override?.status === 'active' ? 'Yes' : 'No'}
          />
        );
      },
    },
    {
      title: '',
      key: 'actions',
      width: 120,
      render: (_, meta) => {
        const override = overrides[meta.id];
        const op = selectOverrideOp(operations, meta.id);
        return (
          <Button
            size="small"
            icon={override ? <EditOutlined /> : <PlusOutlined />}
            loading={op.status === 'pending'}
            onClick={() => handleEdit(meta)}
          >
            {override ? 'Edit' : 'Create'}
          </Button>
        );
      },
    },
  ];

  if (loading) {
    return (
      <Flex vertical gap={16} style={{ padding: 24 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Flex>
    );
  }

  if (loadError) {
    return (
      <Alert
        type="error"
        message="Failed to load component overrides"
        description={loadError}
        showIcon
        style={{ margin: 24 }}
      />
    );
  }

  return (
    <Flex vertical gap={16} style={{ padding: 24 }}>
      <Flex vertical gap={4}>
        <Title level={4} style={{ margin: 0 }}>
          Component Overrides
        </Title>
        <Text type="secondary">
          Override individual UI components for this workspace. Requires admin role. Overrides
          compile to JS and run in a sandboxed iframe.
        </Text>
      </Flex>

      <Table<OverridableComponentMeta>
        rowKey="id"
        dataSource={registry}
        columns={columns}
        pagination={false}
        size="middle"
      />

      {/* Full-screen editor drawer */}
      <Drawer
        open={editorOpen}
        onClose={handleEditorClose}
        placement="right"
        width="90vw"
        styles={{ body: { padding: 0, overflow: 'hidden', height: '100%' } }}
        title={null}
        closable={false}
        destroyOnHidden
      >
        {editingMeta && (
          <OverrideEditor
            meta={editingMeta}
            accessToken={accessToken}
            workspaceId={workspaceId}
            onClose={handleEditorClose}
          />
        )}
      </Drawer>
    </Flex>
  );
}
