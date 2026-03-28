'use client';

/**
 * WorkspaceSettings — workspace name, slug, and auth provider configuration.
 *
 * Admin-only section.  Reads the current workspace from URL params.
 * Uses React 19 useActionState for form — no useEffect.
 */

import { useActionState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkspaceFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'name' | 'slug', string>>;
}

// ---------------------------------------------------------------------------
// Save action
// ---------------------------------------------------------------------------

async function saveWorkspaceAction(
  _prev: WorkspaceFormState,
  formData: FormData,
): Promise<WorkspaceFormState> {
  const name = (formData.get('name') as string | null)?.trim() ?? '';
  const slug = (formData.get('slug') as string | null)?.trim() ?? '';

  const errors: WorkspaceFormState['errors'] = {};

  if (!name) errors.name = 'Workspace name is required.';
  if (!slug) {
    errors.slug = 'Slug is required.';
  } else if (!/^[a-z0-9-]+$/.test(slug)) {
    errors.slug = 'Slug may only contain lowercase letters, numbers and hyphens.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  // TODO: call apiClient.patch(`/api/workspaces/${workspaceId}`, { name, slug }, { token })
  await new Promise((r) => setTimeout(r, 400));
  return { success: true, message: 'Workspace settings saved.', errors: {} };
}

// ---------------------------------------------------------------------------
// WorkspaceSettings
// ---------------------------------------------------------------------------

export function WorkspaceSettings() {
  const [state, formAction, isPending] = useActionState<WorkspaceFormState, FormData>(
    saveWorkspaceAction,
    { success: false, message: '', errors: {} },
  );

  return (
    <div className="space-y-8 max-w-lg">
      {/* General */}
      <section>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--ns-color-foreground)' }}>
          General
        </h3>
        <form action={formAction} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <label
              htmlFor="ws-name"
              className="text-sm font-medium"
              style={{ color: 'var(--ns-color-foreground)' }}
            >
              Workspace name
            </label>
            <input
              id="ws-name"
              name="name"
              type="text"
              placeholder="My Workspace"
              disabled={isPending}
              className="w-full rounded-md px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--ns-color-background-input)',
                border: `1px solid ${state.errors.name ? 'var(--ns-color-destructive)' : 'var(--ns-color-input)'}`,
                color: 'var(--ns-color-foreground)',
              }}
            />
            {state.errors.name && (
              <p className="text-xs" style={{ color: 'var(--ns-color-destructive)' }}>
                {state.errors.name}
              </p>
            )}
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label
              htmlFor="ws-slug"
              className="text-sm font-medium"
              style={{ color: 'var(--ns-color-foreground)' }}
            >
              Slug
            </label>
            <div className="flex items-center gap-2">
              <span
                className="text-sm shrink-0"
                style={{ color: 'var(--ns-color-foreground-muted)' }}
              >
                /workspaces/
              </span>
              <input
                id="ws-slug"
                name="slug"
                type="text"
                placeholder="my-workspace"
                disabled={isPending}
                pattern="[a-z0-9-]+"
                className="flex-1 rounded-md px-3 py-2 text-sm font-mono"
                style={{
                  backgroundColor: 'var(--ns-color-background-input)',
                  border: `1px solid ${state.errors.slug ? 'var(--ns-color-destructive)' : 'var(--ns-color-input)'}`,
                  color: 'var(--ns-color-foreground)',
                }}
              />
            </div>
            {state.errors.slug && (
              <p className="text-xs" style={{ color: 'var(--ns-color-destructive)' }}>
                {state.errors.slug}
              </p>
            )}
            <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
              Only lowercase letters, numbers, and hyphens. Cannot be changed after creation.
            </p>
          </div>

          {state.message && (
            <p
              className="text-sm"
              style={{
                color: state.success ? 'var(--ns-color-success)' : 'var(--ns-color-destructive)',
              }}
            >
              {state.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isPending}
            className="h-9 px-4 rounded-md text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: 'var(--ns-color-primary)',
              color: 'var(--ns-color-primary-foreground)',
            }}
          >
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      {/* Auth providers */}
      <section>
        <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--ns-color-foreground)' }}>
          Authentication providers
        </h3>
        <p className="text-xs mb-3" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          Configure SAML or OIDC providers for this workspace. Changes require a server restart.
        </p>
        <div
          className="rounded-lg border p-4"
          style={{
            borderColor: 'var(--ns-color-border)',
            backgroundColor: 'var(--ns-color-background-surface)',
          }}
        >
          {/* Provider rows */}
          {[
            { id: 'saml', label: 'SAML 2.0', description: 'Keycloak, Authentik, Okta' },
            { id: 'oidc', label: 'OIDC', description: 'Google, GitHub, custom IdP' },
          ].map((provider) => (
            <div
              key={provider.id}
              className="flex items-center justify-between py-2.5 border-b last:border-0"
              style={{ borderColor: 'var(--ns-color-border)' }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
                  {provider.label}
                </p>
                <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
                  {provider.description}
                </p>
              </div>
              <button
                type="button"
                className="text-xs px-3 py-1.5 rounded-md"
                style={{
                  backgroundColor: 'var(--ns-color-background)',
                  border: '1px solid var(--ns-color-border)',
                  color: 'var(--ns-color-foreground-secondary)',
                }}
              >
                Configure
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Danger zone */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--ns-color-destructive)' }}>
          Danger zone
        </h3>
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{ borderColor: 'var(--ns-color-destructive)' }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--ns-color-foreground)' }}>
                Delete workspace
              </p>
              <p className="text-xs" style={{ color: 'var(--ns-color-foreground-muted)' }}>
                Permanently delete this workspace and all its notes.
              </p>
            </div>
            <button
              type="button"
              className="px-3 py-1.5 text-sm rounded-md font-medium"
              style={{
                backgroundColor: 'var(--ns-color-destructive)',
                color: 'var(--ns-color-destructive-foreground)',
              }}
            >
              Delete workspace
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
