/**
 * Loading skeletons used as fallbacks for lazily-loaded components.
 *
 * Each skeleton mirrors the layout of the real component so the user sees
 * a stable, non-jarring placeholder during chunk download.
 *
 * @module shared/lib/skeletons
 */

// ---------------------------------------------------------------------------
// Generic spinner (small inline use)
// ---------------------------------------------------------------------------

export function InlineSpinner({ className = '' }: { className?: string }) {
  return (
    <div
      className={`h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary ${className}`}
      role="status"
      aria-label="Loading"
    />
  );
}

// ---------------------------------------------------------------------------
// Full-panel centered spinner
// ---------------------------------------------------------------------------

export function PanelSpinner() {
  return (
    <div className="flex h-full min-h-[200px] w-full items-center justify-center">
      <InlineSpinner />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Graph view skeleton
// ---------------------------------------------------------------------------

export function GraphSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex h-11 items-center justify-between border-b border-border px-4">
        <div className="h-4 w-24 animate-pulse rounded bg-foreground-muted/20" />
        <div className="h-4 w-32 animate-pulse rounded bg-foreground-muted/20" />
      </div>
      {/* Canvas */}
      <div className="flex flex-1 items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 animate-pulse rounded-full bg-primary-muted/30" />
          <div className="h-3 w-20 animate-pulse rounded bg-foreground-muted/20" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings dialog skeleton
// ---------------------------------------------------------------------------

export function SettingsSkeleton() {
  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="flex w-52 flex-col gap-2 border-r border-border p-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-8 animate-pulse rounded-md bg-foreground-muted/15"
            style={{ animationDelay: `${i * 80}ms` }}
          />
        ))}
      </div>
      {/* Content */}
      <div className="flex-1 p-8">
        <div className="h-6 w-40 animate-pulse rounded bg-foreground-muted/20" />
        <div className="mt-4 h-px bg-border" />
        <div className="mt-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-10 animate-pulse rounded-md bg-foreground-muted/10"
              style={{ animationDelay: `${i * 100}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin browser skeleton
// ---------------------------------------------------------------------------

export function PluginBrowserSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-6">
      {/* Search bar */}
      <div className="flex gap-3">
        <div className="h-10 flex-1 animate-pulse rounded-md bg-foreground-muted/15" />
        <div className="h-10 w-44 animate-pulse rounded-md bg-foreground-muted/15" />
      </div>
      {/* Grid */}
      <div className="flex gap-6">
        <div className="w-48 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 animate-pulse rounded bg-foreground-muted/10" />
          ))}
        </div>
        <div
          className="flex-1 grid gap-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-xl border border-border bg-card"
              style={{ animationDelay: `${i * 60}ms` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Audit log skeleton
// ---------------------------------------------------------------------------

export function AuditLogSkeleton() {
  return (
    <div className="flex flex-col h-full rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <div className="h-5 w-24 animate-pulse rounded bg-foreground-muted/20" />
      </div>
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="h-8 w-32 animate-pulse rounded bg-foreground-muted/10" />
            <div className="h-8 w-20 animate-pulse rounded bg-foreground-muted/10" />
            <div className="h-8 flex-1 animate-pulse rounded bg-foreground-muted/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor skeleton
// ---------------------------------------------------------------------------

export function EditorSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 items-center border-b border-border px-4">
        <div className="h-3 w-48 animate-pulse rounded bg-foreground-muted/20" />
      </div>
      <div className="flex flex-1 flex-col items-center py-12">
        <div className="w-full max-w-prose space-y-4 px-6">
          <div className="h-10 w-3/4 animate-pulse rounded bg-foreground-muted/20" />
          <div className="h-4 w-full animate-pulse rounded bg-foreground-muted/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-foreground-muted/10" />
          <div className="h-4 w-4/6 animate-pulse rounded bg-foreground-muted/10" />
          <div className="mt-8 h-4 w-full animate-pulse rounded bg-foreground-muted/10" />
          <div className="h-4 w-3/4 animate-pulse rounded bg-foreground-muted/10" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// File explorer tree skeleton
// ---------------------------------------------------------------------------

export function FileTreeSkeleton() {
  return (
    <div className="space-y-0.5 p-1">
      {Array.from({ length: 12 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-sm px-2 py-1"
          style={{
            paddingLeft: `${(i % 3) * 12 + 8}px`,
            animationDelay: `${i * 40}ms`,
          }}
        >
          <div className="h-3.5 w-3.5 animate-pulse rounded bg-sidebar-muted/30" />
          <div
            className="h-3 animate-pulse rounded bg-sidebar-muted/20"
            style={{ width: `${60 + (i % 4) * 20}px` }}
          />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Search results skeleton
// ---------------------------------------------------------------------------

export function SearchResultsSkeleton() {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-4 w-2/3 animate-pulse rounded bg-foreground-muted/20" />
          <div className="mt-1 h-3 w-1/3 animate-pulse rounded bg-foreground-muted/10" />
          <div className="mt-2 h-3 w-full animate-pulse rounded bg-foreground-muted/10" />
        </div>
      ))}
    </div>
  );
}
