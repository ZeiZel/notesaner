'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';

interface RegisterFormState {
  errors: {
    displayName?: string;
    email?: string;
    password?: string;
    general?: string;
  } | null;
  success: boolean;
}

async function registerAction(
  _prevState: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const displayName = formData.get('displayName') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const errors: RegisterFormState['errors'] = {};

  if (!displayName || displayName.trim().length < 2) {
    errors.displayName = 'Name must be at least 2 characters.';
  }

  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (errors.displayName || errors.email || errors.password) {
    return { errors, success: false };
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName, email, password }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      return {
        errors: { general: data.message ?? 'Registration failed. Please try again.' },
        success: false,
      };
    }

    return { errors: null, success: true };
  } catch {
    return {
      errors: { general: 'Unable to connect to server. Please try again.' },
      success: false,
    };
  }
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover active:bg-primary-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Creating account…' : 'Create account'}
    </button>
  );
}

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, {
    errors: null,
    success: false,
  });

  if (state.success) {
    return (
      <div className="rounded-md bg-success-muted px-3 py-4 text-center">
        <p className="text-sm font-medium text-success">Account created!</p>
        <p className="mt-1 text-xs text-foreground-secondary">
          Check your email to verify your account.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="space-y-4">
      {state.errors?.general && (
        <div
          role="alert"
          className="rounded-md bg-destructive-muted px-3 py-2 text-sm text-destructive"
        >
          {state.errors.general}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="displayName" className="block text-sm font-medium text-foreground">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="name"
          required
          placeholder="Your name"
          aria-invalid={!!state.errors?.displayName}
          className="w-full rounded-md border border-input bg-background-input px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {state.errors?.displayName && (
          <p role="alert" className="text-xs text-destructive">
            {state.errors.displayName}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-sm font-medium text-foreground">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-invalid={!!state.errors?.email}
          className="w-full rounded-md border border-input bg-background-input px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {state.errors?.email && (
          <p role="alert" className="text-xs text-destructive">
            {state.errors.email}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-sm font-medium text-foreground">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="Min. 8 characters"
          aria-invalid={!!state.errors?.password}
          className="w-full rounded-md border border-input bg-background-input px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {state.errors?.password && (
          <p role="alert" className="text-xs text-destructive">
            {state.errors.password}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
