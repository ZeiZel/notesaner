'use client';

/**
 * PluginDetailModal
 *
 * Full-screen detail view for a single registry plugin.
 *
 * Displays:
 *   - Plugin name, author, version
 *   - Installed / compatible badges
 *   - Full description (README)
 *   - Screenshots carousel (when available)
 *   - Changelog section
 *   - Version & compatibility information
 *   - Install / Uninstall button
 */

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@notesaner/ui';
import { Button } from '@notesaner/ui';
import { Badge } from '@notesaner/ui';
import { Skeleton } from '@notesaner/ui';
import type { RegistryPlugin } from './plugin-registry-api';
import type { PluginBrowserOpState } from './plugin-browser-store';
import { APP_VERSION, isCompatible } from './PluginCard';

// ---------------------------------------------------------------------------
// Screenshots carousel
// ---------------------------------------------------------------------------

function ScreenshotsCarousel({ screenshots }: { screenshots: string[] }) {
  const [current, setCurrent] = React.useState(0);

  if (screenshots.length === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + screenshots.length) % screenshots.length);
  const next = () => setCurrent((c) => (c + 1) % screenshots.length);

  return (
    <section
      aria-label="Plugin screenshots"
      className="relative overflow-hidden rounded-lg border border-border"
    >
      <img
        src={screenshots[current]}
        alt={`Screenshot ${current + 1} of ${screenshots.length}`}
        className="w-full object-cover max-h-72"
        loading="lazy"
      />

      {screenshots.length > 1 && (
        <>
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Previous screenshot"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>

          <button
            type="button"
            onClick={next}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white"
            aria-label="Next screenshot"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>

          {/* Dots */}
          <div
            className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5"
            role="tablist"
            aria-label="Screenshot navigation"
          >
            {screenshots.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === current}
                aria-label={`Screenshot ${i + 1}`}
                onClick={() => setCurrent(i)}
                className={`h-1.5 w-1.5 rounded-full transition-all ${
                  i === current ? 'bg-white w-4' : 'bg-white/50'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton for detail content
// ---------------------------------------------------------------------------

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 pt-2">
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Changelog section
// ---------------------------------------------------------------------------

function ChangelogSection({ changelog }: { changelog: string }) {
  const [expanded, setExpanded] = React.useState(false);
  const lines = changelog.trim().split('\n');
  const preview = lines.slice(0, 10).join('\n');
  const hasMore = lines.length > 10;

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground mb-2">Changelog</h3>
      <pre
        className={`whitespace-pre-wrap text-xs text-foreground-secondary font-mono bg-muted rounded-lg p-3 overflow-auto ${!expanded ? 'max-h-40' : ''}`}
      >
        {expanded ? changelog : preview}
        {!expanded && hasMore && '...'}
      </pre>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs text-primary hover:underline focus:outline-none focus:ring-2 focus:ring-ring rounded"
        >
          {expanded ? 'Show less' : 'Show full changelog'}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PluginDetailModalProps {
  plugin: RegistryPlugin | null;
  open: boolean;
  detailStatus: 'idle' | 'loading' | 'success' | 'error';
  detailError: string | null;
  isInstalled: boolean;
  operation: PluginBrowserOpState;
  onClose: () => void;
  onInstall: (plugin: RegistryPlugin) => void;
  onUninstall: (pluginId: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PluginDetailModal({
  plugin,
  open,
  detailStatus,
  detailError,
  isInstalled,
  operation,
  onClose,
  onInstall,
  onUninstall,
}: PluginDetailModalProps) {
  const isPending = operation.status === 'loading';
  const compatible = plugin ? isCompatible(plugin.latestVersion, APP_VERSION) : false;

  const handleInstallToggle = () => {
    if (!plugin || isPending) return;
    if (isInstalled) {
      onUninstall(plugin.id);
    } else {
      onInstall(plugin);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        aria-describedby="plugin-detail-description"
      >
        {plugin && (
          <>
            <DialogHeader>
              <div className="flex items-start gap-4">
                {/* Icon */}
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-muted text-primary font-bold text-base select-none"
                  aria-hidden="true"
                >
                  {plugin.name.slice(0, 2).toUpperCase()}
                </div>

                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base font-semibold flex items-center gap-2 flex-wrap">
                    {plugin.name}
                    {isInstalled && <Badge variant="success">Installed</Badge>}
                    {!compatible && <Badge variant="warning">Incompatible</Badge>}
                  </DialogTitle>
                  <DialogDescription id="plugin-detail-description" className="mt-0.5">
                    by {plugin.author} &middot; v{plugin.latestVersion}
                  </DialogDescription>
                </div>

                {/* Install / Uninstall */}
                <Button
                  size="sm"
                  variant={isInstalled ? 'outline' : 'default'}
                  loading={isPending}
                  disabled={isPending || !compatible}
                  onClick={handleInstallToggle}
                  className="shrink-0"
                  aria-label={isInstalled ? `Uninstall ${plugin.name}` : `Install ${plugin.name}`}
                >
                  {isInstalled ? 'Uninstall' : 'Install'}
                </Button>
              </div>
            </DialogHeader>

            {/* Operation error */}
            {operation.status === 'error' && operation.error && (
              <p
                className="text-sm text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3"
                role="alert"
              >
                {operation.error}
              </p>
            )}

            {/* Metadata row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-foreground-secondary">
              <span>
                <span className="font-medium text-foreground">Repository:</span>{' '}
                <a
                  href={plugin.repository}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {plugin.repository.replace('https://github.com/', '')}
                </a>
              </span>
              <span>
                <span className="font-medium text-foreground">Updated:</span>{' '}
                {new Date(plugin.updatedAt).toLocaleDateString()}
              </span>
              <span>
                <span className="font-medium text-foreground">Stars:</span>{' '}
                {plugin.stars.toLocaleString()}
              </span>
            </div>

            {/* Tags */}
            {plugin.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {plugin.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {/* Content area */}
            {detailStatus === 'loading' && <DetailSkeleton />}

            {detailStatus === 'error' && detailError && (
              <p
                className="text-sm text-destructive-foreground bg-destructive/10 rounded-lg p-3"
                role="alert"
              >
                Failed to load full details: {detailError}
              </p>
            )}

            {(detailStatus === 'success' || detailStatus === 'idle') && (
              <div className="flex flex-col gap-5 pt-1">
                {/* Screenshots */}
                {plugin.screenshots && plugin.screenshots.length > 0 && (
                  <ScreenshotsCarousel screenshots={plugin.screenshots} />
                )}

                {/* README / description */}
                {plugin.readme ? (
                  <section>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground-secondary">
                      {/* Render pre-formatted text; in production swap for a markdown renderer */}
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                        {plugin.readme}
                      </pre>
                    </div>
                  </section>
                ) : (
                  <section>
                    <h3 className="text-sm font-semibold text-foreground mb-2">Description</h3>
                    <p className="text-sm text-foreground-secondary">
                      {plugin.description || 'No description provided.'}
                    </p>
                  </section>
                )}

                {/* Changelog */}
                {plugin.changelog && <ChangelogSection changelog={plugin.changelog} />}

                {/* Version & compatibility */}
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2">Version Info</h3>
                  <dl className="grid grid-cols-2 gap-y-1 text-sm">
                    <dt className="text-foreground-secondary">Latest version</dt>
                    <dd className="font-medium text-foreground">{plugin.latestVersion}</dd>
                    <dt className="text-foreground-secondary">Compatibility</dt>
                    <dd>
                      {compatible ? (
                        <span className="text-success font-medium">
                          Compatible with your version
                        </span>
                      ) : (
                        <span className="text-warning font-medium">
                          Requires a newer app version
                        </span>
                      )}
                    </dd>
                  </dl>
                </section>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
