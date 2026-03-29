/**
 * Component SDK — built-in component registry.
 *
 * Defines all overridable components, their props, and starter templates.
 * This is the single source of truth imported by both the backend compiler
 * and the frontend editor.
 */

import type { OverridableComponentMeta, OverridableComponentId } from './types';

// ---------------------------------------------------------------------------
// Starter template helper
// ---------------------------------------------------------------------------

function starterTsx(componentId: OverridableComponentId, propsType: string, body: string): string {
  return `import React from 'react';
import type { ComponentSdkContext } from '@notesaner/component-sdk';

${propsType}

interface Props extends ${componentId}Props {
  sdk: ComponentSdkContext;
}

export default function ${componentId}({ sdk, ...props }: Props) {
${body}
}
`;
}

// ---------------------------------------------------------------------------
// Registry entries
// ---------------------------------------------------------------------------

const REGISTRY: Record<OverridableComponentId, OverridableComponentMeta> = {
  NoteCard: {
    id: 'NoteCard',
    displayName: 'Note Card',
    description: 'Preview card shown in note lists (grid and list views).',
    baseVersion: '1.0.0',
    props: [
      { name: 'noteId', type: 'string', required: true, description: 'UUID of the note.' },
      { name: 'title', type: 'string', required: true, description: 'Note title.' },
      {
        name: 'excerpt',
        type: 'string',
        required: false,
        description: 'First 200 chars of content.',
      },
      { name: 'updatedAt', type: 'string', required: true, description: 'ISO timestamp.' },
      { name: 'tags', type: 'string[]', required: false, description: 'Tag names.' },
      { name: 'onClick', type: '() => void', required: true, description: 'Open the note.' },
    ],
    starterTemplate: starterTsx(
      'NoteCard',
      `interface NoteCardProps {
  noteId: string;
  title: string;
  excerpt?: string;
  updatedAt: string;
  tags?: string[];
  onClick: () => void;
}`,
      `  return (
    <div onClick={props.onClick} style={{ cursor: 'pointer', padding: 12, border: '1px solid #eee', borderRadius: 8 }}>
      <h3 style={{ margin: 0 }}>{props.title}</h3>
      {props.excerpt && <p style={{ margin: '4px 0 0', color: '#666', fontSize: 13 }}>{props.excerpt}</p>}
    </div>
  );`,
    ),
  },

  FileTreeItem: {
    id: 'FileTreeItem',
    displayName: 'File Tree Item',
    description: 'A single row in the file explorer sidebar tree.',
    baseVersion: '1.0.0',
    props: [
      { name: 'name', type: 'string', required: true, description: 'File or folder name.' },
      { name: 'isFolder', type: 'boolean', required: true },
      {
        name: 'isActive',
        type: 'boolean',
        required: false,
        description: 'Whether this entry is currently open.',
      },
      { name: 'depth', type: 'number', required: true, description: 'Nesting depth (0 = root).' },
      { name: 'isExpanded', type: 'boolean', required: false },
      { name: 'onClick', type: '() => void', required: true },
      { name: 'onToggle', type: '() => void', required: false },
    ],
    starterTemplate: starterTsx(
      'FileTreeItem',
      `interface FileTreeItemProps {
  name: string;
  isFolder: boolean;
  isActive?: boolean;
  depth: number;
  isExpanded?: boolean;
  onClick: () => void;
  onToggle?: () => void;
}`,
      `  const indent = props.depth * 16;
  return (
    <div
      onClick={props.onClick}
      style={{ paddingLeft: indent + 8, paddingBlock: 4, cursor: 'pointer', background: props.isActive ? '#e6f4ff' : 'transparent' }}
    >
      {props.isFolder ? (props.isExpanded ? '▾ ' : '▸ ') : '  '}
      {props.name}
    </div>
  );`,
    ),
  },

  StatusBarItem: {
    id: 'StatusBarItem',
    displayName: 'Status Bar Item',
    description: 'A single segment in the bottom status bar.',
    baseVersion: '1.0.0',
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'icon', type: 'string', required: false, description: 'Ant Design icon name.' },
      { name: 'onClick', type: '() => void', required: false },
      { name: 'tooltip', type: 'string', required: false },
    ],
    starterTemplate: starterTsx(
      'StatusBarItem',
      `interface StatusBarItemProps {
  label: string;
  icon?: string;
  onClick?: () => void;
  tooltip?: string;
}`,
      `  return (
    <span
      onClick={props.onClick}
      title={props.tooltip}
      style={{ padding: '0 8px', cursor: props.onClick ? 'pointer' : 'default', fontSize: 12 }}
    >
      {props.label}
    </span>
  );`,
    ),
  },

  SidebarPanel: {
    id: 'SidebarPanel',
    displayName: 'Sidebar Panel',
    description: 'A collapsible panel container in the left or right sidebar.',
    baseVersion: '1.0.0',
    props: [
      { name: 'title', type: 'string', required: true },
      { name: 'isCollapsed', type: 'boolean', required: false },
      { name: 'onToggleCollapse', type: '() => void', required: false },
      { name: 'children', type: 'React.ReactNode', required: true },
    ],
    starterTemplate: starterTsx(
      'SidebarPanel',
      `interface SidebarPanelProps {
  title: string;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  children: React.ReactNode;
}`,
      `  return (
    <div style={{ borderBottom: '1px solid #eee' }}>
      <div onClick={props.onToggleCollapse} style={{ padding: '8px 12px', fontWeight: 600, cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
        {props.title}
        <span>{props.isCollapsed ? '▸' : '▾'}</span>
      </div>
      {!props.isCollapsed && <div style={{ padding: '0 12px 8px' }}>{props.children}</div>}
    </div>
  );`,
    ),
  },

  ToolbarButton: {
    id: 'ToolbarButton',
    displayName: 'Toolbar Button',
    description: 'A button in the editor toolbar.',
    baseVersion: '1.0.0',
    props: [
      { name: 'label', type: 'string', required: true },
      { name: 'icon', type: 'string', required: false },
      { name: 'isActive', type: 'boolean', required: false },
      { name: 'isDisabled', type: 'boolean', required: false },
      { name: 'onClick', type: '() => void', required: true },
      { name: 'tooltip', type: 'string', required: false },
    ],
    starterTemplate: starterTsx(
      'ToolbarButton',
      `interface ToolbarButtonProps {
  label: string;
  icon?: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  tooltip?: string;
}`,
      `  return (
    <button
      onClick={props.onClick}
      disabled={props.isDisabled}
      title={props.tooltip ?? props.label}
      style={{ padding: '4px 8px', borderRadius: 4, border: 'none', background: props.isActive ? '#e6f4ff' : 'transparent', cursor: props.isDisabled ? 'not-allowed' : 'pointer' }}
    >
      {props.label}
    </button>
  );`,
    ),
  },

  CalloutBlock: {
    id: 'CalloutBlock',
    displayName: 'Callout Block',
    description: 'An admonition/callout block rendered inside notes.',
    baseVersion: '1.0.0',
    props: [
      { name: 'type', type: "'info' | 'warning' | 'danger' | 'tip' | 'note'", required: true },
      { name: 'title', type: 'string', required: false },
      { name: 'children', type: 'React.ReactNode', required: true },
    ],
    starterTemplate: starterTsx(
      'CalloutBlock',
      `interface CalloutBlockProps {
  type: 'info' | 'warning' | 'danger' | 'tip' | 'note';
  title?: string;
  children: React.ReactNode;
}`,
      `  const colors: Record<string, string> = { info: '#e6f4ff', warning: '#fffbe6', danger: '#fff1f0', tip: '#f6ffed', note: '#f5f5f5' };
  return (
    <div style={{ background: colors[props.type] ?? '#f5f5f5', padding: '12px 16px', borderRadius: 6, margin: '8px 0' }}>
      {props.title && <strong style={{ display: 'block', marginBottom: 4 }}>{props.title}</strong>}
      {props.children}
    </div>
  );`,
    ),
  },

  CodeBlock: {
    id: 'CodeBlock',
    displayName: 'Code Block',
    description: 'A syntax-highlighted code block rendered inside notes.',
    baseVersion: '1.0.0',
    props: [
      { name: 'code', type: 'string', required: true, description: 'Raw code content.' },
      {
        name: 'language',
        type: 'string',
        required: false,
        description: 'Language hint for highlighting.',
      },
      { name: 'filename', type: 'string', required: false },
      { name: 'showLineNumbers', type: 'boolean', required: false },
    ],
    starterTemplate: starterTsx(
      'CodeBlock',
      `interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  showLineNumbers?: boolean;
}`,
      `  return (
    <div style={{ background: '#1e1e1e', borderRadius: 6, overflow: 'hidden', margin: '8px 0' }}>
      {props.filename && <div style={{ background: '#2d2d2d', color: '#ccc', fontSize: 12, padding: '4px 12px' }}>{props.filename}</div>}
      <pre style={{ margin: 0, padding: '12px 16px', color: '#d4d4d4', fontSize: 13, overflowX: 'auto' }}>
        <code>{props.code}</code>
      </pre>
    </div>
  );`,
    ),
  },

  SearchResultItem: {
    id: 'SearchResultItem',
    displayName: 'Search Result Item',
    description: 'A single result row in the command palette / search overlay.',
    baseVersion: '1.0.0',
    props: [
      { name: 'noteId', type: 'string', required: true },
      { name: 'title', type: 'string', required: true },
      {
        name: 'excerpt',
        type: 'string',
        required: false,
        description: 'Highlighted match context.',
      },
      { name: 'path', type: 'string', required: true, description: 'Vault-relative file path.' },
      { name: 'isSelected', type: 'boolean', required: false },
      { name: 'onClick', type: '() => void', required: true },
    ],
    starterTemplate: starterTsx(
      'SearchResultItem',
      `interface SearchResultItemProps {
  noteId: string;
  title: string;
  excerpt?: string;
  path: string;
  isSelected?: boolean;
  onClick: () => void;
}`,
      `  // ⚠️ XSS WARNING: dangerouslySetInnerHTML renders raw HTML from props.excerpt.
  // The excerpt must be sanitized before rendering. Use DOMPurify:
  //   import DOMPurify from 'dompurify';
  //   const safeExcerpt = DOMPurify.sanitize(props.excerpt ?? '');
  //   <div dangerouslySetInnerHTML={{ __html: safeExcerpt }} />
  return (
    <div onClick={props.onClick} style={{ padding: '8px 12px', cursor: 'pointer', background: props.isSelected ? '#e6f4ff' : 'transparent' }}>
      <div style={{ fontWeight: 500 }}>{props.title}</div>
      {props.excerpt && <div style={{ fontSize: 12, color: '#666', marginTop: 2 }} dangerouslySetInnerHTML={{ __html: props.excerpt }} />}
      <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{props.path}</div>
    </div>
  );`,
    ),
  },
};

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

export function getComponentRegistry(): OverridableComponentMeta[] {
  return Object.values(REGISTRY);
}

export function getComponentMeta(id: OverridableComponentId): OverridableComponentMeta | undefined {
  return REGISTRY[id];
}

export const COMPONENT_SDK_VERSION = '1.0.0';
