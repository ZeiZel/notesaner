'use client';

/**
 * InviteMemberForm — email invite form with role selector.
 *
 * Features:
 *   - Email input with inline format validation
 *   - Role selector (VIEWER / EDITOR / ADMIN)
 *   - Submit calls the passed onInvite callback
 *   - Shows error message from server (e.g., already a member)
 *   - Loading state on submit button
 *
 * Usage:
 *   <InviteMemberForm
 *     workspaceId={workspaceId}
 *     onInvite={handleInvite}
 *   />
 */

import { useState, useId, type FormEvent } from 'react';
import type { MemberRole, InviteMemberPayload } from '../model/members-store';
import { getRoleLabel } from './RoleBadge';

// ─── Types ─────────────────────────────────────────────────────────────────

interface InviteMemberFormProps {
  /** Whether the invite action is in progress. */
  isPending: boolean;
  /** Server-level error message (e.g., "User is already a member"). */
  serverError?: string | null;
  /** Called with the validated email + role when the user submits. */
  onInvite: (payload: InviteMemberPayload) => void;
}

// ─── Available roles for invitation ──────────────────────────────────────

const INVITE_ROLES: MemberRole[] = ['VIEWER', 'EDITOR', 'ADMIN'];

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  OWNER: 'Full control',
  ADMIN: 'Can manage members and settings',
  EDITOR: 'Can create and edit notes',
  VIEWER: 'Can view notes only',
};

// ─── Email validation ──────────────────────────────────────────────────────

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

// ─── InviteMemberForm ──────────────────────────────────────────────────────

export function InviteMemberForm({ isPending, serverError, onInvite }: InviteMemberFormProps) {
  const emailId = useId();
  const roleId = useId();

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<MemberRole>('EDITOR');
  const [emailError, setEmailError] = useState<string | null>(null);

  function validate(): boolean {
    if (!email.trim()) {
      setEmailError('Email address is required');
      return false;
    }
    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email address');
      return false;
    }
    setEmailError(null);
    return true;
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate() || isPending) return;
    onInvite({ email: email.trim().toLowerCase(), role });
    // Clear form on submit — parent will handle success/error UI
    setEmail('');
    setEmailError(null);
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-label="Invite a new member">
      <div className="rounded-lg border border-border bg-background-surface p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Invite member</h3>

        {/* Email + role row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          {/* Email input */}
          <div className="flex-1 min-w-0">
            <label
              htmlFor={emailId}
              className="mb-1 block text-xs font-medium text-foreground-secondary"
            >
              Email address
            </label>
            <input
              id={emailId}
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError(null);
              }}
              onBlur={() => {
                if (email) validate();
              }}
              placeholder="colleague@example.com"
              disabled={isPending}
              autoComplete="email"
              aria-invalid={emailError !== null}
              aria-describedby={emailError ? `${emailId}-error` : undefined}
              className={[
                'w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground',
                'placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring',
                'disabled:opacity-50 transition-colors',
                emailError ? 'border-destructive focus:ring-destructive/50' : 'border-border',
              ].join(' ')}
            />
            {emailError && (
              <p id={`${emailId}-error`} role="alert" className="mt-1 text-xs text-destructive">
                {emailError}
              </p>
            )}
          </div>

          {/* Role selector */}
          <div className="sm:w-36">
            <label
              htmlFor={roleId}
              className="mb-1 block text-xs font-medium text-foreground-secondary"
            >
              Role
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value as MemberRole)}
              disabled={isPending}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            >
              {INVITE_ROLES.map((r) => (
                <option key={r} value={r} title={ROLE_DESCRIPTIONS[r]}>
                  {getRoleLabel(r)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Role description hint */}
        <p className="text-xs text-foreground-muted" aria-live="polite">
          {ROLE_DESCRIPTIONS[role]}
        </p>

        {/* Server error */}
        {serverError && (
          <p role="alert" className="text-xs text-destructive">
            {serverError}
          </p>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isPending || !email.trim()}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Sending invite...' : 'Send invite'}
        </button>
      </div>
    </form>
  );
}
