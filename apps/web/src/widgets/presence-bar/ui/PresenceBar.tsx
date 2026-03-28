'use client';

/**
 * PresenceBar -- widget showing active viewers at the top of the editor.
 *
 * Renders a compact bar with:
 *   - Avatar thumbnails of active editors (max 5, + overflow count)
 *   - Tooltip on each avatar: name, status, cursor position description
 *   - Online/offline connection status indicator
 *
 * Usage:
 *   Place this widget above the editor content area.
 *   It reads presence data from the presence store (Zustand).
 *
 * Design decisions:
 *   - No useEffect -- all display state is derived from the store.
 *   - Uses Ant Design Space, Divider, and Badge components.
 *   - PresenceIndicator (from features/editor) handles the avatar stack.
 *   - Connection status shown as a subtle badge in the bar.
 */

import { Space, Badge, Typography } from 'antd';
import { cn } from '@/shared/lib/utils';
import { usePresenceStore, selectUsersOnNote } from '@/shared/stores/presence-store';
import { PresenceIndicator } from '@/features/editor/ui/PresenceIndicator';
import type { PresenceAvatarUser } from '@/features/editor/ui/PresenceAvatar';

const { Text } = Typography;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PresenceBarProps {
  /** The note ID to show presence for. */
  noteId: string;
  /** Maximum avatars before overflow. Defaults to 5. */
  maxAvatars?: number;
  /** Additional CSS class names. */
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PresenceBar({ noteId, maxAvatars = 5, className }: PresenceBarProps) {
  const users = usePresenceStore((state) => selectUsersOnNote(state, noteId));
  const isConnected = usePresenceStore((state) => state.isConnected);

  // Map store users to PresenceAvatarUser shape
  const avatarUsers: PresenceAvatarUser[] = users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    color: u.color,
    status: u.status,
    cursorDescription: u.cursorDescription,
  }));

  // Don't render the bar when there are no other users
  if (avatarUsers.length === 0 && isConnected) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-3 py-1.5 border-b border-border bg-background-surface',
        className,
      )}
      role="status"
      aria-label="Note presence"
    >
      <Space size={8} align="center">
        {/* Connection status */}
        <Badge
          status={isConnected ? 'success' : 'error'}
          text={
            <Text type="secondary" className="text-[11px]">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          }
        />

        {/* Separator when users are present */}
        {avatarUsers.length > 0 && <div className="h-4 w-px bg-border" aria-hidden="true" />}

        {/* Active viewers count */}
        {avatarUsers.length > 0 && (
          <Text type="secondary" className="text-[11px]">
            {avatarUsers.length} editing
          </Text>
        )}
      </Space>

      {/* Avatar stack */}
      {avatarUsers.length > 0 && (
        <PresenceIndicator users={avatarUsers} maxAvatars={maxAvatars} avatarSize={26} />
      )}
    </div>
  );
}

PresenceBar.displayName = 'PresenceBar';
