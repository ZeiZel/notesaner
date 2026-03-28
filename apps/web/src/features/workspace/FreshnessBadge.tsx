'use client';

import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import { freshnessApi, type FreshnessResult, type FreshnessStatus } from '@/shared/api/freshness';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FreshnessBadgeProps {
  workspaceId: string;
  noteId: string;
  /** When true, shows a compact badge without label text. */
  compact?: boolean;
  className?: string;
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  FreshnessStatus,
  { label: string; color: string; dotColor: string; bgColor: string }
> = {
  fresh: {
    label: 'Fresh',
    color: 'text-emerald-700 dark:text-emerald-400',
    dotColor: 'bg-emerald-500',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  aging: {
    label: 'Aging',
    color: 'text-amber-700 dark:text-amber-400',
    dotColor: 'bg-amber-500',
    bgColor: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  stale: {
    label: 'Stale',
    color: 'text-red-700 dark:text-red-400',
    dotColor: 'bg-red-500',
    bgColor: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'today';
    if (diffDays === 1) return '1 day ago';
    if (diffDays < 30) return `${diffDays} days ago`;
    if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      return months === 1 ? '1 month ago' : `${months} months ago`;
    }
    const years = Math.floor(diffDays / 365);
    return years === 1 ? '1 year ago' : `${years} years ago`;
  } catch {
    return isoDate;
  }
}

function buildTooltip(result: FreshnessResult): string {
  const anchor = formatRelativeDate(result.anchorDate);
  const verifiedLabel = result.isVerified ? 'Last reviewed' : 'Last edited';
  const threshold =
    result.status === 'fresh'
      ? `Aging threshold: ${result.agingThresholdDays} days`
      : result.status === 'aging'
        ? `Stale threshold: ${result.staleThresholdDays} days`
        : `Stale since ${result.ageInDays - result.staleThresholdDays} days past threshold`;

  return `${verifiedLabel}: ${anchor} (${result.ageInDays} days ago)\n${threshold}`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SkeletonBadge() {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 animate-pulse bg-muted border-border"
      aria-hidden="true"
    >
      <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
      <div className="h-2.5 w-8 rounded bg-muted-foreground/40" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * FreshnessBadge — displays the content freshness status of a note.
 *
 * Shows a color-coded badge:
 *   - Green (fresh): last edited/verified within the aging threshold
 *   - Yellow (aging): past aging threshold but not yet stale
 *   - Red (stale): past the stale threshold
 *
 * Includes a tooltip with the anchor date and threshold context.
 */
export function FreshnessBadge({
  workspaceId,
  noteId,
  compact = false,
  className = '',
}: FreshnessBadgeProps) {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['freshness', workspaceId, noteId],
    queryFn: () => freshnessApi.getNoteFreshness(accessToken ?? '', workspaceId, noteId),
    enabled: !!accessToken && !!workspaceId && !!noteId,
    staleTime: 5 * 60_000, // 5 minutes — freshness status doesn't change frequently
  });

  if (isLoading) {
    return <SkeletonBadge />;
  }

  if (isError || !data) {
    return null;
  }

  const config = STATUS_CONFIG[data.status];
  const tooltip = buildTooltip(data);

  if (compact) {
    return (
      <span
        className={`inline-flex items-center ${className}`}
        title={tooltip}
        aria-label={`Freshness: ${config.label}`}
      >
        <span className={`h-2 w-2 rounded-full ${config.dotColor}`} role="img" aria-hidden="true" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${config.bgColor} ${config.color} ${className}`}
      title={tooltip}
      aria-label={`Content freshness: ${config.label}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dotColor}`}
        role="img"
        aria-hidden="true"
      />
      <span>{config.label}</span>
      <span className="text-current/60 tabular-nums">{data.ageInDays}d</span>
    </span>
  );
}
