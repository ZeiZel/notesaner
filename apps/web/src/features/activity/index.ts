/**
 * features/activity — Public API (barrel export).
 *
 * Exports UI components and TanStack Query hooks for the activity feed
 * and note follow/notification features.
 *
 * FSD rule: only import from this index.ts in higher layers.
 */

// ---------------------------------------------------------------------------
// UI Components
// ---------------------------------------------------------------------------

export { ActivityFeed } from './ui/ActivityFeed';
export { ActivityFeedItem } from './ui/ActivityFeedItem';
export { ActivityFilters } from './ui/ActivityFilters';
export { ActivityBadge } from './ui/ActivityBadge';
export { NoteActivityPanel } from './ui/NoteActivityPanel';
export { FollowNoteButton } from './ui/FollowNoteButton';
export { MentionInput } from './ui/MentionInput';

// ---------------------------------------------------------------------------
// API (queries and mutations)
// ---------------------------------------------------------------------------

export {
  activityKeys,
  useWorkspaceActivity,
  useNoteActivity,
  useFollowStatus,
  useFollowNote,
  useUnfollowNote,
  selectFlatActivities,
  selectActivityTotal,
} from './api/activity.queries';
