'use client';

/**
 * PluginSettingsPage.tsx
 *
 * Full-page settings UI for a single installed plugin.
 *
 * Responsibilities:
 *   - Load the plugin's JSON Schema from the manifest's `settings` path
 *     (or accept it as a prop for testing / pre-loaded scenarios)
 *   - Display auto-generated form controls via PluginSettingsRenderer
 *   - Persist settings to the InstalledPlugin.settings JSON via the
 *     plugin-store on Save
 *   - Validate against the schema before save
 *   - Provide a "Reset to defaults" button
 *   - Fire onChange callbacks when settings change
 *
 * Settings are stored as a flat JSON object under InstalledPluginMeta.
 * The key/value structure mirrors the dot-path keys from FieldDescriptor.
 */

import React, { useCallback, useState } from 'react';
import { Button } from '@notesaner/ui/components/button';
import { useInstalledPluginStore } from './plugin-store';
import { PluginSettingsRenderer } from './PluginSettingsRenderer';
import {
  schemaToFields,
  buildDefaultValues,
  validateSettings,
  errorsByKey,
  type FieldDescriptor,
} from './schema-to-form';
import type { InstalledPluginMeta } from './plugin-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal JSON Schema shape accepted by this page. */
export interface PluginSettingsSchema {
  type?: string;
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

export interface PluginSettingsPageProps {
  /** The installed plugin metadata record. */
  plugin: InstalledPluginMeta;
  /**
   * The parsed JSON Schema for the plugin's settings.
   * When omitted, the page renders an empty-state message.
   */
  schema?: PluginSettingsSchema;
  /**
   * Called after settings are successfully saved.
   * Receives the saved values.
   */
  onSaved?: (values: Record<string, unknown>) => void;
  /**
   * Called every time a field value changes (before save).
   * Useful for live previews.
   */
  onChange?: (key: string, value: unknown) => void;
  /** Extra CSS class for the container. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Settings persistence via plugin-store
// ---------------------------------------------------------------------------

/**
 * Extend the Zustand store with settings per-plugin.
 * We store settings inside the installed map using a dedicated action.
 *
 * Rather than mutating the store here directly we use a thin wrapper that
 * reads/writes the `settings` property on InstalledPluginMeta.
 */
function usePluginSettings(pluginId: string) {
  const meta = useInstalledPluginStore((s) => s.installed[pluginId]);

  const savedSettings: Record<string, unknown> =
    (meta as (InstalledPluginMeta & { settings?: Record<string, unknown> }) | undefined)
      ?.settings ?? {};

  function saveSettings(values: Record<string, unknown>): void {
    // We write directly to the store state — settings are persisted via
    // the Zustand persist middleware alongside other installed metadata.
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

/**
 * Full settings page for a single plugin.
 *
 * @example
 * ```tsx
 * <PluginSettingsPage
 *   plugin={meta}
 *   schema={parsedSchema}
 *   onSaved={(values) => console.log('Saved:', values)}
 * />
 * ```
 */
export function PluginSettingsPage({
  plugin,
  schema,
  onSaved,
  onChange,
  className,
}: PluginSettingsPageProps) {
  // --- Derive field descriptors from schema ---
  const fields: FieldDescriptor[] = schema
    ? schemaToFields(schema as Parameters<typeof schemaToFields>[0])
    : [];
  const defaults = buildDefaultValues(fields);

  // --- Initialise values from saved settings or defaults ---
  const { savedSettings, saveSettings } = usePluginSettings(plugin.pluginId);

  const [values, setValues] = useState<Record<string, unknown>>(() => ({
    ...defaults,
    ...savedSettings,
  }));
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // --- Field change handler ---
  const handleChange = useCallback(
    (key: string, value: unknown) => {
      setValues((prev) => ({ ...prev, [key]: value }));
      // Clear the error for this field on change
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

  // --- Save ---
  const handleSave = useCallback(async () => {
    const validationErrors = validateSettings(fields, values);
    if (validationErrors.length > 0) {
      setErrors(errorsByKey(validationErrors));
      return;
    }

    setIsSaving(true);
    setErrors(new Map());

    try {
      // Persist via store (synchronous in Zustand but wrapped in try/catch
      // in case downstream logic throws)
      saveSettings(values);
      setSaveSuccess(true);
      onSaved?.(values);
    } catch (err) {
      console.error('[PluginSettingsPage] Failed to save settings:', err);
    } finally {
      setIsSaving(false);
    }
  }, [fields, values, saveSettings, onSaved]);

  // --- Reset to defaults ---
  const handleReset = useCallback(() => {
    setValues({ ...defaults });
    setErrors(new Map());
    setSaveSuccess(false);
  }, [defaults]);

  // --- No schema provided ---
  if (!schema) {
    return (
      <div className={className}>
        <PluginHeader plugin={plugin} />
        <p className="text-sm text-foreground-muted italic mt-4">
          This plugin does not provide a settings schema.
        </p>
      </div>
    );
  }

  const hasErrors = errors.size > 0;

  return (
    <div className={className}>
      <PluginHeader plugin={plugin} />

      <div className="mt-6">
        <PluginSettingsRenderer
          fields={fields}
          values={values}
          errors={errors}
          onChange={handleChange}
          disabled={isSaving}
        />
      </div>

      {/* Action bar */}
      <div className="mt-8 flex items-center gap-3 pt-4 border-t border-border">
        <Button
          onClick={handleSave}
          loading={isSaving}
          disabled={isSaving}
          aria-label="Save plugin settings"
        >
          Save settings
        </Button>

        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving}
          aria-label="Reset settings to defaults"
        >
          Reset to defaults
        </Button>

        {saveSuccess && !hasErrors && (
          <span className="text-sm text-success ml-auto" role="status">
            Settings saved.
          </span>
        )}

        {hasErrors && (
          <span className="text-sm text-destructive ml-auto" role="alert">
            Please fix the errors above before saving.
          </span>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin header — name, version, description
// ---------------------------------------------------------------------------

interface PluginHeaderProps {
  plugin: InstalledPluginMeta;
}

function PluginHeader({ plugin }: PluginHeaderProps) {
  const { manifest } = plugin;
  return (
    <div className="space-y-1">
      <h2 className="text-lg font-semibold text-foreground">{manifest.name}</h2>
      <p className="text-xs text-foreground-muted">
        v{manifest.version} &middot; by {manifest.author}
      </p>
      {manifest.description && (
        <p className="text-sm text-foreground-muted">{manifest.description}</p>
      )}
    </div>
  );
}
