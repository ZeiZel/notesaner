'use client';

/**
 * KeybindingsSettings -- Full keyboard shortcuts configuration UI.
 *
 * Acceptance criteria implemented:
 *   - List all commands with their current shortcuts
 *   - Click to reassign shortcut (key capture via KeyCaptureInput)
 *   - Conflict detection with warning alerts
 *   - Reset individual shortcut to default
 *   - Reset all to defaults
 *   - Search shortcuts by command name
 *   - Plugin shortcuts grouped by plugin name
 *   - Export/import keybindings as JSON
 *
 * State is in useShortcutStore (Zustand, canonical source).
 * No unnecessary useEffect: filtering and grouping are derived state.
 * Uses Ant Design components throughout: Table, Input.Search, Button, Modal, Tag, Alert.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Button,
  Input,
  Table,
  Tag,
  Modal,
  Alert,
  Space,
  Typography,
  Tooltip,
  Upload,
  Flex,
  message,
} from 'antd';
import {
  SearchOutlined,
  UploadOutlined,
  DownloadOutlined,
  UndoOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  EditOutlined,
  CloseOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { RcFile } from 'antd/es/upload';
import { Box } from '@/shared/ui';
import { formatCombo, type KeyCombo, KEYBOARD_SHORTCUTS } from '@/shared/lib/keyboard-shortcuts';
import {
  keyboardManager,
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type ResolvedShortcut,
  type ShortcutScope,
} from '@/shared/lib/keyboard-manager';
import { useShortcutStore } from '@/shared/stores/shortcut-store';
import { KeyCaptureInput } from '@/features/shortcuts/ui/KeyCaptureInput';
import { apiClient } from '@/shared/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Row data shape for the Ant Design Table. */
interface ShortcutRow {
  key: string;
  id: string;
  label: string;
  category: string;
  categoryKey: string;
  scope: 'global' | 'editor';
  effectiveCombo: KeyCombo;
  defaultCombo: KeyCombo;
  isOverridden: boolean;
  conflicts: string[];
  /** For plugin shortcuts: the plugin name extracted from the ID. */
  pluginName?: string;
}

/** Shape of exported/imported keybindings JSON. */
interface KeybindingsExport {
  version: 1;
  exportedAt: string;
  overrides: Record<string, KeyCombo | null>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the plugin name from a shortcut ID following the convention `pluginId.action`.
 * Returns undefined for built-in shortcuts.
 */
function extractPluginName(id: string): string | undefined {
  const isBuiltIn = KEYBOARD_SHORTCUTS.some((s) => s.id === id);
  if (isBuiltIn) return undefined;

  // Plugin IDs follow pattern: "pluginName.actionName"
  const dotIndex = id.indexOf('.');
  if (dotIndex > 0) {
    return id.substring(0, dotIndex);
  }
  return 'Plugin';
}

/**
 * Resolves a list of conflicting action IDs into human-readable labels.
 */
function resolveConflictLabels(conflictIds: string[]): string {
  return conflictIds
    .map((id) => {
      const builtIn = KEYBOARD_SHORTCUTS.find((s) => s.id === id);
      if (builtIn) return builtIn.label;
      const all = keyboardManager.getAllShortcuts();
      const found = all.find((s) => s.id === id);
      return found?.label ?? id;
    })
    .join(', ');
}

/**
 * Convert resolved shortcuts into table row data, sorted by category order.
 */
function buildTableData(resolved: ResolvedShortcut[]): ShortcutRow[] {
  return resolved.map((s) => ({
    key: s.id,
    id: s.id,
    label: s.label,
    category: CATEGORY_LABELS[s.category] ?? s.category,
    categoryKey: s.category,
    scope: s.scope,
    effectiveCombo: s.effectiveCombo,
    defaultCombo: s.combo,
    isOverridden: s.isOverridden,
    conflicts: s.conflicts,
    pluginName: extractPluginName(s.id),
  }));
}

/**
 * Groups plugin shortcuts by plugin name for display.
 */
function getPluginGroups(rows: ShortcutRow[]): Map<string, ShortcutRow[]> {
  const groups = new Map<string, ShortcutRow[]>();
  for (const row of rows) {
    if (row.pluginName) {
      const existing = groups.get(row.pluginName) ?? [];
      existing.push(row);
      groups.set(row.pluginName, existing);
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Conflict warning inline alert. */
function ConflictWarning({ conflictIds }: { conflictIds: string[] }) {
  if (conflictIds.length === 0) return null;

  const labels = resolveConflictLabels(conflictIds);

  return (
    <Typography.Text type="danger" style={{ fontSize: 11 }}>
      <WarningOutlined style={{ marginRight: 4 }} />
      Conflicts with: {labels}
    </Typography.Text>
  );
}

// ---------------------------------------------------------------------------
// KeybindingsSettings (main component)
// ---------------------------------------------------------------------------

export function KeybindingsSettings() {
  const overrides = useShortcutStore((s) => s.overrides);
  const setOverride = useShortcutStore((s) => s.setOverride);
  const resetOverride = useShortcutStore((s) => s.resetOverride);
  const resetAll = useShortcutStore((s) => s.resetAll);

  const [searchQuery, setSearchQuery] = useState('');
  const [capturingId, setCapturingId] = useState<string | null>(null);
  const [pendingCombo, setPendingCombo] = useState<KeyCombo | null>(null);
  const [pendingConflicts, setPendingConflicts] = useState<string[]>([]);
  const [confirmResetAllOpen, setConfirmResetAllOpen] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const hasOverrides = Object.keys(overrides).length > 0;

  // ---- Resolve all shortcuts with effective combos and conflicts ----
  const resolved = useMemo(() => {
    keyboardManager.setOverrides(overrides);
    return keyboardManager.getResolvedShortcuts();
  }, [overrides]);

  // ---- Build table data ----
  const allRows = useMemo(() => buildTableData(resolved), [resolved]);

  // ---- Filter by search query ----
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const term = searchQuery.toLowerCase();
    return allRows.filter(
      (row) =>
        row.label.toLowerCase().includes(term) ||
        row.id.toLowerCase().includes(term) ||
        row.category.toLowerCase().includes(term) ||
        formatCombo(row.effectiveCombo).toLowerCase().includes(term) ||
        (row.pluginName && row.pluginName.toLowerCase().includes(term)),
    );
  }, [allRows, searchQuery]);

  // ---- Separate built-in and plugin shortcuts ----
  const builtInRows = useMemo(() => filteredRows.filter((r) => !r.pluginName), [filteredRows]);
  const pluginGroups = useMemo(() => getPluginGroups(filteredRows), [filteredRows]);

  // ---- Conflict summary ----
  const totalConflicts = useMemo(
    () => resolved.filter((s) => s.conflicts.length > 0).length,
    [resolved],
  );

  // ---- Capture handlers ----
  const handleStartCapture = useCallback((id: string) => {
    setCapturingId(id);
    setPendingCombo(null);
    setPendingConflicts([]);
  }, []);

  const handleCancelCapture = useCallback(() => {
    setCapturingId(null);
    setPendingCombo(null);
    setPendingConflicts([]);
  }, []);

  const handleCapture = useCallback(
    (id: string, combo: KeyCombo) => {
      // Check for conflicts before accepting
      const scope: ShortcutScope =
        resolved.find((s) => s.id === id)?.scope === 'editor' ? 'editor' : 'global';
      const conflicts = keyboardManager.wouldConflict(combo, scope, id);

      if (conflicts.length > 0) {
        setPendingCombo(combo);
        setPendingConflicts(conflicts);
      } else {
        // No conflict -- apply immediately
        setOverride(id, combo);
        setCapturingId(null);
        setPendingCombo(null);
        setPendingConflicts([]);
      }
    },
    [resolved, setOverride],
  );

  const handleForceAssign = useCallback(() => {
    if (capturingId && pendingCombo) {
      setOverride(capturingId, pendingCombo);
      setCapturingId(null);
      setPendingCombo(null);
      setPendingConflicts([]);
    }
  }, [capturingId, pendingCombo, setOverride]);

  // ---- Reset all with confirmation ----
  const handleResetAll = useCallback(() => {
    resetAll();
    setConfirmResetAllOpen(false);
    messageApi.success('All shortcuts restored to defaults');
  }, [resetAll, messageApi]);

  // ---- Export keybindings as JSON ----
  const handleExport = useCallback(() => {
    const exportData: KeybindingsExport = {
      version: 1,
      exportedAt: new Date().toISOString(),
      overrides,
    };

    const json = JSON.stringify(exportData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `notesaner-keybindings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    messageApi.success('Keybindings exported successfully');
  }, [overrides, messageApi]);

  // ---- Import keybindings from JSON ----
  const handleImport = useCallback(
    (file: RcFile) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const data = JSON.parse(text) as KeybindingsExport;

          if (data.version !== 1 || typeof data.overrides !== 'object') {
            messageApi.error('Invalid keybindings file format');
            return;
          }

          // Validate each override entry
          for (const [id, combo] of Object.entries(data.overrides)) {
            if (combo !== null && (typeof combo !== 'object' || typeof combo.key !== 'string')) {
              messageApi.error(`Invalid key combo for shortcut "${id}"`);
              return;
            }
          }

          // Apply all overrides
          for (const [id, combo] of Object.entries(data.overrides)) {
            setOverride(id, combo);
          }

          messageApi.success(`Imported ${Object.keys(data.overrides).length} shortcut override(s)`);
        } catch {
          messageApi.error('Failed to parse keybindings file. Ensure it is valid JSON.');
        }
      };
      reader.readAsText(file);

      // Prevent default upload behavior
      return false;
    },
    [setOverride, messageApi],
  );

  // ---- Save overrides to server ----
  const handleSaveToServer = useCallback(async () => {
    try {
      await apiClient.put('/api/user/preferences/keybindings', { overrides });
      messageApi.success('Keybindings saved to your account');
    } catch {
      messageApi.error('Failed to save keybindings. Changes are preserved locally.');
    }
  }, [overrides, messageApi]);

  // ---- Table column definitions ----
  const columns: ColumnsType<ShortcutRow> = [
    {
      title: 'Command',
      dataIndex: 'label',
      key: 'label',
      width: '40%',
      render: (_: unknown, record: ShortcutRow) => (
        <Box>
          <Typography.Text style={{ fontSize: 13 }}>{record.label}</Typography.Text>
          {record.scope === 'editor' && (
            <Tag
              style={{
                fontSize: 10,
                lineHeight: '16px',
                marginInlineStart: 8,
                padding: '0 4px',
              }}
            >
              editor
            </Tag>
          )}
          {record.conflicts.length > 0 && !capturingId && (
            <Box className="mt-1">
              <ConflictWarning conflictIds={record.conflicts} />
            </Box>
          )}
        </Box>
      ),
    },
    {
      title: 'Shortcut',
      key: 'shortcut',
      width: '30%',
      render: (_: unknown, record: ShortcutRow) => {
        const isCapturing = capturingId === record.id;

        return (
          <Box>
            <KeyCaptureInput
              capturing={isCapturing}
              currentCombo={record.effectiveCombo}
              isOverridden={record.isOverridden}
              hasConflict={record.conflicts.length > 0}
              pendingCombo={isCapturing ? pendingCombo : null}
              onCapture={(combo) => handleCapture(record.id, combo)}
              onCancel={handleCancelCapture}
              shortcutLabel={record.label}
            />
            {isCapturing && pendingConflicts.length > 0 && (
              <Box className="mt-1">
                <ConflictWarning conflictIds={pendingConflicts} />
              </Box>
            )}
          </Box>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: '30%',
      align: 'right',
      render: (_: unknown, record: ShortcutRow) => {
        const isCapturing = capturingId === record.id;
        const hasPendingConflict = isCapturing && pendingConflicts.length > 0;

        if (isCapturing) {
          return (
            <Space size={4}>
              {hasPendingConflict && (
                <Tooltip title="Override conflicting shortcut">
                  <Button
                    type="text"
                    size="small"
                    icon={<CheckOutlined />}
                    onClick={handleForceAssign}
                    style={{ color: 'var(--ns-color-warning, #d97706)' }}
                  >
                    Assign anyway
                  </Button>
                </Tooltip>
              )}
              <Button
                type="text"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancelCapture}
              >
                Cancel
              </Button>
            </Space>
          );
        }

        return (
          <Space size={4}>
            <Tooltip title="Change shortcut">
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleStartCapture(record.id)}
              >
                Edit
              </Button>
            </Tooltip>
            {record.isOverridden && (
              <Tooltip title="Reset to default">
                <Button
                  type="text"
                  size="small"
                  icon={<UndoOutlined />}
                  onClick={() => resetOverride(record.id)}
                >
                  Reset
                </Button>
              </Tooltip>
            )}
          </Space>
        );
      },
    },
  ];

  // ---- Group built-in rows by category for visual structure ----
  const categorizedSections = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    rows: builtInRows.filter((r) => r.categoryKey === cat),
  })).filter((section) => section.rows.length > 0);

  return (
    <Box className="max-w-3xl" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {contextHolder}

      {/* ---- Conflict alert ---- */}
      {totalConflicts > 0 && (
        <Alert
          message={`${totalConflicts} shortcut conflict${totalConflicts !== 1 ? 's' : ''} detected`}
          description="Some shortcuts are bound to the same key combination. Conflicting shortcuts are highlighted below."
          type="warning"
          showIcon
          icon={<ExclamationCircleOutlined />}
          closable
        />
      )}

      {/* ---- Toolbar: search, actions ---- */}
      <Flex justify="space-between" align="center" gap={12} wrap="wrap">
        <Input
          placeholder="Search by command name, shortcut, or category..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
          style={{ maxWidth: 360 }}
          aria-label="Search keyboard shortcuts"
        />

        <Space size={8} wrap>
          <Upload accept=".json" showUploadList={false} beforeUpload={handleImport} maxCount={1}>
            <Button icon={<UploadOutlined />} size="small">
              Import
            </Button>
          </Upload>

          <Button icon={<DownloadOutlined />} size="small" onClick={handleExport}>
            Export
          </Button>

          <Button size="small" onClick={handleSaveToServer} type="primary" ghost>
            Save to account
          </Button>

          {hasOverrides && (
            <Button
              danger
              size="small"
              icon={<UndoOutlined />}
              onClick={() => setConfirmResetAllOpen(true)}
            >
              Reset all
            </Button>
          )}
        </Space>
      </Flex>

      {/* ---- Helper text ---- */}
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Click Edit on any shortcut to assign a new key combination. Overridden shortcuts are
        highlighted in blue, conflicts in red. Changes are saved locally and can be synced to your
        account.
      </Typography.Text>

      {/* ---- Built-in shortcuts by category ---- */}
      {categorizedSections.map((section) => (
        <Box key={section.category}>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 8,
            }}
          >
            {section.label}
          </Typography.Text>

          <Table<ShortcutRow>
            columns={columns}
            dataSource={section.rows}
            pagination={false}
            size="small"
            showHeader={false}
            rowClassName={(record) =>
              record.conflicts.length > 0
                ? 'ant-table-row-conflict'
                : record.isOverridden
                  ? 'ant-table-row-overridden'
                  : ''
            }
          />
        </Box>
      ))}

      {/* ---- Plugin shortcuts (grouped by plugin) ---- */}
      {pluginGroups.size > 0 && (
        <Box>
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              display: 'block',
              marginBottom: 8,
            }}
          >
            Plugins
          </Typography.Text>

          {Array.from(pluginGroups.entries()).map(([pluginName, rows]) => (
            <Box key={pluginName} className="mb-4">
              <Typography.Text strong style={{ fontSize: 13, display: 'block', marginBottom: 4 }}>
                {pluginName}
              </Typography.Text>

              <Table<ShortcutRow>
                columns={columns}
                dataSource={rows}
                pagination={false}
                size="small"
                showHeader={false}
                rowClassName={(record) =>
                  record.conflicts.length > 0
                    ? 'ant-table-row-conflict'
                    : record.isOverridden
                      ? 'ant-table-row-overridden'
                      : ''
                }
              />
            </Box>
          ))}
        </Box>
      )}

      {/* ---- Empty state ---- */}
      {filteredRows.length === 0 && searchQuery.trim() && (
        <Box className="text-center py-8">
          <Typography.Text type="secondary">
            No shortcuts match &ldquo;{searchQuery}&rdquo;
          </Typography.Text>
        </Box>
      )}

      {/* ---- Override summary ---- */}
      {hasOverrides && (
        <Box className="pt-3 mt-2" style={{ borderTop: '1px solid var(--ns-color-border)' }}>
          <Typography.Text type="secondary" style={{ fontSize: 11 }}>
            {Object.keys(overrides).length} shortcut
            {Object.keys(overrides).length !== 1 ? 's' : ''} customized. Changes are saved locally
            and persist across sessions.
          </Typography.Text>
        </Box>
      )}

      {/* ---- Confirm reset all modal ---- */}
      <Modal
        open={confirmResetAllOpen}
        onCancel={() => setConfirmResetAllOpen(false)}
        onOk={handleResetAll}
        title="Reset all shortcuts?"
        okText="Reset all"
        okButtonProps={{ danger: true }}
        centered
      >
        <Typography.Paragraph>
          This will restore all {Object.keys(overrides).length} customized shortcut
          {Object.keys(overrides).length !== 1 ? 's' : ''} to their default key combinations. This
          action cannot be undone.
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary">
          Tip: Export your keybindings first if you want to restore them later.
        </Typography.Paragraph>
      </Modal>
    </Box>
  );
}
