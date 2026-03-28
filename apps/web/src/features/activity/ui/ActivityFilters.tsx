'use client';

import { Select, DatePicker, Flex, Button } from 'antd';
import { FilterOutlined, ClearOutlined } from '@ant-design/icons';
import { useActivityStore } from '@/shared/stores/activity-store';
import type { ActivityType } from '@/shared/api/activity';
import type { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

// ---------------------------------------------------------------------------
// Activity type options for the Select component
// ---------------------------------------------------------------------------

const ACTIVITY_TYPE_OPTIONS: Array<{ value: ActivityType; label: string }> = [
  { value: 'NOTE_CREATED', label: 'Created' },
  { value: 'NOTE_EDITED', label: 'Edited' },
  { value: 'NOTE_DELETED', label: 'Deleted' },
  { value: 'NOTE_RENAMED', label: 'Renamed' },
  { value: 'NOTE_MOVED', label: 'Moved' },
  { value: 'NOTE_COMMENTED', label: 'Commented' },
  { value: 'NOTE_SHARED', label: 'Shared' },
];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MemberOption {
  value: string;
  label: string;
}

interface ActivityFiltersProps {
  members?: MemberOption[];
  onFiltersChanged?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ActivityFilters({ members = [], onFiltersChanged }: ActivityFiltersProps) {
  const filters = useActivityStore((s) => s.filters);
  const setFilters = useActivityStore((s) => s.setFilters);
  const resetFilters = useActivityStore((s) => s.resetFilters);

  const hasActiveFilters =
    filters.type !== null ||
    filters.userId !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null;

  const handleTypeChange = (value: ActivityType | null) => {
    setFilters({ type: value });
    onFiltersChanged?.();
  };

  const handleMemberChange = (value: string | null) => {
    setFilters({ userId: value });
    onFiltersChanged?.();
  };

  const handleDateRangeChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
    if (!dates || (!dates[0] && !dates[1])) {
      setFilters({ dateFrom: null, dateTo: null });
    } else {
      setFilters({
        dateFrom: dates[0]?.toISOString() ?? null,
        dateTo: dates[1]?.toISOString() ?? null,
      });
    }
    onFiltersChanged?.();
  };

  const handleReset = () => {
    resetFilters();
    onFiltersChanged?.();
  };

  return (
    <Flex gap={8} wrap="wrap" align="center" style={{ padding: '8px 16px' }}>
      <FilterOutlined style={{ color: 'var(--ant-color-text-secondary)' }} />

      <Select
        placeholder="Event type"
        allowClear
        value={filters.type}
        onChange={handleTypeChange}
        options={ACTIVITY_TYPE_OPTIONS}
        style={{ minWidth: 140 }}
        size="small"
      />

      {members.length > 0 && (
        <Select
          placeholder="Member"
          allowClear
          showSearch
          value={filters.userId}
          onChange={handleMemberChange}
          options={members}
          optionFilterProp="label"
          style={{ minWidth: 160 }}
          size="small"
        />
      )}

      <RangePicker size="small" onChange={handleDateRangeChange} style={{ minWidth: 220 }} />

      {hasActiveFilters && (
        <Button type="text" size="small" icon={<ClearOutlined />} onClick={handleReset}>
          Clear
        </Button>
      )}
    </Flex>
  );
}
