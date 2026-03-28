'use client';

/**
 * MembersList — table-style list of workspace members.
 *
 * Displays: avatar, display name, email, role badge, joined date,
 * last active date, role change dropdown, remove button.
 *
 * Respects role permissions:
 *   - Only OWNER/ADMIN see the role dropdown and remove button.
 *   - OWNERs cannot be removed.
 *   - The current user cannot remove themselves.
 *
 * Usage:
 *   <MembersList
 *     members={members}
 *     currentUserId={currentUser.id}
 *     currentUserRole="ADMIN"
 *     removingIds={removingIds}
 *     onChangeRole={handleChangeRole}
 *     onRemove={handleRemove}
 *   />
 */

import type { WorkspaceMember, MemberRole } from '../model/members-store';
import { canChangeRole, canRemoveMember } from '../model/members-store';
import { RoleBadge } from './RoleBadge';

// ─── Types ─────────────────────────────────────────────────────────────────

interface MembersListProps {
  members: WorkspaceMember[];
  currentUserId: string;
  currentUserRole: MemberRole | null;
  removingIds: Set<string>;
  onChangeRole: (memberId: string, newRole: MemberRole) => void;
  onRemove: (member: WorkspaceMember) => void;
}

// ─── Role options for the dropdown ─────────────────────────────────────────

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = [
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'EDITOR', label: 'Editor' },
  { value: 'ADMIN', label: 'Admin' },
];

// ─── Date formatting ───────────────────────────────────────────────────────

function formatDate(isoString: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(isoString));
}

function formatRelativeDate(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

// ─── Inline icons ──────────────────────────────────────────────────────────

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
      <path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z" />
      <path
        fillRule="evenodd"
        d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1zM4.118 4L4 4.059V13a1 1 0 001 1h6a1 1 0 001-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"
      />
    </svg>
  );
}

// ─── Avatar component ──────────────────────────────────────────────────────

function MemberAvatar({
  displayName,
  avatarUrl,
  size = 8,
}: {
  displayName: string;
  avatarUrl: string | null;
  size?: number;
}) {
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => (part[0] ?? '').toUpperCase())
    .join('');

  const sizeClass = `h-${size} w-${size}`;

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt={displayName} className={`${sizeClass} rounded-full object-cover`} />
    );
  }

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold select-none`}
      aria-label={displayName}
    >
      {initials}
    </div>
  );
}

// ─── Member row ────────────────────────────────────────────────────────────

interface MemberRowProps {
  member: WorkspaceMember;
  currentUserId: string;
  currentUserRole: MemberRole | null;
  isRemoving: boolean;
  onChangeRole: (newRole: MemberRole) => void;
  onRemove: () => void;
}

function MemberRow({
  member,
  currentUserId,
  currentUserRole,
  isRemoving,
  onChangeRole,
  onRemove,
}: MemberRowProps) {
  const isCurrentUser = member.userId === currentUserId;
  const canChange = canChangeRole(currentUserRole, member.role);
  const canRemove = canRemoveMember(currentUserRole, member.role, currentUserId, member.userId);

  return (
    <div
      data-testid={`member-row-${member.id}`}
      className="flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-background-hover"
      aria-label={`Member: ${member.user.displayName}`}
    >
      {/* Avatar */}
      <MemberAvatar
        displayName={member.user.displayName}
        avatarUrl={member.user.avatarUrl}
        size={9}
      />

      {/* Name + email */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">{member.user.displayName}</span>
          {isCurrentUser && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-xs text-primary font-medium">
              You
            </span>
          )}
        </div>
        <p className="truncate text-xs text-foreground-muted">{member.user.email}</p>
      </div>

      {/* Role badge / dropdown */}
      <div className="shrink-0">
        {canChange ? (
          <select
            value={member.role}
            onChange={(e) => onChangeRole(e.target.value as MemberRole)}
            disabled={isRemoving}
            aria-label={`Change role for ${member.user.displayName}`}
            className="rounded-md border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors cursor-pointer"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <RoleBadge role={member.role} />
        )}
      </div>

      {/* Joined date */}
      <div
        className="hidden shrink-0 sm:block text-right"
        title={`Joined: ${formatDate(member.joinedAt)}`}
      >
        <span className="text-xs text-foreground-muted">{formatDate(member.joinedAt)}</span>
      </div>

      {/* Last active */}
      <div
        className="hidden shrink-0 md:block text-right"
        title={
          member.lastActiveAt ? `Last active: ${formatDate(member.lastActiveAt)}` : 'Never active'
        }
      >
        <span className="text-xs text-foreground-muted">
          {member.lastActiveAt ? formatRelativeDate(member.lastActiveAt) : '—'}
        </span>
      </div>

      {/* Remove button */}
      <div className="shrink-0 w-8">
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            disabled={isRemoving}
            title={`Remove ${member.user.displayName}`}
            aria-label={`Remove ${member.user.displayName} from workspace`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-destructive/10 hover:text-destructive focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-40 transition-colors"
          >
            {isRemoving ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-foreground-muted border-t-transparent" />
            ) : (
              <TrashIcon className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MembersList ───────────────────────────────────────────────────────────

export function MembersList({
  members,
  currentUserId,
  currentUserRole,
  removingIds,
  onChangeRole,
  onRemove,
}: MembersListProps) {
  if (members.length === 0) {
    return <div className="py-8 text-center text-sm text-foreground-muted">No members found.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Column headers */}
      <div className="hidden items-center gap-3 border-b border-border bg-background-surface px-4 py-2 text-xs font-medium text-foreground-secondary sm:flex">
        <div className="w-9" aria-hidden="true" />
        <div className="flex-1">Member</div>
        <div className="w-24 shrink-0">Role</div>
        <div className="hidden shrink-0 w-28 sm:block">Joined</div>
        <div className="hidden shrink-0 w-20 md:block">Last active</div>
        <div className="shrink-0 w-8" aria-hidden="true" />
      </div>

      {/* Member rows */}
      <div role="list" aria-label="Workspace members">
        {members.map((member) => (
          <div key={member.id} role="listitem">
            <MemberRow
              member={member}
              currentUserId={currentUserId}
              currentUserRole={currentUserRole}
              isRemoving={removingIds.has(member.id)}
              onChangeRole={(newRole) => onChangeRole(member.id, newRole)}
              onRemove={() => onRemove(member)}
            />
          </div>
        ))}
      </div>

      {/* Footer: count */}
      <div className="border-t border-border bg-background-surface px-4 py-2">
        <p className="text-xs text-foreground-muted">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
