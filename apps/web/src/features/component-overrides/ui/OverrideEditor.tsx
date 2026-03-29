'use client';

/**
 * OverrideEditor
 *
 * Split-pane component override editor:
 *   Left pane  — Monaco editor (TSX, TypeScript IntelliSense)
 *   Right pane — Live sandbox preview (iframe) + diff view toggle
 *
 * Props must include an accessToken and workspaceId for API calls.
 */

import * as React from 'react';
import dynamic from 'next/dynamic';
import { Alert, Button, Flex, Space, Spin, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleOutlined,
  CloseOutlined,
  CodeOutlined,
  DiffOutlined,
  EyeOutlined,
  HistoryOutlined,
  LoadingOutlined,
  ReloadOutlined,
  SaveOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { OverridableComponentMeta } from '@notesaner/component-sdk';
import { buildTypeDefinitions } from '../lib/override-type-defs';
import { useOverridesStore, selectOverrideOp } from '../model/overrides-store';
import { OverrideSandboxPreview } from './OverrideSandboxPreview';
import { OverrideAuditDrawer } from './OverrideAuditDrawer';

// Dynamically import Monaco to avoid SSR issues.
const MonacoEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.default), {
  ssr: false,
  loading: () => (
    <Flex align="center" justify="center" style={{ height: '100%' }}>
      <Spin indicator={<LoadingOutlined />} />
    </Flex>
  ),
});

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  draft: 'default',
  active: 'success',
  error: 'error',
  reverted: 'warning',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OverrideEditorProps {
  meta: OverridableComponentMeta;
  accessToken: string;
  workspaceId: string;
  onClose: () => void;
}

type TabKey = 'preview' | 'diff';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OverrideEditor({ meta, accessToken, workspaceId, onClose }: OverrideEditorProps) {
  const store = useOverridesStore();
  const { overrides, draftSources, operations } = store;

  const componentId = meta.id;
  const override = overrides[componentId];
  const draft = draftSources[componentId] ?? meta.starterTemplate;
  const op = selectOverrideOp(operations, componentId);

  const [activeTab, setActiveTab] = React.useState<TabKey>('preview');
  const [auditOpen, setAuditOpen] = React.useState(false);

  // Monaco-mount callback: inject type definitions.
  const handleEditorMount = React.useCallback(
    (
      _editor: unknown,
      monaco: {
        languages: {
          typescript: {
            typescriptDefaults: {
              addExtraLib: (code: string, uri: string) => void;
              setCompilerOptions: (opts: Record<string, unknown>) => void;
            };
          };
        };
      },
    ) => {
      const typeDefs = buildTypeDefinitions(meta);
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        typeDefs,
        `file:///node_modules/@notesaner/component-sdk/types.d.ts`,
      );
      monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
        jsx: 4 /* React */,
        jsxFactory: 'React.createElement',
        jsxFragmentFactory: 'React.Fragment',
        target: 99 /* ESNext */,
        moduleResolution: 2 /* Node */,
        allowNonTsExtensions: true,
      });
    },
    [meta],
  );

  const handleSave = () => {
    void store.saveOverride(accessToken, workspaceId, componentId);
  };

  const handleCompile = () => {
    void store.compileOverride(accessToken, workspaceId, componentId);
  };

  const handleRevert = () => {
    void store.revertOverride(accessToken, workspaceId, componentId);
  };

  const isBusy = op.status === 'pending';

  return (
    <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Flex
        align="center"
        gap={12}
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid var(--ant-color-border)',
          flexShrink: 0,
        }}
      >
        <CodeOutlined style={{ fontSize: 18 }} />
        <Flex vertical gap={0} flex={1}>
          <Text strong style={{ fontSize: 15 }}>
            {meta.displayName}
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {meta.description}
          </Text>
        </Flex>

        {override && (
          <Tag color={STATUS_COLOR[override.status] ?? 'default'}>{override.status}</Tag>
        )}

        <Space>
          <Tooltip title="Audit log">
            <Button
              icon={<HistoryOutlined />}
              size="small"
              onClick={() => setAuditOpen(true)}
              disabled={!override}
            />
          </Tooltip>
          <Tooltip title="Revert to base">
            <Button
              icon={<ReloadOutlined />}
              size="small"
              danger
              onClick={handleRevert}
              disabled={!override || isBusy}
            >
              Revert
            </Button>
          </Tooltip>
          <Button
            icon={<SaveOutlined />}
            size="small"
            onClick={handleSave}
            loading={isBusy && op.status === 'pending'}
            disabled={isBusy}
          >
            Save
          </Button>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            size="small"
            onClick={handleCompile}
            loading={isBusy}
            disabled={isBusy || !override}
          >
            Compile & Activate
          </Button>
          <Button icon={<CloseOutlined />} size="small" onClick={onClose} />
        </Space>
      </Flex>

      {/* ── Compile error banner ────────────────────────────────────────── */}
      {override?.status === 'error' && override.compileError && (
        <Alert
          type="error"
          icon={<WarningOutlined />}
          showIcon
          message="Compilation failed"
          description={
            <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {override.compileError}
            </pre>
          }
          style={{ borderRadius: 0, flexShrink: 0 }}
        />
      )}

      {/* ── Op error ───────────────────────────────────────────────────── */}
      {op.status === 'error' && op.error && (
        <Alert
          type="error"
          message={op.error}
          showIcon
          closable
          style={{ borderRadius: 0, flexShrink: 0 }}
        />
      )}

      {/* ── Split panes ────────────────────────────────────────────────── */}
      <Flex flex={1} style={{ overflow: 'hidden', minHeight: 0 }}>
        {/* Editor pane */}
        <div
          style={{
            flex: '0 0 55%',
            borderRight: '1px solid var(--ant-color-border)',
            overflow: 'hidden',
          }}
        >
          <MonacoEditor
            height="100%"
            language="typescript"
            path={`override-${componentId}.tsx`}
            value={draft}
            onChange={(value) => store.setDraftSource(componentId, value ?? '')}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              formatOnPaste: true,
            }}
            theme="vs-dark"
          />
        </div>

        {/* Preview / diff pane */}
        <Flex vertical flex={1} style={{ overflow: 'hidden', minWidth: 0 }}>
          {/* Tab bar */}
          <Flex
            gap={0}
            style={{
              borderBottom: '1px solid var(--ant-color-border)',
              flexShrink: 0,
              padding: '0 12px',
            }}
          >
            <Button
              type={activeTab === 'preview' ? 'link' : 'text'}
              icon={<EyeOutlined />}
              size="small"
              onClick={() => setActiveTab('preview')}
              style={{ borderRadius: 0 }}
            >
              Preview
            </Button>
            <Button
              type={activeTab === 'diff' ? 'link' : 'text'}
              icon={<DiffOutlined />}
              size="small"
              onClick={() => setActiveTab('diff')}
              style={{ borderRadius: 0 }}
            >
              Diff
            </Button>
          </Flex>

          <div style={{ flex: 1, overflow: 'hidden' }}>
            {activeTab === 'preview' && (
              <OverrideSandboxPreview override={override ?? null} componentId={componentId} />
            )}
            {activeTab === 'diff' && <DiffPane base={meta.starterTemplate} current={draft} />}
          </div>
        </Flex>
      </Flex>

      {/* ── Audit drawer ──────────────────────────────────────────────── */}
      <OverrideAuditDrawer
        open={auditOpen}
        onClose={() => setAuditOpen(false)}
        accessToken={accessToken}
        workspaceId={workspaceId}
        componentId={componentId}
      />
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// Diff pane (Monaco diff editor)
// ---------------------------------------------------------------------------

const MonacoDiffEditor = dynamic(() => import('@monaco-editor/react').then((m) => m.DiffEditor), {
  ssr: false,
});

function DiffPane({ base, current }: { base: string; current: string }) {
  return (
    <MonacoDiffEditor
      height="100%"
      language="typescript"
      original={base}
      modified={current}
      options={{
        minimap: { enabled: false },
        fontSize: 12,
        readOnly: true,
        renderSideBySide: true,
        scrollBeyondLastLine: false,
        automaticLayout: true,
      }}
      theme="vs-dark"
    />
  );
}
