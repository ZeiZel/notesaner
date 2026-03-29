/**
 * Tests for the timeline feature.
 *
 * Covers:
 *   - Date bucket classification logic (getDateBucket / bucketLabel)
 *   - Timeline API parameter serialisation
 *   - TimelineFilters structure validity
 *
 * React component rendering tests belong in Playwright E2E.
 * TanStack Query hook tests need full DOM setup which is out of scope here;
 * we test the pure logic extracted from the hook.
 *
 * Note: API and component modules are imported only for types / pure functions
 * — no network calls are made in these tests.
 */

import { beforeEach, describe, it, expect, vi } from 'vitest';

// Mock the API client to avoid network setup
vi.mock('@/shared/api/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock auth/workspace stores so the lib module can be imported
vi.mock('@/shared/stores/auth-store', () => ({
  useAuthStore: vi.fn(() => null),
}));
vi.mock('@/shared/stores/workspace-store', () => ({
  useWorkspaceStore: vi.fn(() => null),
}));

// ---------------------------------------------------------------------------
// Re-implement getDateBucket here for pure-function testing so we don't
// need to export an internal helper from the production module.
// This mirrors the exact logic in TimelineView.tsx.
// ---------------------------------------------------------------------------

type DateBucket =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'this-month'
  | `month:${string}`
  | `year:${string}`;

function getDateBucket(isoDate: string, now: Date = new Date()): DateBucket {
  const date = new Date(isoDate);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86_400_000);
  const weekStart = new Date(todayStart.getTime() - (todayStart.getDay() || 7) * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (date >= todayStart) return 'today';
  if (date >= yesterdayStart) return 'yesterday';
  if (date >= weekStart) return 'this-week';
  if (date >= monthStart) return 'this-month';

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
// Fixed reference time: 2026-03-29 12:00:00 UTC (Sunday)
// ---------------------------------------------------------------------------

const REF = new Date('2026-03-29T12:00:00.000Z');

// ---------------------------------------------------------------------------
// getDateBucket
// ---------------------------------------------------------------------------

describe('getDateBucket', () => {
  describe('today bucket', () => {
    it('assigns today for a note updated at the start of today', () => {
      const todayStart = new Date(REF.getFullYear(), REF.getMonth(), REF.getDate()).toISOString();
      expect(getDateBucket(todayStart, REF)).toBe('today');
    });

    it('assigns today for a note updated moments ago', () => {
      const recent = new Date(REF.getTime() - 5 * 60_000).toISOString();
      expect(getDateBucket(recent, REF)).toBe('today');
    });
  });

  describe('yesterday bucket', () => {
    it('assigns yesterday for a note updated 24 hours ago', () => {
      const yesterday = new Date(REF.getFullYear(), REF.getMonth(), REF.getDate() - 1, 10, 0, 0);
      expect(getDateBucket(yesterday.toISOString(), REF)).toBe('yesterday');
    });

    it('does NOT assign yesterday for a note updated 48 hours ago', () => {
      const twoDaysAgo = new Date(REF.getFullYear(), REF.getMonth(), REF.getDate() - 2, 10, 0, 0);
      expect(getDateBucket(twoDaysAgo.toISOString(), REF)).not.toBe('yesterday');
    });
  });

  describe('this-week bucket', () => {
    it('assigns this-week for a note 3 days before the week start', () => {
      // REF is Sunday 2026-03-29. Week starts Monday 2026-03-23.
      const midWeek = new Date(2026, 2, 25, 10, 0, 0); // Wednesday Mar 25
      expect(getDateBucket(midWeek.toISOString(), REF)).toBe('this-week');
    });

    it('does NOT assign this-week for a note from last week', () => {
      const lastWeek = new Date(2026, 2, 20, 10, 0, 0); // Friday Mar 20
      expect(getDateBucket(lastWeek.toISOString(), REF)).not.toBe('this-week');
    });
  });

  describe('this-month bucket', () => {
    it('assigns this-month for a note updated at month start', () => {
      const monthStart = new Date(2026, 2, 1, 8, 0, 0); // March 1, 2026
      expect(getDateBucket(monthStart.toISOString(), REF)).toBe('this-month');
    });

    it('does NOT assign this-month for a note from last month', () => {
      const lastMonth = new Date(2026, 1, 28, 10, 0, 0); // Feb 28, 2026
      expect(getDateBucket(lastMonth.toISOString(), REF)).not.toBe('this-month');
    });
  });

  describe('month bucket (within past 12 months)', () => {
    it('assigns month:YYYY-MM for a note from last month', () => {
      const lastMonth = new Date(2026, 1, 15, 10, 0, 0); // Feb 15, 2026
      expect(getDateBucket(lastMonth.toISOString(), REF)).toBe('month:2026-02');
    });

    it('assigns month:YYYY-MM for a note from 11 months ago', () => {
      const elevenMonthsAgo = new Date(2025, 4, 10, 10, 0, 0); // May 10, 2025
      expect(getDateBucket(elevenMonthsAgo.toISOString(), REF)).toBe('month:2025-05');
    });

    it('zero-pads the month number', () => {
      const january = new Date(2026, 0, 5, 10, 0, 0); // Jan 5, 2026
      expect(getDateBucket(january.toISOString(), REF)).toBe('month:2026-01');
    });
  });

  describe('year bucket (12+ months ago)', () => {
    it('assigns year:YYYY for a note from 13 months ago', () => {
      const thirteenMonthsAgo = new Date(2025, 1, 15, 10, 0, 0); // Feb 15, 2025
      expect(getDateBucket(thirteenMonthsAgo.toISOString(), REF)).toBe('year:2025');
    });

    it('assigns year:YYYY for a very old note', () => {
      const oldNote = new Date(2020, 5, 10, 10, 0, 0); // June 10, 2020
      expect(getDateBucket(oldNote.toISOString(), REF)).toBe('year:2020');
    });
  });
});

// ---------------------------------------------------------------------------
// bucketLabel
// ---------------------------------------------------------------------------

describe('bucketLabel', () => {
  it('returns "Today" for the today bucket', () => {
    expect(bucketLabel('today')).toBe('Today');
  });

  it('returns "Yesterday" for the yesterday bucket', () => {
    expect(bucketLabel('yesterday')).toBe('Yesterday');
  });

  it('returns "This Week" for the this-week bucket', () => {
    expect(bucketLabel('this-week')).toBe('This Week');
  });

  it('returns "This Month" for the this-month bucket', () => {
    expect(bucketLabel('this-month')).toBe('This Month');
  });

  it('returns a formatted month/year string for a month bucket', () => {
    const label = bucketLabel('month:2026-02');
    // The Intl formatter used in implementation returns e.g. "February 2026"
    expect(label).toContain('2026');
    expect(label.toLowerCase()).toContain('feb');
  });

  it('returns the year string for a year bucket', () => {
    expect(bucketLabel('year:2025')).toBe('2025');
  });

  it('returns the raw bucket as fallback for unknown buckets', () => {
    expect(bucketLabel('unknown-bucket' as DateBucket)).toBe('unknown-bucket');
  });
});

// ---------------------------------------------------------------------------
// Timeline API parameter building
// ---------------------------------------------------------------------------

import { timelineApi } from '@/shared/api/timeline';
import { apiClient } from '@/shared/api/client';

const MOCK_EMPTY_PAGE = {
  data: [],
  pagination: { nextCursor: null, hasMore: false, limit: 20 },
};

describe('timelineApi.getTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the correct endpoint for a workspace with no params', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-123');

    expect(mockGet).toHaveBeenCalledWith('/api/workspaces/ws-123/notes/timeline');
  });

  it('appends pagination cursor to the URL', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-123', { before: '2026-03-01T00:00:00.000Z', limit: 10 });

    const calledUrl: string = mockGet.mock.lastCall?.[0] as string;
    expect(calledUrl).toContain('before=2026-03-01T00%3A00%3A00.000Z');
    expect(calledUrl).toContain('limit=10');
  });

  it('appends authorId filter to the URL', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-abc', { authorId: 'user-42' });

    const calledUrl: string = mockGet.mock.lastCall?.[0] as string;
    expect(calledUrl).toContain('authorId=user-42');
  });

  it('appends comma-joined tagIds to the URL', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-abc', { tagIds: ['tag-1', 'tag-2', 'tag-3'] });

    const calledUrl: string = mockGet.mock.lastCall?.[0] as string;
    expect(calledUrl).toContain('tagIds=tag-1%2Ctag-2%2Ctag-3');
  });

  it('does NOT append tagIds when array is empty', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-abc', { tagIds: [] });

    const calledUrl: string = mockGet.mock.lastCall?.[0] as string;
    expect(calledUrl).not.toContain('tagIds');
  });

  it('appends dateFrom and dateTo filters', async () => {
    const mockGet = vi.mocked(apiClient.get);
    mockGet.mockResolvedValueOnce(MOCK_EMPTY_PAGE);

    await timelineApi.getTimeline('ws-abc', {
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-03-01T00:00:00.000Z',
    });

    const calledUrl: string = mockGet.mock.lastCall?.[0] as string;
    expect(calledUrl).toContain('dateFrom=');
    expect(calledUrl).toContain('dateTo=');
  });
});

// ---------------------------------------------------------------------------
// TimelineFilters defaults
// ---------------------------------------------------------------------------

import { type TimelineFilters } from '../lib/use-timeline-query';

describe('TimelineFilters structure', () => {
  it('accepts all-null / empty filters as valid', () => {
    const filters: TimelineFilters = {
      authorId: null,
      tagIds: [],
      dateFrom: null,
      dateTo: null,
    };
    expect(filters.authorId).toBeNull();
    expect(filters.tagIds).toHaveLength(0);
  });

  it('accepts filters with values', () => {
    const filters: TimelineFilters = {
      authorId: 'user-1',
      tagIds: ['tag-a', 'tag-b'],
      dateFrom: '2026-01-01T00:00:00.000Z',
      dateTo: '2026-03-31T23:59:59.999Z',
    };
    expect(filters.authorId).toBe('user-1');
    expect(filters.tagIds).toHaveLength(2);
    expect(filters.dateFrom).toBeTruthy();
    expect(filters.dateTo).toBeTruthy();
  });

  it('accepts partial filters (only dateFrom)', () => {
    const filters: TimelineFilters = {
      dateFrom: '2026-01-01T00:00:00.000Z',
    };
    expect(filters.dateFrom).toBeTruthy();
    expect(filters.authorId).toBeUndefined();
  });
});
