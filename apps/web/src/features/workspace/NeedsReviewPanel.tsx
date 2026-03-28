'use client';

import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  freshnessApi,
  type FreshnessStatus,
  type FreshnessStatusFilter,
  type ReviewQueueItem,
} from '@/shared/api/freshness';
import { useFreshnessStore } from './freshness-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NeedsReviewPanelProps {
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Status badge config
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<FreshnessStatus, { badge: string; dot: string }> = {
  fresh: {
    badge:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800',
    dot: 'bg-emerald-500',
  },
  aging: {
    badge:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800',
    dot: 'bg-amber-500',
  },
  stale: {
    badge:
      'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800',
    dot: 'bg-red-500',
  },
};

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-4 w-4'}
      aria-hidden="true"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ?? 'h-3 w-3'}
      aria-hidden="true"
    >
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatAge(days: number): string {
  if (days < 1) return 'today';
  if (days === 1) return '1 day';
  if (days < 30) return `${days} days`;
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? '1 month' : `${m} months`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? '1 year' : `${y} years`;
}

// ---------------------------------------------------------------------------
// Queue item row
// ---------------------------------------------------------------------------

interface QueueItemRowProps {
  item: ReviewQueueItem;
  workspaceId: string;
  isPending: boolean;
  onMarkReviewed: (noteId: string) => void;
}

function QueueItemRow({ item, workspaceId, isPending, onMarkReviewed }: QueueItemRowProps) {
  const router = useRouter();
  const style = STATUS_STYLES[item.status];

  const handleNavigate = useCallback(() => {
    router.push(`/workspaces/${workspaceId}/notes/${item.noteId}`);
  }, [router, workspaceId, item.noteId]);

  return (
    <div className="group rounded-md border border-border/50 bg-card/30 hover:bg-card/60 transition-colors duration-fast">
      <div className="flex items-start gap-2 px-3 py-2">
        {/* Status dot */}
        <span
          className={`mt-1 h-2 w-2 shrink-0 rounded-full ${style.dot}`}
          title={`Status: ${item.status}`}
          aria-hidden="true"
        />

        {/* Note info */}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-px text-2xs font-medium ${style.badge}`}
            >
              <ClockIcon className="h-2.5 w-2.5" />
              <span>{formatAge(item.ageInDays)}</span>
            </span>
          </div>

          <p className="truncate text-xs text-muted-foreground" title={item.path}>
            {item.path}
          </p>

          {item.isVerified && (
            <p className="text-2xs text-muted-foreground">
              Last reviewed: {new Date(item.anchorDate).toLocaleDateString()}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {/* Navigate to note */}
          <button
            type="button"
            onClick={handleNavigate}
            className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-fast"
            title={`Open note "${item.title}"`}
          >
            <ExternalLinkIcon />
          </button>

          {/* Mark as reviewed */}
          <button
            type="button"
            onClick={() => onMarkReviewed(item.noteId)}
            disabled={isPending}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-40 transition-colors duration-fast"
            title="Mark as reviewed"
          >
            {isPending ? (
              <span className="h-3 w-3 animate-spin rounded-full border border-primary border-t-transparent" />
            ) : (
              <CheckCircleIcon className="h-3 w-3" />
            )}
            <span>Review</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  currentStatus: FreshnessStatusFilter;
  onStatusChange: (status: FreshnessStatusFilter) => void;
}

const STATUS_OPTIONS: { value: FreshnessStatusFilter; label: string }[] = [
  { value: 'stale', label: 'Stale' },
  { value: 'aging', label: 'Aging' },
  { value: 'fresh', label: 'Fresh' },
  { value: 'all', label: 'All' },
];

function FilterBar({ currentStatus, onStatusChange }: FilterBarProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {STATUS_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onStatusChange(opt.value)}
          className={[
            'rounded px-2 py-0.5 text-xs font-medium transition-colors duration-fast',
            currentStatus === opt.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground',
          ].join(' ')}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

/**
 * NeedsReviewPanel — admin panel listing stale/aging documents with review actions.
 *
 * Features:
 * - Paginated list of notes needing review (sorted by age, most stale first)
 * - Status filter tabs (stale / aging / fresh / all)
 * - Mark as reviewed action per note
 * - Optimistic UI — item removed from list immediately on review
 * - Navigate-to-note button for each item
 */
export function NeedsReviewPanel({ workspaceId }: NeedsReviewPanelProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { filters, setFilters } = useFreshnessStore();

  const queryKey = useMemo(() => ['freshness-queue', workspaceId, filters], [workspaceId, filters]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () =>
      freshnessApi.getQueue(accessToken ?? '', workspaceId, {
        status: filters.status,
        ownerId: filters.ownerId,
        folder: filters.folder,
        limit: 20,
      }),
    enabled: !!accessToken && !!workspaceId,
    staleTime: 30_000,
  });

  const reviewMutation = useMutation({
    mutationFn: (noteId: string) =>
      freshnessApi.markAsReviewed(accessToken ?? '', workspaceId, noteId),
    onSuccess: (_result, noteId) => {
      // Invalidate both the queue and the individual note freshness cache
      void queryClient.invalidateQueries({ queryKey: ['freshness-queue', workspaceId] });
      void queryClient.invalidateQueries({ queryKey: ['freshness', workspaceId, noteId] });
    },
  });

  const handleMarkReviewed = useCallback(
    (noteId: string) => {
      reviewMutation.mutate(noteId);
    },
    [reviewMutation],
  );

  const handleStatusChange = useCallback(
    (status: FreshnessStatusFilter) => {
      setFilters({ status });
    },
    [setFilters],
  );

  const items = data?.data ?? [];
  const total = data?.pagination.total ?? 0;
  const thresholds = data?.thresholds;

  // ── Loading state ─────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 py-8">
        <p className="text-xs text-destructive">Failed to load review queue</p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="text-xs text-muted-foreground underline hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Needs Review</h3>
          {total > 0 && (
            <span className="rounded-full bg-destructive/15 px-1.5 py-px text-xs font-medium text-destructive">
              {total}
            </span>
          )}
        </div>
        {thresholds && (
          <p className="text-2xs text-muted-foreground">
            Aging: {thresholds.agingThresholdDays}d / Stale: {thresholds.staleThresholdDays}d
          </p>
        )}
      </div>

      {/* Status filter */}
      <div className="shrink-0">
        <FilterBar currentStatus={filters.status} onStatusChange={handleStatusChange} />
      </div>

      {/* Review success feedback */}
      {reviewMutation.isSuccess && (
        <div className="shrink-0 rounded border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
          Note marked as reviewed.
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && !isLoading && (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8">
          <CheckCircleIcon className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">
            {filters.status === 'all' ? 'No notes found' : `No ${filters.status} notes`}
          </p>
          {filters.status === 'stale' && (
            <p className="max-w-[180px] text-center text-2xs text-muted-foreground">
              All documents are within the freshness threshold.
            </p>
          )}
        </div>
      )}

      {/* Queue list */}
      {items.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
          {items.map((item) => (
            <QueueItemRow
              key={item.noteId}
              item={item}
              workspaceId={workspaceId}
              isPending={reviewMutation.isPending && reviewMutation.variables === item.noteId}
              onMarkReviewed={handleMarkReviewed}
            />
          ))}
        </div>
      )}
    </div>
  );
}
