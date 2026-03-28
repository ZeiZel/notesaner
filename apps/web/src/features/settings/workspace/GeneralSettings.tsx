'use client';

/**
 * GeneralSettings — workspace name, description, slug, and icon.
 *
 * Uses React 19 useActionState for form submission -- no useEffect for
 * form state synchronization. The form reads initial values from the
 * workspace settings store and submits via the API client.
 *
 * Auto-save is intentionally NOT used here because slug changes are
 * destructive. Explicit save button required.
 */

import { useActionState, useState, useId } from 'react';
import { useParams } from 'next/navigation';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceSettingsStore } from './workspace-settings-store';
import { workspaceSettingsApi } from '@/shared/api/workspace-settings';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GeneralFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'name' | 'slug' | 'description', string>>;
}

// ---------------------------------------------------------------------------
// Save action
// ---------------------------------------------------------------------------

async function saveGeneralAction(
  _prev: GeneralFormState,
  formData: FormData,
): Promise<GeneralFormState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';
  const description = (formData.get('description') as string | null)?.trim() ?? '';
  const workspaceId = formData.get('workspaceId') as string;
  const token = formData.get('token') as string;

  const errors: GeneralFormState['errors'] = {};

  if (!name) errors.name = 'Workspace name is required.';
  if (name.length > 64) errors.name = 'Name must be 64 characters or fewer.';

  if (!slug) {
    errors.slug = 'Slug is required.';
  } else if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
    errors.slug =
      'Slug may only contain lowercase letters, numbers, and hyphens. Must start and end with a letter or number.';
  } else if (slug.length < 2) {
    errors.slug = 'Slug must be at least 2 characters.';
  } else if (slug.length > 48) {
    errors.slug = 'Slug must be 48 characters or fewer.';
  }

  if (description.length > 500) {
    errors.description = 'Description must be 500 characters or fewer.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  try {
    await workspaceSettingsApi.updateGeneral(token, workspaceId, {
      name,
      slug,
      description: description || null,
    });
    return { success: true, message: 'Settings saved.', errors: {} };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save settings.';
    return { success: false, message, errors: {} };
  }
}

// ---------------------------------------------------------------------------
// GeneralSettings
// ---------------------------------------------------------------------------

export function GeneralSettings() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params?.workspaceId ?? '';
  const accessToken = useAuthStore((s) => s.accessToken);
  const settings = useWorkspaceSettingsStore((s) => s.settings);

  const nameId = useId();
  const slugId = useId();
  const descId = useId();
  const iconId = useId();

  const [_iconPreview] = useState<string | null>(settings?.iconUrl ?? null);

  const [state, formAction, isPending] = useActionState<GeneralFormState, FormData>(
    saveGeneralAction,
    { success: false, message: '', errors: {} },
  );

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-foreground">General</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Workspace name, description, and URL slug.
        </p>
      </div>

      <form action={formAction} className="space-y-6 max-w-lg">
        {/* Hidden fields for the action */}
        <input type="hidden" name="workspaceId" value={workspaceId} />
        <input type="hidden" name="token" value={accessToken ?? ''} />

        {/* Icon */}
        <div className="space-y-2">
          <label htmlFor={iconId} className="text-sm font-medium text-foreground">
            Workspace icon
          </label>
          <div className="flex items-center gap-4">
            <div
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-border bg-background-surface text-2xl font-bold text-foreground-muted"
              aria-hidden="true"
            >
              {_iconPreview ? (
                <img
                  src={_iconPreview}
                  alt="Workspace icon"
                  className="h-full w-full rounded-xl object-cover"
                />
              ) : (
                (settings?.name?.[0]?.toUpperCase() ?? 'W')
              )}
            </div>
            <div>
              <button
                type="button"
                id={iconId}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground-secondary hover:bg-secondary transition-colors"
                onClick={() => {
                  // TODO: open file picker / icon chooser
                }}
              >
                Change icon
              </button>
              <p className="mt-1 text-xs text-foreground-muted">
                Recommended: 256x256px, PNG or SVG
              </p>
            </div>
          </div>
        </div>

        {/* Name */}
        <div className="space-y-1.5">
          <label htmlFor={nameId} className="text-sm font-medium text-foreground">
            Workspace name
          </label>
          <input
            id={nameId}
            name="name"
            type="text"
            defaultValue={settings?.name ?? ''}
            placeholder="My Workspace"
            disabled={isPending}
            maxLength={64}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            style={state.errors.name ? { borderColor: 'var(--ns-color-destructive)' } : undefined}
          />
          {state.errors.name && (
            <p className="text-xs text-destructive" role="alert">
              {state.errors.name}
            </p>
          )}
        </div>

        {/* Slug */}
        <div className="space-y-1.5">
          <label htmlFor={slugId} className="text-sm font-medium text-foreground">
            URL slug
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-foreground-muted shrink-0">/workspaces/</span>
            <input
              id={slugId}
              name="slug"
              type="text"
              defaultValue={settings?.slug ?? ''}
              placeholder="my-workspace"
              disabled={isPending}
              maxLength={48}
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
              style={state.errors.slug ? { borderColor: 'var(--ns-color-destructive)' } : undefined}
            />
          </div>
          {state.errors.slug && (
            <p className="text-xs text-destructive" role="alert">
              {state.errors.slug}
            </p>
          )}
          <p className="text-xs text-foreground-muted">
            Only lowercase letters, numbers, and hyphens. Changing the slug may break existing
            links.
          </p>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor={descId} className="text-sm font-medium text-foreground">
            Description
          </label>
          <textarea
            id={descId}
            name="description"
            rows={3}
            defaultValue={settings?.description ?? ''}
            placeholder="A short description of this workspace..."
            disabled={isPending}
            maxLength={500}
            className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            style={
              state.errors.description ? { borderColor: 'var(--ns-color-destructive)' } : undefined
            }
          />
          {state.errors.description && (
            <p className="text-xs text-destructive" role="alert">
              {state.errors.description}
            </p>
          )}
          <p className="text-xs text-foreground-muted">
            Visible to all workspace members. Max 500 characters.
          </p>
        </div>

        {/* Status message */}
        {state.message && (
          <p
            className="text-sm"
            role="status"
            style={{
              color: state.success ? 'var(--ns-color-success)' : 'var(--ns-color-destructive)',
            }}
          >
            {state.message}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Saving...' : 'Save changes'}
        </button>
      </form>
    </div>
  );
}
