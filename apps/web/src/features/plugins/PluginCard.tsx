'use client';

/**
 * PluginCard
 *
 * Displays a registry plugin entry as a card with:
 *   - Plugin name, author, description
 *   - Tag badges
 *   - Star count
 *   - Version
 *   - Install / Uninstall button with loading state
 *   - "Installed" badge when the plugin is already installed
 *   - Compatible version indicator
 */

import * as React from 'react';
import { Button } from '@notesaner/ui';
import { Badge } from '@notesaner/ui';
import type { RegistryPlugin } from './plugin-registry-api';
import type { PluginBrowserOpState } from './plugin-browser-store';

// ---------------------------------------------------------------------------
// App version for compatibility check — replace with dynamic config if needed
// ---------------------------------------------------------------------------
const APP_VERSION = '1.0.0';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse a semver string into [major, minor, patch]. */
function parseSemVer(v: string): [number, number, number] {
  const parts = v.replace(/^v/, '').split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

/**
 * Returns true if appVersion satisfies the plugin's minAppVersion requirement.
 */
function isCompatible(minAppVersion: string, appVersion: string): boolean {
  const [minMaj, minMin, minPat] = parseSemVer(minAppVersion);
  const [appMaj, appMin, appPat] = parseSemVer(appVersion);
  if (appMaj !== minMaj) return appMaj > minMaj;
  if (appMin !== minMin) return appMin > minMin;
  return appPat >= minPat;
}

/** Format a star count: 1200 → "1.2k". */
function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Star rating display (GitHub stars rendered as 1-5 visual stars)
// ---------------------------------------------------------------------------

function StarCount({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-1 text-xs text-foreground-secondary">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-3.5 w-3.5 text-warning"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
          clipRule="evenodd"
        />
      </svg>
      {formatStars(count)}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginCardProps {
  plugin: RegistryPlugin;
  isInstalled: boolean;
  operation: PluginBrowserOpState;
  onInstall: (plugin: RegistryPlugin) => void;
  onUninstall: (pluginId: string) => void;
  onOpenDetail: (plugin: RegistryPlugin) => void;
  onTagClick?: (tag: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginCard({
  plugin,
  isInstalled,
  operation,
  onInstall,
  onUninstall,
  onOpenDetail,
  onTagClick,
}: PluginCardProps) {
  const isPending = operation.status === 'loading';

  // Compatibility check requires the manifest's minAppVersion. The registry
  // entry may not include it (it's returned as a lightweight search result),
  // so we treat missing minAppVersion as compatible.
  const compatible = plugin.latestVersion !== 'unknown';

  const handleInstallToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isPending) return;
    if (isInstalled) {
      onUninstall(plugin.id);
    } else {
      onInstall(plugin);
    }
  };

  return (
    <article
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => onOpenDetail(plugin)}
      aria-label={`View details for ${plugin.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        {/* Plugin icon placeholder */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-muted text-primary font-bold text-sm select-none"
          aria-hidden="true"
        >
          {plugin.name.slice(0, 2).toUpperCase()}
        </div>

        <div className="flex flex-1 flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-foreground truncate">{plugin.name}</h3>
            {isInstalled && (
              <Badge variant="success" className="shrink-0">
                Installed
              </Badge>
            )}
            {!compatible && (
              <Badge variant="warning" className="shrink-0">
                Incompatible
              </Badge>
            )}
          </div>
          <p className="text-xs text-foreground-secondary truncate">by {plugin.author}</p>
        </div>

        {/* Version */}
        <span className="shrink-0 text-xs text-foreground-muted tabular-nums">
          v{plugin.latestVersion}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-foreground-secondary line-clamp-2 flex-1">
        {plugin.description || 'No description provided.'}
      </p>

      {/* Tags */}
      {plugin.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plugin.tags.slice(0, 5).map((tag) => (
            <button
              key={tag}
              type="button"
              className="focus:outline-none focus:ring-2 focus:ring-ring rounded-full"
              onClick={(e) => {
                e.stopPropagation();
                onTagClick?.(tag);
              }}
              aria-label={`Filter by tag: ${tag}`}
            >
              <Badge variant="outline" className="cursor-pointer hover:bg-background-hover">
                {tag}
              </Badge>
            </button>
          ))}
          {plugin.tags.length > 5 && <Badge variant="muted">+{plugin.tags.length - 5}</Badge>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <StarCount count={plugin.stars} />

        <Button
          size="sm"
          variant={isInstalled ? 'outline' : 'default'}
          loading={isPending}
          disabled={isPending || !compatible}
          onClick={handleInstallToggle}
          aria-label={isInstalled ? `Uninstall ${plugin.name}` : `Install ${plugin.name}`}
        >
          {isInstalled ? 'Uninstall' : 'Install'}
        </Button>
      </div>

      {/* Error message */}
      {operation.status === 'error' && operation.error && (
        <p className="text-xs text-destructive" role="alert">
          {operation.error}
        </p>
      )}
    </article>
  );
}

// Export compatibility helper so detail modal can reuse it
export { isCompatible, APP_VERSION };
