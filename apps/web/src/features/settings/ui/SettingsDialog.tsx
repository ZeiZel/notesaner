'use client';

/**
 * SettingsDialog -- full-screen settings modal with sidebar navigation.
 *
 * Opened by Cmd+, from the keyboard shortcut system or programmatically.
 *
 * Structure:
 *   - Left: narrow sidebar with nav items grouped by section
 *   - Right: scrollable content area rendering the active tab
 *
 * Admin-only tabs (Workspace, Members) are gated by an `isAdmin` prop.
 *
 * Uses Ant Design Modal as the dialog foundation.
 * All state is local/Zustand -- no useEffect needed.
 */

import { useState, Suspense, lazy } from 'react';
import { Modal, Menu, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { Box } from '@/shared/ui';
import { PanelSpinner } from '@/shared/ui/skeletons';

// Lazy-load each settings tab -- only the active tab's chunk is downloaded.
// Profile is imported eagerly since it is the default tab.
import { ProfileSettings } from './ProfileSettings';

const EditorSettings = lazy(() =>
  import('./EditorSettings').then((m) => ({ default: m.EditorSettings })),
);
const ThemeSettingsTab = lazy(() =>
  import('./ThemeSettingsTab').then((m) => ({ default: m.ThemeSettingsTab })),
);
const KeybindingsSettings = lazy(() =>
  import('./KeybindingsSettings').then((m) => ({ default: m.KeybindingsSettings })),
);
const PluginSettings = lazy(() =>
  import('./PluginSettings').then((m) => ({ default: m.PluginSettings })),
);
const WorkspaceSettings = lazy(() =>
  import('./WorkspaceSettings').then((m) => ({ default: m.WorkspaceSettings })),
);
const MemberManagement = lazy(() =>
  import('./MemberManagement').then((m) => ({ default: m.MemberManagement })),
);
const NotificationSettings = lazy(() =>
  import('@/features/notifications').then((m) => ({ default: m.NotificationSettings })),
);
const SessionsSettings = lazy(() =>
  import('./SessionsSettings').then((m) => ({ default: m.SessionsSettings })),
);

// ---------------------------------------------------------------------------
// Nav items
// ---------------------------------------------------------------------------

type SettingsTab =
  | 'profile'
  | 'editor'
  | 'theme'
  | 'keybindings'
  | 'notifications'
  | 'sessions'
  | 'plugins'
  | 'workspace'
  | 'members';

const TAB_TITLES: Record<SettingsTab, string> = {
  profile: 'Profile',
  editor: 'Editor',
  theme: 'Appearance',
  keybindings: 'Keybindings',
  notifications: 'Notifications',
  sessions: 'Sessions',
  plugins: 'Plugins',
  workspace: 'Workspace',
  members: 'Members',
};

// ---------------------------------------------------------------------------
// SettingsDialog props
// ---------------------------------------------------------------------------

export interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  /** When true, workspace and members tabs are visible. Defaults to false. */
  isAdmin?: boolean;
  /** Initial tab to open. Defaults to 'profile'. */
  initialTab?: SettingsTab;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function SettingsDialog({
  open,
  onClose,
  isAdmin = false,
  initialTab = 'profile',
}: SettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const personalItems: MenuProps['items'] = [
    {
      key: 'personal-group',
      label: 'Personal',
      type: 'group',
      children: [
        { key: 'profile', label: 'Profile' },
        { key: 'editor', label: 'Editor' },
        { key: 'theme', label: 'Appearance' },
        { key: 'keybindings', label: 'Keybindings' },
        { key: 'notifications', label: 'Notifications' },
        { key: 'sessions', label: 'Sessions' },
        { key: 'plugins', label: 'Plugins' },
      ],
    },
  ];

  const adminItems: MenuProps['items'] = isAdmin
    ? [
        {
          key: 'workspace-group',
          label: 'Workspace',
          type: 'group',
          children: [
            { key: 'workspace', label: 'Workspace' },
            { key: 'members', label: 'Members' },
          ],
        },
      ]
    : [];

  const menuItems: MenuProps['items'] = [...personalItems, ...adminItems];

  function renderContent() {
    switch (activeTab) {
      case 'profile':
        return <ProfileSettings />;
      case 'editor':
        return <EditorSettings />;
      case 'theme':
        return <ThemeSettingsTab />;
      case 'keybindings':
        return <KeybindingsSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'sessions':
        return <SessionsSettings />;
      case 'plugins':
        return <PluginSettings />;
      case 'workspace':
        return <WorkspaceSettings />;
      case 'members':
        return <MemberManagement />;
    }
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width="90vw"
      style={{ top: '5vh', maxWidth: 1200 }}
      styles={{
        body: { padding: 0, height: '80vh', display: 'flex', overflow: 'hidden' },
        root: { padding: 0 },
      }}
      destroyOnClose={false}
      title={null}
      closable={false}
    >
      <Box className="flex h-full w-full">
        {/* Left sidebar */}
        <Box
          as="nav"
          aria-label="Settings navigation"
          className="flex flex-col shrink-0 border-r overflow-y-auto"
          style={{
            width: 208,
            borderColor: 'var(--ns-color-border)',
            backgroundColor: 'var(--ns-color-background-surface)',
          }}
        >
          <Box className="px-4 pt-4 pb-2">
            <Typography.Text
              type="secondary"
              style={{
                fontSize: 11,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              Settings
            </Typography.Text>
          </Box>

          <Menu
            mode="inline"
            selectedKeys={[activeTab]}
            onClick={({ key }) => setActiveTab(key as SettingsTab)}
            items={menuItems}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
            }}
          />
        </Box>

        {/* Content area */}
        <Box role="tabpanel" aria-label={TAB_TITLES[activeTab]} className="flex-1 overflow-y-auto">
          <Box className="max-w-3xl px-8 py-6">
            {/* Section header */}
            <Box className="mb-6">
              <Typography.Title level={4} style={{ marginBottom: 4 }}>
                {TAB_TITLES[activeTab]}
              </Typography.Title>
            </Box>

            {/* Active section content (lazy-loaded tabs wrapped in Suspense) */}
            <Suspense fallback={<PanelSpinner />}>{renderContent()}</Suspense>
          </Box>
        </Box>
      </Box>
    </Modal>
  );
}
