'use client';

/**
 * DailyNotesSettings — Settings panel component for the Daily Notes plugin.
 *
 * Allows the user to configure:
 *   - Auto-create daily note on startup
 *   - Daily note filename format
 *   - Daily note folder
 *   - Template note (ID or path)
 *   - Weekly periodic notes (toggle, format, folder)
 *   - Monthly periodic notes (toggle, format, folder)
 *
 * Settings are persisted via the plugin storage API whenever the user
 * changes a field. A preview of the generated note name updates live.
 */

import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { PluginContext } from '@notesaner/plugin-sdk';
import { useDailyNotesStore, type DailyNotesSettings } from './daily-notes-store';
import { validateDailyFormat } from './note-name-generator';
import { generateDailyNoteName } from './note-name-generator';
import { generateWeeklyNoteName, generateMonthlyNoteName } from './note-name-generator';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DailyNotesSettingsProps {
  ctx: PluginContext;
  className?: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface SettingRowProps {
  label: string;
  description?: string;
  htmlFor?: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, htmlFor, children }: SettingRowProps) {
  return (
    <div className="flex flex-col gap-1.5 py-3 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
            {label}
          </label>
          {description && <p className="mt-0.5 text-xs text-foreground-muted">{description}</p>}
        </div>
        <div className="shrink-0">{children}</div>
      </div>
    </div>
  );
}

interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ id, checked, onChange, disabled = false }: ToggleProps) {
  return (
    <button
      id={id}
      role="switch"
      aria-checked={checked}
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent',
        'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-input',
      ].join(' ')}
    >
      <span
        aria-hidden
        className={[
          'pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm',
          'transition-transform',
          checked ? 'translate-x-4' : 'translate-x-0',
        ].join(' ')}
      />
    </button>
  );
}

interface TextInputProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string | null;
}

function TextInput({ id, value, onChange, placeholder, error }: TextInputProps) {
  return (
    <div className="w-full">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={[
          'block w-full rounded-md border px-3 py-1.5 text-sm',
          'bg-input text-foreground placeholder:text-foreground-disabled',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring',
          error ? 'border-error' : 'border-border',
        ].join(' ')}
      />
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
}

function SectionHeader({ title }: SectionHeaderProps) {
  return (
    <div className="border-b border-border pb-1 pt-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        {title}
      </h3>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Preview badge
// ---------------------------------------------------------------------------

function NoteNamePreview({ path }: { path: string }) {
  return (
    <div className="mt-1 flex items-center gap-1">
      <span className="text-[10px] text-foreground-muted">Preview:</span>
      <code className="rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-foreground">
        {path}
      </code>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main settings component
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'settings';

export function DailyNotesSettings({ ctx, className }: DailyNotesSettingsProps) {
  const { settings, updateSettings } = useDailyNotesStore();

  // Local form state (mirrors store; saved on blur / toggle)
  const [localSettings, setLocalSettings] = useState<DailyNotesSettings>(() => ({
    ...settings,
  }));

  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [formatError, setFormatError] = useState<string | null>(null);

  const idPrefix = useId();
  const id = (name: string) => `${idPrefix}-${name}`;

  // Load persisted settings on mount
  useEffect(() => {
    async function loadSettings(): Promise<void> {
      try {
        const stored = await ctx.storage.get<DailyNotesSettings>(STORAGE_KEY);
        if (stored) {
          setLocalSettings((prev) => ({ ...prev, ...stored }));
          updateSettings(stored);
        }
      } catch {
        // Non-fatal: use defaults
      }
    }
    void loadSettings();
  }, [ctx, updateSettings]);

  // Persist whenever local settings change
  const persist = useCallback(
    async (next: DailyNotesSettings) => {
      setSaveStatus('saving');
      try {
        await ctx.storage.set(STORAGE_KEY, next);
        updateSettings(next);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 1500);
      } catch {
        setSaveStatus('error');
      }
    },
    [ctx, updateSettings],
  );

  const handleChange = useCallback(
    <K extends keyof DailyNotesSettings>(key: K, value: DailyNotesSettings[K]) => {
      setLocalSettings((prev) => {
        const next = { ...prev, [key]: value };

        // Validate format strings immediately
        if (key === 'nameFormat') {
          setFormatError(validateDailyFormat(value as string));
        }

        void persist(next);
        return next;
      });
    },
    [persist],
  );

  // Live previews
  const now = useMemo(() => new Date(), []);

  const dailyPreview = useMemo(() => {
    if (formatError) return null;
    try {
      return generateDailyNoteName(now, localSettings.nameFormat, localSettings.folder);
    } catch {
      return null;
    }
  }, [now, localSettings.nameFormat, localSettings.folder, formatError]);

  const weeklyPreview = useMemo(() => {
    if (!localSettings.weeklyEnabled) return null;
    try {
      return generateWeeklyNoteName(
        now,
        localSettings.weeklyFormat,
        localSettings.weeklyFolder || localSettings.folder,
      );
    } catch {
      return null;
    }
  }, [now, localSettings]);

  const monthlyPreview = useMemo(() => {
    if (!localSettings.monthlyEnabled) return null;
    try {
      return generateMonthlyNoteName(
        now,
        localSettings.monthlyFormat,
        localSettings.monthlyFolder || localSettings.folder,
      );
    } catch {
      return null;
    }
  }, [now, localSettings]);

  return (
    <div
      className={['space-y-0 divide-y divide-border', className ?? ''].filter(Boolean).join(' ')}
      aria-label="Daily notes settings"
    >
      {/* Save status */}
      {saveStatus !== 'idle' && (
        <div
          role="status"
          aria-live="polite"
          className={[
            'rounded-md px-3 py-1.5 text-xs',
            saveStatus === 'saved' && 'bg-success/10 text-success-foreground',
            saveStatus === 'saving' && 'bg-surface-elevated text-foreground-muted',
            saveStatus === 'error' && 'bg-error/10 text-error',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved' && 'Settings saved'}
          {saveStatus === 'error' && 'Failed to save settings'}
        </div>
      )}

      {/* --- General --- */}
      <SectionHeader title="General" />

      <SettingRow
        htmlFor={id('autoCreate')}
        label="Auto-create daily note on startup"
        description="Automatically open or create today's note when you open the workspace."
      >
        <Toggle
          id={id('autoCreate')}
          checked={localSettings.autoCreate}
          onChange={(v) => handleChange('autoCreate', v)}
        />
      </SettingRow>

      {/* --- Daily Notes --- */}
      <SectionHeader title="Daily Notes" />

      <SettingRow
        htmlFor={id('nameFormat')}
        label="Filename format"
        description="Tokens: YYYY, YY, MM, DD, ddd, dddd"
      >
        <div className="w-48">
          <TextInput
            id={id('nameFormat')}
            value={localSettings.nameFormat}
            onChange={(v) => handleChange('nameFormat', v)}
            placeholder="YYYY-MM-DD"
            error={formatError}
          />
          {dailyPreview && <NoteNamePreview path={dailyPreview.path} />}
        </div>
      </SettingRow>

      <SettingRow
        htmlFor={id('folder')}
        label="Folder"
        description="Folder for new daily notes. Leave empty for workspace root."
      >
        <div className="w-48">
          <TextInput
            id={id('folder')}
            value={localSettings.folder}
            onChange={(v) => handleChange('folder', v)}
            placeholder="Daily Notes"
          />
        </div>
      </SettingRow>

      <SettingRow
        htmlFor={id('templateId')}
        label="Template note path"
        description="Path to a note to use as a template for new daily notes."
      >
        <div className="w-48">
          <TextInput
            id={id('templateId')}
            value={localSettings.templateId ?? ''}
            onChange={(v) => handleChange('templateId', v || undefined)}
            placeholder="Templates/Daily"
          />
        </div>
      </SettingRow>

      {/* --- Weekly Notes --- */}
      <SectionHeader title="Weekly Notes" />

      <SettingRow
        htmlFor={id('weeklyEnabled')}
        label="Enable weekly notes"
        description="Create a note for each ISO calendar week."
      >
        <Toggle
          id={id('weeklyEnabled')}
          checked={localSettings.weeklyEnabled}
          onChange={(v) => handleChange('weeklyEnabled', v)}
        />
      </SettingRow>

      {localSettings.weeklyEnabled && (
        <>
          <SettingRow
            htmlFor={id('weeklyFormat')}
            label="Weekly filename format"
            description="Default: YYYY-[W]ww  →  2026-W12"
          >
            <div className="w-48">
              <TextInput
                id={id('weeklyFormat')}
                value={localSettings.weeklyFormat}
                onChange={(v) => handleChange('weeklyFormat', v)}
                placeholder="YYYY-[W]ww"
              />
              {weeklyPreview && <NoteNamePreview path={weeklyPreview.path} />}
            </div>
          </SettingRow>

          <SettingRow
            htmlFor={id('weeklyFolder')}
            label="Weekly notes folder"
            description="Falls back to the daily notes folder when empty."
          >
            <div className="w-48">
              <TextInput
                id={id('weeklyFolder')}
                value={localSettings.weeklyFolder}
                onChange={(v) => handleChange('weeklyFolder', v)}
                placeholder={localSettings.folder || 'Daily Notes'}
              />
            </div>
          </SettingRow>
        </>
      )}

      {/* --- Monthly Notes --- */}
      <SectionHeader title="Monthly Notes" />

      <SettingRow
        htmlFor={id('monthlyEnabled')}
        label="Enable monthly notes"
        description="Create a note for each calendar month."
      >
        <Toggle
          id={id('monthlyEnabled')}
          checked={localSettings.monthlyEnabled}
          onChange={(v) => handleChange('monthlyEnabled', v)}
        />
      </SettingRow>

      {localSettings.monthlyEnabled && (
        <>
          <SettingRow
            htmlFor={id('monthlyFormat')}
            label="Monthly filename format"
            description="Default: YYYY-MM  →  2026-03"
          >
            <div className="w-48">
              <TextInput
                id={id('monthlyFormat')}
                value={localSettings.monthlyFormat}
                onChange={(v) => handleChange('monthlyFormat', v)}
                placeholder="YYYY-MM"
              />
              {monthlyPreview && <NoteNamePreview path={monthlyPreview.path} />}
            </div>
          </SettingRow>

          <SettingRow
            htmlFor={id('monthlyFolder')}
            label="Monthly notes folder"
            description="Falls back to the daily notes folder when empty."
          >
            <div className="w-48">
              <TextInput
                id={id('monthlyFolder')}
                value={localSettings.monthlyFolder}
                onChange={(v) => handleChange('monthlyFolder', v)}
                placeholder={localSettings.folder || 'Daily Notes'}
              />
            </div>
          </SettingRow>
        </>
      )}
    </div>
  );
}
