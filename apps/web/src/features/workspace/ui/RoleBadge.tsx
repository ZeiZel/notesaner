'use client';

/**
 * RoleBadge — colored badge for workspace member roles.
 *
 * Colors:
 *   OWNER  — violet (distinguished, highest privilege)
 *   ADMIN  — amber  (elevated, can manage members)
 *   EDITOR — blue   (standard contributor)
 *   VIEWER — gray   (read-only)
 *
 * Usage:
 *   <RoleBadge role="ADMIN" />
 *   <RoleBadge role="EDITOR" size="sm" />
 */

import type { MemberRole } from '../model/members-store';

// ─── Types ─────────────────────────────────────────────────────────────────

interface RoleBadgeProps {
  role: MemberRole;
  size?: 'sm' | 'md';
  className?: string;
}

// ─── Role config ───────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<MemberRole, { label: string; className: string }> = {
  OWNER: {
    label: 'Owner',
    className:
      'bg-violet-500/15 text-violet-700 border-violet-300 dark:text-violet-300 dark:border-violet-600',
  },
  ADMIN: {
    label: 'Admin',
    className:
      'bg-amber-500/15 text-amber-700 border-amber-300 dark:text-amber-300 dark:border-amber-600',
  },
  EDITOR: {
    label: 'Editor',
    className:
      'bg-blue-500/15 text-blue-700 border-blue-300 dark:text-blue-300 dark:border-blue-600',
  },
  VIEWER: {
    label: 'Viewer',
    className: 'bg-foreground/5 text-foreground-secondary border-border',
  },
};

const SIZE_CLASSES: Record<'sm' | 'md', string> = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-0.5 text-sm',
};

// ─── RoleBadge ─────────────────────────────────────────────────────────────

export function RoleBadge({ role, size = 'sm', className = '' }: RoleBadgeProps) {
  const config = ROLE_CONFIG[role];

  return (
    <span
      className={[
        'inline-flex items-center rounded-full border font-medium leading-none',
        SIZE_CLASSES[size],
        config.className,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Role: ${config.label}`}
    >
      {config.label}
    </span>
  );
}

// Export role label helper for use in other components
export function getRoleLabel(role: MemberRole): string {
  return ROLE_CONFIG[role].label;
}
