'use client';

/**
 * AppearanceSettings — workspace-level theme, CSS snippets, and sidebar defaults.
 *
 * Uses the workspace settings store for read/write. Appearance changes
 * are debounced (500ms) to auto-save without excessive API calls.
 *
 * Note: useEffect is used here for the debounce timer -- a valid use case
 * since it is a side effect (network request) not derivable during render.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from './workspace-settings-store';
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
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Default theme, CSS customization, and sidebar layout for this workspace. Changes
          auto-save.
        </p>
      </div>

      {/* Default theme */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3">Default theme</h3>
        <p className="text-xs text-foreground-muted mb-4">
          This sets the default theme for all workspace members. Individual users can override this
          in their personal settings.
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {THEME_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleThemeChange(option.value)}
              className={[
                'flex flex-col items-start rounded-lg border p-3 text-left transition-colors',
                selectedTheme === option.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border hover:bg-secondary',
              ].join(' ')}
            >
              <span className="text-sm font-medium text-foreground">{option.label}</span>
              <span className="text-xs text-foreground-muted">{option.description}</span>
            </button>
          ))}
        </div>
      </section>

      {/* CSS snippets */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-foreground">CSS snippets</h3>
            <p className="text-xs text-foreground-muted mt-0.5">
              Custom CSS applied to all members of this workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddSnippet}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-secondary transition-colors"
          >
            Add snippet
          </button>
        </div>

        {snippets.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <p className="text-sm text-foreground-muted">No CSS snippets defined.</p>
            <button
              type="button"
              onClick={handleAddSnippet}
              className="mt-2 text-xs text-primary hover:underline"
            >
              Add your first snippet
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {snippets.map((snippet) => (
              <div
                key={snippet.id}
                className="rounded-lg border border-border bg-background-surface p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  {/* Enable toggle */}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={snippet.enabled}
                    aria-label={`${snippet.enabled ? 'Disable' : 'Enable'} ${snippet.name}`}
                    onClick={() =>
                      handleUpdateSnippet(snippet.id, {
                        enabled: !snippet.enabled,
                      })
                    }
                    className="relative inline-flex h-4 w-7 items-center rounded-full shrink-0 transition-colors"
                    style={{
                      backgroundColor: snippet.enabled
                        ? 'var(--ns-color-primary)'
                        : 'var(--ns-color-background)',
                      border: `1px solid ${snippet.enabled ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
                    }}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full transition-transform"
                      style={{
                        backgroundColor: snippet.enabled
                          ? 'var(--ns-color-primary-foreground)'
                          : 'var(--ns-color-foreground-muted)',
                        transform: snippet.enabled ? 'translateX(14px)' : 'translateX(2px)',
                      }}
                    />
                  </button>

                  {/* Name input */}
                  <input
                    aria-label="Snippet name"
                    type="text"
                    value={snippet.name}
                    onChange={(e) => handleUpdateSnippet(snippet.id, { name: e.target.value })}
                    className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  {/* Remove button */}
                  <button
                    type="button"
                    onClick={() => handleRemoveSnippet(snippet.id)}
                    title="Remove snippet"
                    className="shrink-0 rounded-md p-1 text-foreground-muted hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
                      <path
                        fillRule="evenodd"
                        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
                      />
                    </svg>
                  </button>
                </div>

                {/* CSS editor */}
                <textarea
                  aria-label={`CSS for ${snippet.name}`}
                  value={snippet.css}
                  onChange={(e) => handleUpdateSnippet(snippet.id, { css: e.target.value })}
                  rows={4}
                  placeholder="/* Custom CSS */"
                  className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sidebar defaults */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1">Sidebar defaults</h3>
        <p className="text-xs text-foreground-muted mb-4">
          Default sidebar configuration for new members and fresh sessions.
        </p>

        <div className="space-y-4 max-w-md">
          {/* Left sidebar open */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Left sidebar open by default</label>
            <button
              type="button"
              role="switch"
              aria-checked={sidebarDefaults.leftSidebarOpen}
              aria-label="Toggle left sidebar default"
              onClick={() =>
                handleSidebarDefaultChange({
                  leftSidebarOpen: !sidebarDefaults.leftSidebarOpen,
                })
              }
              className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors"
              style={{
                backgroundColor: sidebarDefaults.leftSidebarOpen
                  ? 'var(--ns-color-primary)'
                  : 'var(--ns-color-background)',
                border: `1px solid ${sidebarDefaults.leftSidebarOpen ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                style={{
                  backgroundColor: sidebarDefaults.leftSidebarOpen
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-muted)',
                  transform: sidebarDefaults.leftSidebarOpen
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Right sidebar open */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-foreground">Right sidebar open by default</label>
            <button
              type="button"
              role="switch"
              aria-checked={sidebarDefaults.rightSidebarOpen}
              aria-label="Toggle right sidebar default"
              onClick={() =>
                handleSidebarDefaultChange({
                  rightSidebarOpen: !sidebarDefaults.rightSidebarOpen,
                })
              }
              className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors"
              style={{
                backgroundColor: sidebarDefaults.rightSidebarOpen
                  ? 'var(--ns-color-primary)'
                  : 'var(--ns-color-background)',
                border: `1px solid ${sidebarDefaults.rightSidebarOpen ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
              }}
            >
              <span
                className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
                style={{
                  backgroundColor: sidebarDefaults.rightSidebarOpen
                    ? 'var(--ns-color-primary-foreground)'
                    : 'var(--ns-color-foreground-muted)',
                  transform: sidebarDefaults.rightSidebarOpen
                    ? 'translateX(18px)'
                    : 'translateX(2px)',
                }}
              />
            </button>
          </div>

          {/* Left sidebar width */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground">
              Left sidebar width ({sidebarDefaults.leftSidebarWidth}px)
            </label>
            <input
              type="range"
              min={180}
              max={400}
              step={10}
              value={sidebarDefaults.leftSidebarWidth}
              onChange={(e) =>
                handleSidebarDefaultChange({
                  leftSidebarWidth: Number(e.target.value),
                })
              }
              className="w-full accent-primary"
            />
          </div>

          {/* Right sidebar width */}
          <div className="space-y-1.5">
            <label className="text-sm text-foreground">
              Right sidebar width ({sidebarDefaults.rightSidebarWidth}px)
            </label>
            <input
              type="range"
              min={200}
              max={400}
              step={10}
              value={sidebarDefaults.rightSidebarWidth}
              onChange={(e) =>
                handleSidebarDefaultChange({
                  rightSidebarWidth: Number(e.target.value),
                })
              }
              className="w-full accent-primary"
            />
          </div>
        </div>
      </section>

      {/* Save indicator */}
      {isSaving && (
        <p className="text-xs text-foreground-muted" role="status">
          Auto-saving...
        </p>
      )}
    </div>
  );
}
