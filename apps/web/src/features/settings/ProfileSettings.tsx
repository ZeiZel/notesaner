'use client';

/**
 * ProfileSettings — user profile editing form.
 *
 * Fields: display name, email, avatar upload (file → base64 preview).
 * Uses React 19 useActionState for form submission — no useEffect.
 */

import { useActionState, useRef, useState } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileFormState {
  success: boolean;
  message: string;
  errors: Partial<Record<'displayName' | 'email', string>>;
}

// ---------------------------------------------------------------------------
// Fake server action (replace with real API call when auth store is available)
// ---------------------------------------------------------------------------

async function saveProfileAction(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const displayName = (formData.get('displayName') as string | null)?.trim() ?? '';
  const email = (formData.get('email') as string | null)?.trim() ?? '';

  const errors: ProfileFormState['errors'] = {};

  if (!displayName) errors.displayName = 'Display name is required.';
  if (!email) {
    errors.email = 'Email is required.';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Enter a valid email address.';
  }

  if (Object.keys(errors).length > 0) {
    return { success: false, message: '', errors };
  }

  // TODO: call apiClient.patch('/api/users/me', { displayName, email }, { token })
  await new Promise((r) => setTimeout(r, 400)); // simulate network
  return { success: true, message: 'Profile updated successfully.', errors: {} };
}

// ---------------------------------------------------------------------------
// Avatar preview component
// ---------------------------------------------------------------------------

interface AvatarPreviewProps {
  src: string | null;
  displayName: string;
  onChange: (dataUrl: string) => void;
}

function AvatarPreview({ src, displayName, onChange }: AvatarPreviewProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const initials = displayName
    .split(' ')
    .map((w) => w[0] ?? '')
    .slice(0, 2)
    .join('')
    .toUpperCase();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === 'string') onChange(result);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change avatar"
        className="relative h-16 w-16 rounded-full overflow-hidden ring-2 ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-primary transition-shadow hover:ring-primary"
        style={{
          backgroundColor: 'var(--ns-color-primary)',
          color: 'var(--ns-color-primary-foreground)',
        }}
      >
        {src ? (
          <img src={src} alt="Avatar" className="h-full w-full object-cover" />
        ) : (
          <span className="text-lg font-semibold">{initials || '?'}</span>
        )}
        {/* Overlay hint */}
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs"
          aria-hidden="true"
        >
          Edit
        </span>
      </button>
      <div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="text-sm font-medium"
          style={{ color: 'var(--ns-color-primary)' }}
        >
          Upload photo
        </button>
        <p className="text-xs mt-0.5" style={{ color: 'var(--ns-color-foreground-muted)' }}>
          JPG, PNG or GIF. Max 2 MB.
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={handleFileChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProfileSettings
// ---------------------------------------------------------------------------

export function ProfileSettings() {
  // In a real app these would come from an auth store / server component
  const [displayName, setDisplayName] = useState('');
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);

  const [state, formAction, isPending] = useActionState<ProfileFormState, FormData>(
    saveProfileAction,
    { success: false, message: '', errors: {} },
  );

  return (
    <div className="space-y-6 max-w-lg">
      <AvatarPreview src={avatarSrc} displayName={displayName} onChange={setAvatarSrc} />

      <form action={formAction} className="space-y-4">
        {/* Display name */}
        <div className="space-y-1.5">
          <label
            htmlFor="settings-displayName"
            className="text-sm font-medium"
            style={{ color: 'var(--ns-color-foreground)' }}
          >
            Display name
          </label>
          <input
            id="settings-displayName"
            name="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name"
            disabled={isPending}
            autoComplete="name"
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--ns-color-background-input)',
              border: `1px solid ${state.errors.displayName ? 'var(--ns-color-destructive)' : 'var(--ns-color-input)'}`,
              color: 'var(--ns-color-foreground)',
            }}
          />
          {state.errors.displayName && (
            <p className="text-xs" style={{ color: 'var(--ns-color-destructive)' }}>
              {state.errors.displayName}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="settings-email"
            className="text-sm font-medium"
            style={{ color: 'var(--ns-color-foreground)' }}
          >
            Email address
          </label>
          <input
            id="settings-email"
            name="email"
            type="email"
            placeholder="you@example.com"
            disabled={isPending}
            autoComplete="email"
            className="w-full rounded-md px-3 py-2 text-sm"
            style={{
              backgroundColor: 'var(--ns-color-background-input)',
              border: `1px solid ${state.errors.email ? 'var(--ns-color-destructive)' : 'var(--ns-color-input)'}`,
              color: 'var(--ns-color-foreground)',
            }}
          />
          {state.errors.email && (
            <p className="text-xs" style={{ color: 'var(--ns-color-destructive)' }}>
              {state.errors.email}
            </p>
          )}
        </div>

        {/* Feedback */}
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
    </div>
  );
}
