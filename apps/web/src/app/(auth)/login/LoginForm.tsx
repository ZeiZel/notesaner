'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import Link from 'next/link';

interface LoginFormState {
  errors: {
    email?: string;
    password?: string;
    general?: string;
  } | null;
  success: boolean;
}

async function loginAction(
  _prevState: LoginFormState,
  formData: FormData,
): Promise<LoginFormState> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  // Client-side validation
  const errors: LoginFormState['errors'] = {};

  if (!email || !email.includes('@')) {
    errors.email = 'Please enter a valid email address.';
  }

  if (!password || password.length < 8) {
    errors.password = 'Password must be at least 8 characters.';
  }

  if (errors.email || errors.password) {
    return { errors, success: false };
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const data = (await response.json()) as { message?: string };
      return {
        errors: { general: data.message ?? 'Invalid credentials. Please try again.' },
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
      {pending ? (
        <>
          <svg
            className="mr-2 h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </button>
  );
}

/**
 * Login form using React 19 useActionState.
 * No useEffect — form state is managed by the action pattern.
 */
export function LoginForm() {
  const [state, formAction] = useActionState(loginAction, {
    errors: null,
    success: false,
  });

  return (
    <form action={formAction} noValidate className="space-y-4">
      {/* General error */}
      {state.errors?.general && (
        <div
          role="alert"
          className="rounded-md bg-destructive-muted px-3 py-2 text-sm text-destructive"
        >
          {state.errors.general}
        </div>
      )}

      {/* Email field */}
      <div className="space-y-1.5">
        <label
          htmlFor="email"
          className="block text-sm font-medium text-foreground"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
          aria-describedby={state.errors?.email ? 'email-error' : undefined}
          aria-invalid={!!state.errors?.email}
          className="w-full rounded-md border border-input bg-background-input px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-ring-error"
          style={
            state.errors?.email
              ? { borderColor: 'var(--ns-color-destructive)' }
              : undefined
          }
        />
        {state.errors?.email && (
          <p id="email-error" role="alert" className="text-xs text-destructive">
            {state.errors.email}
          </p>
        )}
      </div>

      {/* Password field */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-foreground"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-foreground-secondary transition-colors hover:text-primary"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          aria-describedby={state.errors?.password ? 'password-error' : undefined}
          aria-invalid={!!state.errors?.password}
          className="w-full rounded-md border border-input bg-background-input px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={
            state.errors?.password
              ? { borderColor: 'var(--ns-color-destructive)' }
              : undefined
          }
        />
        {state.errors?.password && (
          <p id="password-error" role="alert" className="text-xs text-destructive">
            {state.errors.password}
          </p>
        )}
      </div>

      <SubmitButton />
    </form>
  );
}
