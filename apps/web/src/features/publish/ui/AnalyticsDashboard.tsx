'use client';

/**
 * AnalyticsDashboard
 *
 * Privacy-first analytics dashboard for published notes.
 *
 * Features:
 * - Date range picker (last 7d / 30d / 90d / all time)
 * - Summary cards: total views, unique visitors
 * - Daily traffic chart (bar chart using pure SVG — no chart lib required)
 * - Top notes table ranked by views
 * - Top referrers list
 *
 * All data is fetched from the server via TanStack Query hooks defined in
 * analytics-store.ts. No cookies, no third-party tracking.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useAnalyticsStore,
  useAnalyticsSummary,
  useAnalyticsTopNotes,
  analyticsKeys,
} from '../model/analytics-store';
import type { DateRange, DailyStatPoint, TopNoteItem, ReferrerItem } from '@/shared/api/analytics';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AnalyticsDashboardProps {
  workspaceId: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ── Date range picker ────────────────────────────────────────────────────────

const DATE_RANGE_OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div
      className="flex items-center gap-1 rounded-lg p-0.5"
      style={{
        backgroundColor: 'var(--ns-color-background-surface)',
        border: '1px solid var(--ns-color-border)',
      }}
      role="group"
      aria-label="Date range"
    >
      {DATE_RANGE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className="rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-fast"
          style={{
            backgroundColor: value === opt.value ? 'var(--ns-color-primary)' : 'transparent',
            color:
              value === opt.value
                ? 'var(--ns-color-primary-foreground)'
                : 'var(--ns-color-foreground-muted)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── Summary stat card ────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  description?: string;
}

function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--ns-color-background-surface)',
        border: '1px solid var(--ns-color-border)',
      }}
    >
      <p
        className="text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        {label}
      </p>
      <p
        className="mt-1 text-2xl font-bold tabular-nums"
        style={{ color: 'var(--ns-color-foreground)' }}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {description && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          {description}
        </p>
      )}
    </div>
  );
}

// ── Traffic chart (pure SVG bar chart) ───────────────────────────────────────

interface TrafficChartProps {
  data: DailyStatPoint[];
  height?: number;
}

function TrafficChart({ data, height = 120 }: TrafficChartProps) {
  const maxViews = useMemo(() => Math.max(1, ...data.map((d) => d.views)), [data]);

  // Show at most 60 bars to keep the chart readable
  const visibleData = data.length > 60 ? data.slice(-60) : data;

  const barWidth = 100 / Math.max(visibleData.length, 1);
  const gapPercent = 0.3; // gap between bars in percentage points

  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--ns-color-background-surface)',
        border: '1px solid var(--ns-color-border)',
      }}
    >
      <p
        className="mb-3 text-xs font-medium uppercase tracking-wider"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        Daily traffic
      </p>

      {data.length === 0 ? (
        <div
          className="flex items-center justify-center py-8"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          <span className="text-xs">No data for this period</span>
        </div>
      ) : (
        <svg
          viewBox={`0 0 100 ${height}`}
          preserveAspectRatio="none"
          className="w-full"
          style={{ height: `${height}px` }}
          role="img"
          aria-label="Daily page views bar chart"
        >
          {visibleData.map((point, i) => {
            const barH = height * (point.views / maxViews);
            const x = i * barWidth + gapPercent / 2;
            const w = barWidth - gapPercent;

            return (
              <g key={point.date}>
                <title>{`${point.date}: ${point.views.toLocaleString()} views, ${point.uniqueVisitors.toLocaleString()} unique`}</title>
                {/* Views bar */}
                <rect
                  x={x}
                  y={height - barH}
                  width={w}
                  height={barH}
                  fill="var(--ns-color-primary)"
                  opacity={0.8}
                  rx={0.5}
                />
                {/* Unique visitors bar overlay (lighter) */}
                {point.uniqueVisitors > 0 && (
                  <rect
                    x={x}
                    y={height - height * (point.uniqueVisitors / maxViews)}
                    width={w}
                    height={height * (point.uniqueVisitors / maxViews)}
                    fill="var(--ns-color-primary)"
                    opacity={0.35}
                    rx={0.5}
                  />
                )}
              </g>
            );
          })}
        </svg>
      )}

      {/* Legend */}
      <div className="mt-2 flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: 'var(--ns-color-primary)', opacity: 0.8 }}
          />
          <span className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            Page views
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            className="h-2 w-4 rounded-sm"
            style={{ backgroundColor: 'var(--ns-color-primary)', opacity: 0.35 }}
          />
          <span className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
            Unique visitors
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Top notes table ───────────────────────────────────────────────────────────

interface TopNotesTableProps {
  notes: TopNoteItem[];
  onNoteClick?: (noteId: string) => void;
}

function TopNotesTable({ notes, onNoteClick }: TopNotesTableProps) {
  const maxViews = useMemo(() => Math.max(1, ...notes.map((n) => n.totalViews)), [notes]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--ns-color-border)' }}
    >
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: 'var(--ns-color-background-surface)',
          borderBottom: '1px solid var(--ns-color-border)',
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Top notes
        </p>
      </div>

      {notes.length === 0 ? (
        <div
          className="px-4 py-8 text-center"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          <p className="text-xs">No published notes with views yet</p>
        </div>
      ) : (
        <div style={{ backgroundColor: 'var(--ns-color-background)' }}>
          {/* Table header */}
          <div
            className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2"
            style={{ borderBottom: '1px solid var(--ns-color-border)' }}
          >
            {['Note', 'Views', 'Visitors'].map((h) => (
              <span
                key={h}
                className="text-xs font-medium"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {notes.map((note, idx) => (
            <div
              key={note.noteId}
              className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-2.5 items-center"
              style={{
                borderBottom: idx < notes.length - 1 ? '1px solid var(--ns-color-border)' : 'none',
              }}
            >
              {/* Note title with relative bar */}
              <div className="min-w-0 space-y-1">
                <button
                  type="button"
                  onClick={() => onNoteClick?.(note.noteId)}
                  className="block w-full truncate text-left text-sm font-medium hover:underline"
                  style={{ color: 'var(--ns-color-foreground)' }}
                  title={note.path}
                >
                  {note.title}
                </button>
                {/* Progress bar showing relative popularity */}
                <div
                  className="h-1 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--ns-color-border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((note.totalViews / maxViews) * 100)}%`,
                      backgroundColor: 'var(--ns-color-primary)',
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>

              {/* Views */}
              <span
                className="text-sm tabular-nums font-medium"
                style={{ color: 'var(--ns-color-foreground)' }}
              >
                {note.totalViews.toLocaleString()}
              </span>

              {/* Unique visitors */}
              <span
                className="text-sm tabular-nums"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                {note.uniqueVisitors.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Referrers list ────────────────────────────────────────────────────────────

interface ReferrersListProps {
  referrers: ReferrerItem[];
}

function ReferrersList({ referrers }: ReferrersListProps) {
  const maxCount = useMemo(() => Math.max(1, ...referrers.map((r) => r.count)), [referrers]);

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: '1px solid var(--ns-color-border)' }}
    >
      <div
        className="px-4 py-3"
        style={{
          backgroundColor: 'var(--ns-color-background-surface)',
          borderBottom: '1px solid var(--ns-color-border)',
        }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
        >
          Top referrers
        </p>
      </div>

      <div style={{ backgroundColor: 'var(--ns-color-background)' }}>
        {referrers.length === 0 ? (
          <div
            className="px-4 py-6 text-center"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
          >
            <p className="text-xs">No referrer data yet</p>
          </div>
        ) : (
          referrers.map((ref, idx) => (
            <div
              key={ref.referrer}
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom:
                  idx < referrers.length - 1 ? '1px solid var(--ns-color-border)' : 'none',
              }}
            >
              {/* Relative bar + label */}
              <div className="min-w-0 flex-1 space-y-1">
                <span
                  className="block truncate text-sm"
                  style={{ color: 'var(--ns-color-foreground)' }}
                  title={ref.referrer}
                >
                  {ref.referrer}
                </span>
                <div
                  className="h-1 w-full rounded-full overflow-hidden"
                  style={{ backgroundColor: 'var(--ns-color-border)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((ref.count / maxCount) * 100)}%`,
                      backgroundColor: 'var(--ns-color-secondary, var(--ns-color-primary))',
                      opacity: 0.6,
                    }}
                  />
                </div>
              </div>

              {/* Count */}
              <span
                className="shrink-0 text-sm tabular-nums font-medium"
                style={{ color: 'var(--ns-color-foreground)' }}
              >
                {ref.count.toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ── Skeleton loading state ────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-20 rounded-lg"
            style={{ backgroundColor: 'var(--ns-color-background-surface)' }}
          />
        ))}
      </div>
      {/* Chart skeleton */}
      <div
        className="h-40 rounded-lg"
        style={{ backgroundColor: 'var(--ns-color-background-surface)' }}
      />
      {/* Tables skeleton */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg"
            style={{ backgroundColor: 'var(--ns-color-background-surface)' }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Error state ───────────────────────────────────────────────────────────────

function DashboardError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <p className="text-sm font-medium" style={{ color: 'var(--ns-color-destructive)' }}>
        Failed to load analytics
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-xs underline"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dashboard component
// ---------------------------------------------------------------------------

export function AnalyticsDashboard({ workspaceId }: AnalyticsDashboardProps) {
  const queryClient = useQueryClient();

  const selectedDateRange = useAnalyticsStore((s) => s.selectedDateRange);
  const focusedNoteId = useAnalyticsStore((s) => s.focusedNoteId);
  const setDateRange = useAnalyticsStore((s) => s.setDateRange);
  const setFocusedNoteId = useAnalyticsStore((s) => s.setFocusedNoteId);

  const { data: summary, isLoading, isError, refetch } = useAnalyticsSummary(workspaceId);

  const { data: topNotes, isLoading: isTopNotesLoading } = useAnalyticsTopNotes(workspaceId);

  const handleDateRangeChange = useCallback(
    (range: DateRange) => {
      setDateRange(range);
    },
    [setDateRange],
  );

  const handleNoteClick = useCallback(
    (noteId: string) => {
      // Toggle: clicking the same note clears the focus
      setFocusedNoteId(focusedNoteId === noteId ? null : noteId);
    },
    [focusedNoteId, setFocusedNoteId],
  );

  const handleRefresh = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: analyticsKeys.all(workspaceId),
    });
  }, [queryClient, workspaceId]);

  // ── Loading ───────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
            Analytics
          </h2>
        </div>
        <DashboardSkeleton />
      </div>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
            Analytics
          </h2>
        </div>
        <DashboardError onRetry={() => void refetch()} />
      </div>
    );
  }

  const totalViews = summary?.totalViews ?? 0;
  const uniqueVisitors = summary?.uniqueVisitors ?? 0;
  const dailyStats = summary?.dailyStats ?? [];
  const topReferrers = summary?.topReferrers ?? [];
  const topNoteItems = topNotes ?? summary?.topNotes ?? [];

  // ── Main content ──────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
            Analytics
          </h2>

          {/* Per-note scope badge */}
          {focusedNoteId && (
            <button
              type="button"
              onClick={() => setFocusedNoteId(null)}
              className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor: 'var(--ns-color-primary)',
                color: 'var(--ns-color-primary-foreground)',
              }}
              title="Clear note filter"
            >
              <span>Note filter active</span>
              <span aria-hidden="true">x</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker value={selectedDateRange} onChange={handleDateRangeChange} />
          <button
            type="button"
            onClick={handleRefresh}
            className="rounded-md px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid var(--ns-color-border)',
              color: 'var(--ns-color-foreground-muted)',
            }}
            title="Refresh analytics data"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Privacy notice */}
      <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
        Privacy-first tracking: no cookies, no third-party scripts. Unique visitor counts use
        daily-rotating hashes.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label="Total views"
          value={totalViews}
          description={`in the last ${selectedDateRange === 'all' ? '365 days' : selectedDateRange}`}
        />
        <StatCard
          label="Unique visitors"
          value={uniqueVisitors}
          description="estimated via daily hash"
        />
      </div>

      {/* Traffic chart */}
      <TrafficChart data={dailyStats} />

      {/* Bottom section: top notes + referrers */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {isTopNotesLoading ? (
          <div
            className="h-48 animate-pulse rounded-lg"
            style={{ backgroundColor: 'var(--ns-color-background-surface)' }}
          />
        ) : (
          <TopNotesTable notes={topNoteItems} onNoteClick={handleNoteClick} />
        )}

        <ReferrersList referrers={topReferrers} />
      </div>
    </div>
  );
}
