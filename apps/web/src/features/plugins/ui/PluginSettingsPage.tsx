'use client';

/**
 * PluginSettingsPage.tsx
 *
 * Full-page settings UI for a single installed plugin. Migrated to Ant Design.
 */

import React, { useCallback, useState } from 'react';
import { Button, Flex, Typography, Divider } from 'antd';
import { useInstalledPluginStore, type InstalledPluginMeta } from '../model/plugin-store';
import { PluginSettingsRenderer } from './PluginSettingsRenderer';
import {
  schemaToFields,
  buildDefaultValues,
  validateSettings,
  errorsByKey,
  type FieldDescriptor,
} from '../lib/schema-to-form';

const { Text, Title, Paragraph } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PluginSettingsSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface PluginSettingsPageProps {
  plugin: InstalledPluginMeta;
  schema?: PluginSettingsSchema;
  onSaved?: (values: Record<string, unknown>) => void;
  onChange?: (key: string, value: unknown) => void;
  className?: string;
}

// ---------------------------------------------------------------------------
// Settings persistence via plugin-store
// ---------------------------------------------------------------------------

function usePluginSettings(pluginId: string) {
  const meta = useInstalledPluginStore((s) => s.installed[pluginId]);

  const savedSettings: Record<string, unknown> =
    (meta as (InstalledPluginMeta & { settings?: Record<string, unknown> }) | undefined)
      ?.settings ?? {};

  function saveSettings(values: Record<string, unknown>): void {
    useInstalledPluginStore.setState((state) => {
      const existing = state.installed[pluginId];
      if (!existing) return state;
      return {
        installed: {
          ...state.installed,
          [pluginId]: {
            ...existing,
            settings: values,
          },
        },
      };
    });
  }

  return { savedSettings, saveSettings };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginSettingsPage({
  plugin,
  schema,
  onSaved,
  onChange,
  className,
}: PluginSettingsPageProps) {
  const fields: FieldDescriptor[] = schema
    ? schemaToFields(schema as Parameters<typeof schemaToFields>[0])
    : [];
  const defaults = buildDefaultValues(fields);

  const { savedSettings, saveSettings } = usePluginSettings(plugin.pluginId);

  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaults,
    ...savedSettings,
  }));
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleChange = useCallback(
    (key: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      setErrors((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setSaveSuccess(false);
      onChange?.(key, value);
    },
    [onChange],
  );

  const handleSave = useCallback(async () => {
    const validationErrors = validateSettings(fields, values);
    if (validationErrors.length > 0) {
      setErrors(errorsByKey(validationErrors));
      return;
    }

    setIsSaving(true);
    setErrors(new Map());

    try {
      saveSettings(values);
      setSaveSuccess(true);
      onSaved?.(values);
    } catch (err) {
      console.error('[PluginSettingsPage] Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  }, [fields, values, saveSettings, onSaved]);

  const handleReset = useCallback(() => {
    setValues({ ...defaults });
    setErrors(new Map());
    setSaveSuccess(false);
  }, [defaults]);

  if (!schema) {
    return (
      <div className={className}>
        <PluginHeader plugin={plugin} />
        <Paragraph type="secondary" italic style={{ marginTop: 16 }}>
          This plugin does not provide a settings schema.
        </Paragraph>
      </div>
    );
  }

  const hasErrors = errors.size > 0;

  return (
    <div className={className}>
      <PluginHeader plugin={plugin} />

      <div style={{ marginTop: 24 }}>
        <PluginSettingsRenderer
          fields={fields}
          values={values}
          errors={errors}
          onChange={handleChange}
          disabled={isSaving}
        />
      </div>

      <Divider />

      {/* Action bar */}
      <Flex align="center" gap={12}>
        <Button
          type="primary"
          onClick={() => void handleSave()}
          loading={isSaving}
          disabled={isSaving}
          aria-label="Save plugin settings"
        >
          Save settings
        </Button>

        <Button onClick={handleReset} disabled={isSaving} aria-label="Reset settings to defaults">
          Reset to defaults
        </Button>

        {saveSuccess && !hasErrors && (
          <Text type="success" style={{ marginLeft: 'auto' }}>
            Settings saved.
          </Text>
        )}

        {hasErrors && (
          <Text type="danger" style={{ marginLeft: 'auto' }}>
            Please fix the errors above before saving.
          </Text>
        )}
      </Flex>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin header
// ---------------------------------------------------------------------------

interface PluginHeaderProps {
  plugin: InstalledPluginMeta;
}

function PluginHeader({ plugin }: PluginHeaderProps) {
  const { manifest } = plugin;
  return (
    <Flex vertical gap={4}>
      <Title level={4} style={{ margin: 0 }}>
        {manifest.name}
      </Title>
      <Text type="secondary" style={{ fontSize: 12 }}>
        v{manifest.version} · by {manifest.author}
      </Text>
      {manifest.description && (
        <Text type="secondary" style={{ fontSize: 14 }}>
          {manifest.description}
        </Text>
      )}
    </Flex>
  );
}
