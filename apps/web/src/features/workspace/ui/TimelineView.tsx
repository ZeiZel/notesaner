'use client';

/**
 * TimelineView — chronological list of notes grouped by date bucket.
 *
 * Features:
 *   - Notes grouped by relative date labels: Today, Yesterday, This Week,
 *     This Month, and older buckets by month/year
 *   - Ant Design Timeline component for the visual date-rail
 *   - Each entry shows: title, preview snippet, relative modified time, tags
 *   - Click on a note to open it (calls onNoteClick)
 *   - Filters: date range (RangePicker), author (Select), tags (Select)
 *   - Infinite scroll: IntersectionObserver on a sentinel element at the bottom
 *
 * Architecture note:
 *   - Data fetching lives in use-timeline-query.ts (TanStack Query)
 *   - This component only renders — it receives callbacks and manages
 *     filter UI state via useState (not Zustand, since it is transient view state)
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  Timeline,
  Select,
  DatePicker,
  Button,
  Typography,
  Tag,
  Spin,
  Empty,
  Flex,
  Tooltip,
} from 'antd';
import { FilterOutlined, ClearOutlined, ClockCircleOutlined } from '@ant-design/icons';
import type { Dayjs } from 'dayjs';
import { cn } from '@/shared/lib/utils';
import { useTimelineQuery, type TimelineFilters } from '../lib/use-timeline-query';
import type { TimelineNoteDto } from '@/shared/api/timeline';

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

// ---------------------------------------------------------------------------
// Date bucket helpers
// ---------------------------------------------------------------------------

type DateBucket =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | `month:${string}` // e.g. "month:2026-02"
  | `year:${string}`; // e.g. "year:2025"

function getDateBucket(isoDate: string): DateBucket {
  const now = new Date();
  const date = new Date(isoDate);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - (todayStart.getDay() || 7) * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= todayStart) return 'today';
  if (date >= yesterdayStart) return 'yesterday';
  if (date >= weekStart) return 'this-week';
  if (date >= monthStart) return 'this-month';

  // Older: group by "YYYY-MM" if in the past 12 months, else by year
  const diffMonths =
    (now.getFullYear() - date.getFullYear()) * 12 + (now.getMonth() - date.getMonth());
  if (diffMonths < 12) {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    return `month:${key}` as DateBucket;
  }

  return `year:${date.getFullYear()}` as DateBucket;
}

function bucketLabel(bucket: DateBucket): string {
  if (bucket === 'today') return 'Today';
  if (bucket === 'yesterday') return 'Yesterday';
  if (bucket === 'this-week') return 'This Week';
  if (bucket === 'this-month') return 'This Month';
  if (bucket.startsWith('month:')) {
    const [, key] = bucket.split(':') as [string, string];
    const [year, month] = key.split('-').map(Number) as [number, number];
    return new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(
      new Date(year, month - 1, 1),
    );
  }
  if (bucket.startsWith('year:')) {
    const [, year] = bucket.split(':') as [string, string];
    return year;
  }
  return bucket;
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function formatRelative(isoDate: string): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = new Date(isoDate).getTime() - Date.now();
  const diffMinutes = Math.round(diff / 60_000);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  if (Math.abs(diffDays) < 30) return rtf.format(diffDays, 'day');
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(isoDate));
}

// ---------------------------------------------------------------------------
// Note card
// ---------------------------------------------------------------------------

interface NoteCardProps {
  note: TimelineNoteDto;
  isActive: boolean;
  onClick: (noteId: string) => void;
}

function NoteCard({ note, isActive, onClick }: NoteCardProps) {
  const relativeTime = formatRelative(note.updatedAt);
  const absoluteTime = new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(note.updatedAt));

  return (
    <button
      type="button"
      onClick={() => onClick(note.id)}
      aria-current={isActive ? 'true' : undefined}
      aria-label={`${note.title || 'Untitled'}, modified ${relativeTime}`}
      className={cn(
        'w-full rounded-lg border border-border/50 bg-card/40 p-3 text-left',
        'transition-all duration-fast hover:border-border hover:bg-card/80 hover:shadow-sm',
        isActive && 'border-primary/40 bg-primary/5 shadow-sm',
      )}
    >
      {/* Title + timestamp row */}
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            'line-clamp-1 text-sm font-medium',
            isActive ? 'text-primary' : 'text-foreground',
          )}
        >
          {note.title || 'Untitled'}
        </span>
        <Tooltip title={absoluteTime} placement="topRight">
          <span className="mt-0.5 shrink-0 text-xs text-foreground-muted">{relativeTime}</span>
        </Tooltip>
      </div>

      {/* Author */}
      <Text type="secondary" className="mt-0.5 block text-xs">
        {note.author.displayName}
      </Text>

      {/* Preview */}
      {note.preview && (
        <p className="mt-1 line-clamp-2 text-xs text-foreground-secondary">{note.preview}</p>
      )}

      {/* Tags */}
      {note.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {note.tags.slice(0, 4).map((tag) => (
            <Tag key={tag} bordered={false} className="m-0 rounded-full text-xs">
              {tag}
            </Tag>
          ))}
          {note.tags.length > 4 && (
            <span className="text-2xs text-foreground-muted">+{note.tags.length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Filters bar
// ---------------------------------------------------------------------------

interface FilterBarProps {
  filters: TimelineFilters;
  authorOptions: Array<{ value: string; label: string }>;
  tagOptions: Array<{ value: string; label: string }>;
  onFiltersChange: (patch: Partial<TimelineFilters>) => void;
  onReset: () => void;
}

function FilterBar({
  filters,
  authorOptions,
  tagOptions,
  onFiltersChange,
  onReset,
}: FilterBarProps) {
  const hasActiveFilters =
    filters.authorId != null ||
    (filters.tagIds != null && filters.tagIds.length > 0) ||
    filters.dateFrom != null ||
    filters.dateTo != null;

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || (!dates[0] && !dates[1])) {
      onFiltersChange({ dateFrom: null, dateTo: null });
    } else {
      onFiltersChange({
        dateFrom: dates[0]?.toISOString() ?? null,
        dateTo: dates[1]?.toISOString() ?? null,
      });
    }
  };

  return (
    <Flex gap={8} wrap="wrap" align="center" style={{ padding: '8px 16px' }}>
      <FilterOutlined style={{ color: 'var(--ant-color-text-secondary)' }} />

      <RangePicker
        size="small"
        onChange={handleDateRangeChange}
        style={{ minWidth: 220 }}
        placeholder={['From date', 'To date']}
      />

      {authorOptions.length > 0 && (
        <Select
          placeholder="Author"
          allowClear
          showSearch
          value={filters.authorId ?? undefined}
          onChange={(value: string | undefined) => onFiltersChange({ authorId: value ?? null })}
          options={authorOptions}
          optionFilterProp="label"
          style={{ minWidth: 160 }}
          size="small"
        />
      )}

      {tagOptions.length > 0 && (
        <Select
          mode="multiple"
          placeholder="Tags"
          allowClear
          value={filters.tagIds ?? []}
          onChange={(value: string[]) => onFiltersChange({ tagIds: value })}
          options={tagOptions}
          style={{ minWidth: 160 }}
          size="small"
          maxTagCount="responsive"
        />
      )}

      {hasActiveFilters && (
        <Button type="text" size="small" icon={<ClearOutlined />} onClick={onReset}>
          Clear
        </Button>
      )}
    </Flex>
  );
}

// ---------------------------------------------------------------------------
// TimelineView types
// ---------------------------------------------------------------------------

export interface TimelineViewProps {
  /** Currently active note ID (for active highlight). */
  activeNoteId?: string | null;
  /** Called when the user clicks a note to open it. */
  onNoteClick: (noteId: string) => void;
  /** Author options for the filter Select. */
  authorOptions?: Array<{ value: string; label: string }>;
  /** Tag options for the filter Select. */
  tagOptions?: Array<{ value: string; label: string }>;
  /** Container className. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const EMPTY_FILTERS: TimelineFilters = {
  authorId: null,
  tagIds: [],
  dateFrom: null,
  dateTo: null,
};

export function TimelineView({
  activeNoteId,
  onNoteClick,
  authorOptions = [],
  tagOptions = [],
  className,
}: TimelineViewProps) {
  const [filters, setFilters] = useState<TimelineFilters>(EMPTY_FILTERS);

  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useTimelineQuery(filters);

  // Flatten pages into a single array of notes
  const notes = useMemo(() => data?.pages.flatMap((p) => p.data) ?? [], [data]);

  // Group notes by date bucket
  const groups = useMemo(() => {
    const map = new Map<DateBucket, TimelineNoteDto[]>();
    for (const note of notes) {
      const bucket = getDateBucket(note.updatedAt);
      const existing = map.get(bucket);
      if (existing) {
        existing.push(note);
      } else {
        map.set(bucket, [note]);
      }
    }
    return map;
  }, [notes]);

  // Infinite scroll: observe sentinel at the bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          void fetchNextPage();
        }
      },
      { threshold: 0.1 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleFiltersChange = useCallback((patch: Partial<TimelineFilters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleReset = useCallback(() => {
    setFilters(EMPTY_FILTERS);
  }, []);

  const handleNoteClick = useCallback(
    (noteId: string) => {
      onNoteClick(noteId);
    },
    [onNoteClick],
  );

  // Build Ant Design Timeline items — one per date bucket
  const timelineItems = useMemo(() => {
    if (groups.size === 0) return [];

    return Array.from(groups.entries()).map(([bucket, bucketNotes]) => ({
      dot: <ClockCircleOutlined style={{ fontSize: 14 }} />,
      color: 'blue',
      children: (
        <div className="mb-4">
          {/* Bucket label */}
          <Title
            level={5}
            style={{ marginBottom: 8, marginTop: 0 }}
            className="text-foreground-secondary"
          >
            {bucketLabel(bucket)}
          </Title>

          {/* Note cards */}
          <div className="flex flex-col gap-2">
            {bucketNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isActive={note.id === activeNoteId}
                onClick={handleNoteClick}
              />
            ))}
          </div>
        </div>
      ),
    }));
  }, [groups, activeNoteId, handleNoteClick]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className={cn('flex h-full flex-col', className)} aria-label="Notes timeline">
      {/* Filter bar */}
      <div className="shrink-0 border-b border-border">
        <FilterBar
          filters={filters}
          authorOptions={authorOptions}
          tagOptions={tagOptions}
          onFiltersChange={handleFiltersChange}
          onReset={handleReset}
        />
      </div>

      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        {/* Loading skeleton (first load) */}
        {isLoading && (
          <Flex justify="center" align="center" style={{ paddingTop: 48 }}>
            <Spin size="default" />
          </Flex>
        )}

        {/* Error state */}
        {isError && !isLoading && (
          <Flex vertical align="center" gap={8} style={{ paddingTop: 48 }}>
            <Text type="danger">Failed to load timeline</Text>
            <Button type="link" size="small" onClick={() => void refetch()}>
              Retry
            </Button>
          </Flex>
        )}

        {/* Empty state */}
        {!isLoading && !isError && notes.length === 0 && (
          <Empty
            description="No notes found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: 48 }}
          />
        )}

        {/* Timeline */}
        {!isLoading && !isError && notes.length > 0 && (
          <div className="px-4 py-3">
            <Timeline mode="left" items={timelineItems} style={{ marginTop: 8 }} />
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} aria-hidden="true" />

        {/* Loading more indicator */}
        {isFetchingNextPage && (
          <Flex justify="center" style={{ padding: '8px 0 16px' }}>
            <Spin size="small" />
          </Flex>
        )}

        {/* End of list */}
        {!hasNextPage && notes.length > 0 && !isFetchingNextPage && (
          <p className="py-4 text-center text-xs text-foreground-muted">
            All notes loaded ({notes.length} total)
          </p>
        )}
      </div>
    </div>
  );
}
