'use client';

/**
 * PluginSettings — installed plugin list with per-plugin enable/disable toggle
 * and install-from-URL form.
 *
 * Consumes useInstalledPluginStore from features/plugins/plugin-store.ts.
 * Workspace ID comes from the nearest useParams — it is required to
 * check/change enabled state per workspace.
 */

import { useActionState } from 'react';
import { useParams } from 'next/navigation';
import {
  useInstalledPluginStore,
  selectInstalledPlugins,
  selectPluginOperation,
  type InstalledPluginMeta,
} from '@/features/plugins/plugin-store';

// ---------------------------------------------------------------------------
// Install action (install-from-URL — no loader available in settings context)
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
  // In a full implementation this would call loader.installPlugin().
  // Here we return a hint — the real install flow is triggered from PluginHost.
  return {
    success: false,
    message:
      'Plugin install from settings is not yet connected to the runtime loader. Open the workspace to install plugins via the command palette.',
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
    <div
      className="flex items-start gap-3 py-3 border-b last:border-0"
      style={{ borderColor: 'var(--ns-color-border)' }}
    >
      {/* Plugin icon placeholder */}
      <div
        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-base"
        style={{
          backgroundColor: 'var(--ns-color-background)',
          border: '1px solid var(--ns-color-border)',
        }}
        aria-hidden="true"
      >
        {manifest.name[0]?.toUpperCase() ?? 'P'}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
            {manifest.name}
          </span>
          <span className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            v{manifest.version}
          </span>
        </div>
        <p
          className="text-xs mt-0.5 truncate"
          style={{ color: 'var(--ns-color-foreground-secondary)' }}
        >
          {manifest.description ?? 'No description.'}
        </p>
        {error && (
          <p className="text-xs mt-1" style={{ color: 'var(--ns-color-destructive)' }}>
            {error}
          </p>
        )}
      </div>

      {/* Toggle */}
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
// PluginSettings
// ---------------------------------------------------------------------------

export function PluginSettings() {
  const params = useParams<{ workspaceId?: string }>();
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
    <div className="space-y-6 max-w-2xl">
      {/* Installed plugins */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ns-color-foreground)' }}>
          Installed plugins
          {plugins.length > 0 && (
            <span
              className="ml-2 text-xs font-normal"
              style={{ color: 'var(--ns-color-foreground-muted)' }}
            >
              ({plugins.length})
            </span>
          )}
        </h3>

        {plugins.length === 0 ? (
          <div
            className="rounded-lg border py-8 text-center"
            style={{ borderColor: 'var(--ns-color-border)' }}
          >
            <p className="text-sm" style={{ color: 'var(--ns-color-foreground-muted)' }}>
              No plugins installed yet.
            </p>
          </div>
        ) : (
          <div
            className="rounded-lg border px-3"
            style={{
              borderColor: 'var(--ns-color-border)',
              backgroundColor: 'var(--ns-color-background-surface)',
            }}
          >
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
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ns-color-foreground)' }}>
          Install plugin
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Paste a GitHub release URL (e.g.{' '}
          <code style={{ color: 'var(--ns-color-primary)' }}>
            https://github.com/user/repo/releases/tag/v1.0.0
          </code>
          )
        </p>
        <form action={installAction} className="flex flex-col gap-2">
          <div className="flex gap-2">
            <input
              name="releaseUrl"
              type="url"
              placeholder="https://github.com/…"
              disabled={isInstalling}
              className="flex-1 rounded-md px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--ns-color-background-input)',
                border: '1px solid var(--ns-color-input)',
                color: 'var(--ns-color-foreground)',
              }}
            />
            <button
              type="submit"
              disabled={isInstalling}
              className="px-3 py-2 text-sm rounded-md disabled:opacity-50"
              style={{
                backgroundColor: 'var(--ns-color-primary)',
                color: 'var(--ns-color-primary-foreground)',
              }}
            >
              {isInstalling ? 'Installing…' : 'Install'}
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
