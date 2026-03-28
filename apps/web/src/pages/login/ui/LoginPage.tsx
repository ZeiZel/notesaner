import Link from 'next/link';
import { LoginForm } from './LoginForm';

/**
 * Login page composition.
 *
 * Server Component — renders the card shell and delegates the interactive
 * form to a Client Component (LoginForm).
 */
export function LoginPage() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-6 shadow-lg"
      style={{ boxShadow: 'var(--ns-shadow-lg)' }}
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold text-card-foreground">Sign in</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      <LoginForm />

      {/* Divider */}
      <div className="my-5 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-foreground-muted">or continue with</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* SSO button */}
      <button
        type="button"
        className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background-elevated px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4 text-foreground-secondary"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
        Continue with SSO
      </button>

      {/* Register link */}
      <p className="mt-5 text-center text-sm text-foreground-secondary">
        Don&apos;t have an account?{' '}
        <Link
          href="/register"
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Create account
        </Link>
      </p>
    </div>
  );
}
