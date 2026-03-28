'use client';

/**
 * AppearanceSettings -- workspace-level theme, CSS snippets, and sidebar defaults.
 *
 * Uses the workspace settings store for read/write. Appearance changes
 * are debounced (500ms) to auto-save without excessive API calls.
 *
 * Note: useEffect is used here for the debounce timer -- a valid use case
 * since it is a side effect (network request) not derivable during render.
 *
 * Styled with Ant Design Card, Switch, Slider, Button, Typography, Input.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import {
  Card,
  Switch,
  Slider,
  Button,
  Typography,
  Input,
  Space,
  Empty,
  Alert,
  Tooltip,
} from 'antd';
import {
  DeleteOutlined,
  PlusOutlined,
  WarningOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Box } from '@/shared/ui';
import { useAuthStore } from '@/shared/stores/auth-store';
import { isCssSafe } from '@/shared/lib/css-sanitizer';
import { useWorkspaceSettingsStore } from '../model/workspace-settings-store';
import type { CssSnippet, SidebarDefaults } from '@/shared/api/workspace-settings';

// ---------------------------------------------------------------------------
// Theme options
// ---------------------------------------------------------------------------

const THEME_OPTIONS = [
  { value: 'system', label: 'System default', description: 'Follow OS preference' },
  { value: 'light', label: 'Light', description: 'Light background' },
  { value: 'dark', label: 'Dark', description: 'Dark background' },
  { value: 'sepia', label: 'Sepia', description: 'Warm paper tone' },
  { value: 'nord', label: 'Nord', description: 'Cool blue-grey palette' },
  { value: 'solarized', label: 'Solarized', description: 'Ethan Schoonover palette' },
] as const;

// ---------------------------------------------------------------------------
// AppearanceSettings
// ---------------------------------------------------------------------------

export function AppearanceSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);

  const settings = useWorkspaceSettingsStore((s) => s.settings);
  const updateAppearance = useWorkspaceSettingsStore((s) => s.updateAppearance);
  const isSaving = useWorkspaceSettingsStore((s) => s.isSaving);

  // Local form state initialized from settings
  const [selectedTheme, setSelectedTheme] = useState(settings?.defaultTheme ?? 'system');
  const [snippets, setSnippets] = useState<CssSnippet[]>(settings?.cssSnippets ?? []);
  const [sidebarDefaults, setSidebarDefaults] = useState<SidebarDefaults>(
    settings?.sidebarDefaults ?? {
      leftSidebarOpen: true,
      rightSidebarOpen: false,
      leftSidebarWidth: 260,
      rightSidebarWidth: 280,
    },
  );

  // ---- Auto-save debounce ----
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedSave = useCallback(
    (patch: {
      defaultTheme?: string;
      cssSnippets?: CssSnippet[];
      sidebarDefaults?: SidebarDefaults;
    }) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (!accessToken) return;
        void updateAppearance(accessToken, workspaceId, patch);
      }, 500);
    },
    [accessToken, workspaceId, updateAppearance],
  );

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---- Theme change ----
  const handleThemeChange = (theme: string) => {
    setSelectedTheme(theme);
    debouncedSave({ defaultTheme: theme });
  };

  // ---- CSS snippet handlers ----
  const handleAddSnippet = () => {
    const newSnippet: CssSnippet = {
      id: crypto.randomUUID(),
      name: `Snippet ${snippets.length + 1}`,
      css: '',
      enabled: true,
    };
    const updated = [...snippets, newSnippet];
    setSnippets(updated);
  };

  const handleUpdateSnippet = (id: string, patch: Partial<CssSnippet>) => {
    const updated = snippets.map((s) => (s.id === id ? { ...s, ...patch } : s));
    setSnippets(updated);
    debouncedSave({ cssSnippets: updated });
  };

  const handleRemoveSnippet = (id: string) => {
    const updated = snippets.filter((s) => s.id !== id);
    setSnippets(updated);
    debouncedSave({ cssSnippets: updated });
  };

  // ---- Sidebar defaults ----
  const handleSidebarDefaultChange = (patch: Partial<SidebarDefaults>) => {
    const updated = { ...sidebarDefaults, ...patch };
    setSidebarDefaults(updated);
    debouncedSave({ sidebarDefaults: updated });
  };

  return (
    <Box style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Page header */}
      <Box>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          Appearance
        </Typography.Title>
        <Typography.Text type="secondary">
          Default theme, CSS customization, and sidebar layout for this workspace. Changes
          auto-save.
        </Typography.Text>
      </Box>

      {/* Default theme */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Default theme
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginBottom: 16, fontSize: 12 }}
        >
          This sets the default theme for all workspace members. Individual users can override this
          in their personal settings.
        </Typography.Text>
        <Box className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <Card
              key={option.value}
              hoverable
              size="small"
              onClick={() => handleThemeChange(option.value)}
              style={{
                borderColor: selectedTheme === option.value ? 'var(--ns-color-primary)' : undefined,
                cursor: 'pointer',
              }}
              styles={{
                body: { padding: 12 },
              }}
            >
              <Typography.Text strong style={{ fontSize: 14 }}>
                {option.label}
              </Typography.Text>
              <Typography.Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                {option.description}
              </Typography.Text>
            </Card>
          ))}
        </Box>
      </Box>

      {/* CSS snippets */}
      <Box as="section">
        <Box className="flex items-center justify-between" style={{ marginBottom: 12 }}>
          <Box>
            <Typography.Text strong style={{ fontSize: 14 }}>
              CSS snippets
            </Typography.Text>
            <Typography.Text
              type="secondary"
              style={{ display: 'block', fontSize: 12, marginTop: 2 }}
            >
              Custom CSS applied to all members of this workspace.{' '}
              <Tooltip title="Use Notesaner --ns-* tokens or Obsidian CSS variables (e.g. --background-primary). Both are supported.">
                <InfoCircleOutlined style={{ cursor: 'help' }} />
              </Tooltip>
            </Typography.Text>
          </Box>
          <Button size="small" icon={<PlusOutlined />} onClick={handleAddSnippet}>
            Add snippet
          </Button>
        </Box>

        {snippets.length === 0 ? (
          <Card>
            <Empty description="No CSS snippets defined.">
              <Button type="link" onClick={handleAddSnippet}>
                Add your first snippet
              </Button>
            </Empty>
          </Card>
        ) : (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            {snippets.map((snippet) => {
              const safe = isCssSafe(snippet.css);
              return (
                <Card key={snippet.id} size="small">
                  <Box className="flex items-center gap-3" style={{ marginBottom: 12 }}>
                    <Switch
                      size="small"
                      checked={snippet.enabled}
                      onChange={(enabled) => handleUpdateSnippet(snippet.id, { enabled })}
                      aria-label={`${snippet.enabled ? 'Disable' : 'Enable'} ${snippet.name}`}
                    />
                    <Input
                      aria-label="Snippet name"
                      value={snippet.name}
                      onChange={(e) => handleUpdateSnippet(snippet.id, { name: e.target.value })}
                      size="small"
                      style={{ flex: 1 }}
                    />
                    <Button
                      type="text"
                      danger
                      size="small"
                      icon={<DeleteOutlined />}
                      onClick={() => handleRemoveSnippet(snippet.id)}
                      title="Remove snippet"
                    />
                  </Box>
                  {!safe && (
                    <Alert
                      type="warning"
                      showIcon
                      icon={<WarningOutlined />}
                      message="Contains blocked constructs (@import, url()) that will be sanitized on apply."
                      style={{ marginBottom: 8, fontSize: 12 }}
                    />
                  )}
                  <Input.TextArea
                    aria-label={`CSS for ${snippet.name}`}
                    value={snippet.css}
                    onChange={(e) => handleUpdateSnippet(snippet.id, { css: e.target.value })}
                    rows={4}
                    placeholder={`/* Custom CSS — use --ns-* tokens or Obsidian variables */\n.my-note {\n  --ns-color-background: #1a1b26;\n}`}
                    style={{ fontFamily: 'monospace', fontSize: 12 }}
                  />
                </Card>
              );
            })}
          </Space>
        )}
      </Box>

      {/* Per-note CSS class hint */}
      <Box as="section">
        <Alert
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          message="Per-note custom CSS"
          description={
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Add{' '}
              <Typography.Text code style={{ fontSize: 12 }}>
                cssClass: my-class
              </Typography.Text>{' '}
              to a note&apos;s frontmatter to apply a custom CSS class to its editor container. Then
              target it in your CSS snippet:{' '}
              <Typography.Text code style={{ fontSize: 12 }}>
                {'.my-class { --ns-color-background: #2a2a3a; }'}
              </Typography.Text>
            </Typography.Text>
          }
        />
      </Box>

      {/* Sidebar defaults */}
      <Box as="section">
        <Typography.Text strong style={{ display: 'block', marginBottom: 4, fontSize: 14 }}>
          Sidebar defaults
        </Typography.Text>
        <Typography.Text
          type="secondary"
          style={{ display: 'block', marginBottom: 16, fontSize: 12 }}
        >
          Default sidebar configuration for new members and fresh sessions.
        </Typography.Text>

        <Box style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Box className="flex items-center justify-between">
            <Typography.Text style={{ fontSize: 14 }}>Left sidebar open by default</Typography.Text>
            <Switch
              checked={sidebarDefaults.leftSidebarOpen}
              onChange={(leftSidebarOpen) => handleSidebarDefaultChange({ leftSidebarOpen })}
            />
          </Box>

          <Box className="flex items-center justify-between">
            <Typography.Text style={{ fontSize: 14 }}>
              Right sidebar open by default
            </Typography.Text>
            <Switch
              checked={sidebarDefaults.rightSidebarOpen}
              onChange={(rightSidebarOpen) => handleSidebarDefaultChange({ rightSidebarOpen })}
            />
          </Box>

          <Box>
            <Typography.Text style={{ fontSize: 14 }}>
              Left sidebar width ({sidebarDefaults.leftSidebarWidth}px)
            </Typography.Text>
            <Slider
              min={180}
              max={400}
              step={10}
              value={sidebarDefaults.leftSidebarWidth}
              onChange={(leftSidebarWidth) => handleSidebarDefaultChange({ leftSidebarWidth })}
            />
          </Box>

          <Box>
            <Typography.Text style={{ fontSize: 14 }}>
              Right sidebar width ({sidebarDefaults.rightSidebarWidth}px)
            </Typography.Text>
            <Slider
              min={200}
              max={400}
              step={10}
              value={sidebarDefaults.rightSidebarWidth}
              onChange={(rightSidebarWidth) => handleSidebarDefaultChange({ rightSidebarWidth })}
            />
          </Box>
        </Box>
      </Box>

      {/* Save indicator */}
      {isSaving && (
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          Auto-saving...
        </Typography.Text>
      )}
    </Box>
  );
}
