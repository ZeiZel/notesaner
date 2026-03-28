'use client';

/**
 * PluginsSettings — workspace plugin management tab.
 *
 * Reuses the existing installed plugin store and renders:
 *   - Installed plugins with enable/disable toggles
 *   - Per-plugin settings link
 *   - Install from URL form
 *   - Browse plugin registry link
 *
 * No useEffect for state management -- reads directly from the
 * installed plugin store.
 */

import { useActionState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  useInstalledPluginStore,
  selectInstalledPlugins,
  selectPluginOperation,
  type InstalledPluginMeta,
} from '@/features/plugins/plugin-store';

// ---------------------------------------------------------------------------
// Install action
// ---------------------------------------------------------------------------

interface InstallState {
  success: boolean;
  message: string;
}

async function installFromUrlAction(
  _prev: InstallState,
  formData: FormData,
): Promise<InstallState> {
  const url = (formData.get('releaseUrl') as string | null)?.trim() ?? '';
  if (!url) return { success: false, message: 'Please enter a GitHub release URL.' };
  if (!url.startsWith('https://github.com')) {
    return { success: false, message: 'Only GitHub release URLs are supported.' };
  }

  // TODO: connect to real plugin loader API
  return {
    success: false,
    message:
      'Plugin installation from settings is not yet connected to the runtime loader. Use the plugin browser for now.',
  };
}

// ---------------------------------------------------------------------------
// PluginRow
// ---------------------------------------------------------------------------

interface PluginRowProps {
  meta: InstalledPluginMeta;
  isEnabled: boolean;
  isPending: boolean;
  error?: string;
  onToggle: () => void;
}

function PluginRow({ meta, isEnabled, isPending, error, onToggle }: PluginRowProps) {
  const { manifest } = meta;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      {/* Plugin icon */}
      <div
        className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 text-base font-semibold border border-border bg-background"
        aria-hidden="true"
      >
        {manifest.name[0]?.toUpperCase() ?? 'P'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{manifest.name}</span>
          <span className="text-xs text-foreground-muted">v{manifest.version}</span>
        </div>
        <p className="text-xs mt-0.5 truncate text-foreground-secondary">
          {manifest.description ?? 'No description.'}
        </p>
        {error && <p className="text-xs mt-1 text-destructive">{error}</p>}
      </div>

      {/* Settings link */}
      <button
        type="button"
        className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground-secondary hover:bg-secondary transition-colors"
        title={`Settings for ${manifest.name}`}
      >
        Settings
      </button>

      {/* Toggle switch */}
      <button
        type="button"
        role="switch"
        aria-checked={isEnabled}
        aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${manifest.name}`}
        disabled={isPending}
        onClick={onToggle}
        className="relative inline-flex h-5 w-9 items-center rounded-full shrink-0 transition-colors disabled:opacity-50"
        style={{
          backgroundColor: isEnabled ? 'var(--ns-color-primary)' : 'var(--ns-color-background)',
          border: `1px solid ${isEnabled ? 'var(--ns-color-primary)' : 'var(--ns-color-border)'}`,
        }}
      >
        <span
          className="inline-block h-3.5 w-3.5 rounded-full transition-transform"
          style={{
            backgroundColor: isEnabled
              ? 'var(--ns-color-primary-foreground)'
              : 'var(--ns-color-foreground-muted)',
            transform: isEnabled ? 'translateX(18px)' : 'translateX(2px)',
          }}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PluginsSettings
// ---------------------------------------------------------------------------

export function PluginsSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';

  const installed = useInstalledPluginStore((s) => s.installed);
  const operations = useInstalledPluginStore((s) => s.operations);
  const enablePlugin = useInstalledPluginStore((s) => s.enablePlugin);
  const disablePlugin = useInstalledPluginStore((s) => s.disablePlugin);
  const isPluginEnabled = useInstalledPluginStore((s) => s.isPluginEnabled);

  const plugins = selectInstalledPlugins(installed);

  const [installState, installAction, isInstalling] = useActionState<InstallState, FormData>(
    installFromUrlAction,
    { success: false, message: '' },
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">Plugins</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Manage installed plugins and their settings for this workspace.
        </p>
      </div>

      {/* Installed plugins */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">
            Installed plugins
            {plugins.length > 0 && (
              <span className="ml-2 text-xs font-normal text-foreground-muted">
                ({plugins.length})
              </span>
            )}
          </h3>
          <Link
            href={`/workspaces/${workspaceId}/plugins`}
            className="text-xs text-primary hover:underline"
          >
            Browse registry
          </Link>
        </div>

        {plugins.length === 0 ? (
          <div className="rounded-lg border border-border py-8 text-center">
            <p className="text-sm text-foreground-muted">No plugins installed yet.</p>
            <Link
              href={`/workspaces/${workspaceId}/plugins`}
              className="mt-2 inline-block text-xs text-primary hover:underline"
            >
              Browse the plugin registry
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-background-surface px-4">
            {plugins.map((meta) => {
              const op = selectPluginOperation(operations, meta.pluginId);
              return (
                <PluginRow
                  key={meta.pluginId}
                  meta={meta}
                  isEnabled={workspaceId ? isPluginEnabled(meta.pluginId, workspaceId) : false}
                  isPending={op.status === 'pending'}
                  error={op.status === 'error' ? op.error : undefined}
                  onToggle={() => {
                    if (!workspaceId) return;
                    if (isPluginEnabled(meta.pluginId, workspaceId)) {
                      disablePlugin(meta.pluginId, workspaceId);
                    } else {
                      enablePlugin(meta.pluginId, workspaceId);
                    }
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Install from URL */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-1">Install from URL</h3>
        <p className="text-xs text-foreground-muted mb-3">
          Paste a GitHub release URL to install a plugin manually.
        </p>
        <form action={installAction} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="releaseUrl"
              type="url"
              placeholder="https://github.com/user/repo/releases/tag/v1.0.0"
              disabled={isInstalling}
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            />
            <button
              type="submit"
              disabled={isInstalling}
              className="px-4 py-2 text-sm rounded-md font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isInstalling ? 'Installing...' : 'Install'}
            </button>
          </div>
          {installState.message && (
            <p
              className="text-xs"
              style={{
                color: installState.success
                  ? 'var(--ns-color-success)'
                  : 'var(--ns-color-foreground-muted)',
              }}
            >
              {installState.message}
            </p>
          )}
        </form>
      </section>
    </div>
  );
}
