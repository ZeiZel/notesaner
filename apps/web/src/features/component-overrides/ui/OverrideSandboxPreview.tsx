'use client';

/**
 * OverrideSandboxPreview
 *
 * Renders the compiled override inside a sandboxed iframe.
 * Falls back to a placeholder when no compiled code is available.
 *
 * Security:
 *   - sandbox="allow-scripts" only — no allow-same-origin
 *   - CSP set via HTTP header on /sandbox/component-override.html
 *   - No localStorage, cookies, or network access from within the iframe
 */

import * as React from 'react';
import { Alert, Flex, Typography } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useOverrideSandbox } from '@notesaner/component-sdk';
import type { ComponentOverride } from '@notesaner/component-sdk';

const { Text } = Typography;

export interface OverrideSandboxPreviewProps {
  override: ComponentOverride | null;
  componentId: string;
}

const SANDBOX_URL = '/sandbox/component-override.html';

/** Example props injected into the sandbox for preview. */
const DEMO_PROPS: Record<string, unknown> = {
  NoteCard: {
    noteId: 'demo-1',
    title: 'My First Note',
    excerpt: 'This is a short excerpt of the note content...',
    updatedAt: new Date().toISOString(),
    tags: ['demo', 'preview'],
    onClick: () => undefined,
  },
  FileTreeItem: {
    name: 'notes.md',
    isFolder: false,
    isActive: true,
    depth: 1,
    onClick: () => undefined,
  },
  StatusBarItem: { label: 'Line 42, Col 8', onClick: () => undefined },
  SidebarPanel: { title: 'Files', isCollapsed: false, children: 'Sidebar content' },
  ToolbarButton: {
    label: 'Bold',
    isActive: false,
    onClick: () => undefined,
    tooltip: 'Bold (Ctrl+B)',
  },
  CalloutBlock: { type: 'info', title: 'Info', children: 'This is a callout.' },
  CodeBlock: {
    code: 'const x = 42;',
    language: 'typescript',
    filename: 'example.ts',
    showLineNumbers: true,
  },
  SearchResultItem: {
    noteId: 'demo-2',
    title: 'Search Result',
    excerpt: 'Some <mark>matching</mark> text',
    path: 'docs/search-result.md',
    isSelected: false,
    onClick: () => undefined,
  },
};

export function OverrideSandboxPreview({ override, componentId }: OverrideSandboxPreviewProps) {
  if (!override || override.status !== 'active' || !override.compiledCode) {
    return (
      <Flex
        align="center"
        justify="center"
        vertical
        gap={8}
        style={{ height: '100%', padding: 24 }}
      >
        <ExclamationCircleOutlined
          style={{ fontSize: 32, color: 'var(--ant-color-text-quaternary)' }}
        />
        <Text type="secondary" style={{ textAlign: 'center', maxWidth: 260, fontSize: 13 }}>
          {!override
            ? 'Save your code and click "Compile & Activate" to see a live preview.'
            : override.status === 'error'
              ? 'Fix the compile error to enable preview.'
              : 'Compile the override to see a live preview.'}
        </Text>
      </Flex>
    );
  }

  return <ActiveSandbox compiledCode={override.compiledCode} componentId={componentId} />;
}

// ---------------------------------------------------------------------------
// ActiveSandbox — renders once we have compiled code
// ---------------------------------------------------------------------------

function ActiveSandbox({
  compiledCode,
  componentId,
}: {
  compiledCode: string;
  componentId: string;
}) {
  const [sandboxError, setSandboxError] = React.useState<string | null>(null);

  const { iframeRef, isReady, renderError } = useOverrideSandbox({
    compiledCode,
    componentId: componentId as Parameters<typeof useOverrideSandbox>[0]['componentId'],
    props: DEMO_PROPS[componentId] ?? {},
    ctx: { workspaceSlug: 'demo', colorScheme: 'light', emit: () => undefined },
    onError: setSandboxError,
  });

  return (
    <Flex vertical style={{ height: '100%' }}>
      {(sandboxError ?? renderError) && (
        <Alert
          type="error"
          message="Preview error"
          description={sandboxError ?? renderError}
          showIcon
          style={{ borderRadius: 0, flexShrink: 0 }}
        />
      )}
      {!isReady && (
        <Flex
          align="center"
          justify="center"
          style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.6)', zIndex: 1 }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            Loading sandbox…
          </Text>
        </Flex>
      )}
      <iframe
        ref={iframeRef}
        src={SANDBOX_URL}
        sandbox="allow-scripts"
        style={{ flex: 1, border: 'none', width: '100%' }}
        title={`${componentId} override preview`}
      />
    </Flex>
  );
}
