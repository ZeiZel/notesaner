'use client';

/**
 * OverrideAuditDrawer
 *
 * Ant Design Drawer showing the audit log for a component override.
 */

import * as React from 'react';
import { Drawer, Timeline, Tag, Skeleton, Alert, Typography } from 'antd';
import type { OverrideAuditEntry } from '@notesaner/component-sdk';
import { componentOverridesApi } from '../api/component-overrides-api';

const { Text } = Typography;

const ACTION_COLOR: Record<string, string> = {
  created: 'blue',
  updated: 'default',
  activated: 'green',
  reverted: 'orange',
  deleted: 'red',
};

export interface OverrideAuditDrawerProps {
  open: boolean;
  onClose: () => void;
  accessToken: string;
  workspaceId: string;
  componentId: string;
}

export function OverrideAuditDrawer({
  open,
  onClose,
  accessToken,
  workspaceId,
  componentId,
}: OverrideAuditDrawerProps) {
  const [entries, setEntries] = React.useState<OverrideAuditEntry[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setEntries(null);
    setError(null);

    componentOverridesApi
      .getAuditLog(accessToken, workspaceId, componentId)
      .then(setEntries)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load audit log.');
      });
  }, [open, accessToken, workspaceId, componentId]);

  return (
    <Drawer
      title={`Audit log — ${componentId}`}
      placement="right"
      width={480}
      open={open}
      onClose={onClose}
    >
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

      {!error && entries === null && <Skeleton active paragraph={{ rows: 6 }} />}

      {entries !== null && entries.length === 0 && (
        <Text type="secondary">No audit entries yet.</Text>
      )}

      {entries !== null && entries.length > 0 && (
        <Timeline
          items={entries.map((e) => ({
            key: e.id,
            color: ACTION_COLOR[e.action] ?? 'blue',
            children: (
              <div>
                <Tag color={ACTION_COLOR[e.action] ?? 'blue'}>{e.action}</Tag>
                {e.previousStatus && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {e.previousStatus} → {e.newStatus}
                  </Text>
                )}
                <div
                  style={{ fontSize: 12, color: 'var(--ant-color-text-tertiary)', marginTop: 2 }}
                >
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            ),
          }))}
        />
      )}
    </Drawer>
  );
}
