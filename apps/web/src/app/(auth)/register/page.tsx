import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './RegisterForm';

export const metadata: Metadata = {
  title: 'Create account',
};

export default function RegisterPage() {
  return (
    <div
      className="rounded-xl border border-border bg-card p-6 shadow-lg"
      style={{ boxShadow: 'var(--ns-shadow-lg)' }}
    >
      <div className="mb-6">
        <h1 className="text-xl font-bold text-card-foreground">Create account</h1>
        <p className="mt-1 text-sm text-foreground-secondary">
          Start your Notesaner workspace today.
        </p>
      </div>

      <RegisterForm />

      <p className="mt-5 text-center text-sm text-foreground-secondary">
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-medium text-primary transition-colors hover:text-primary-hover"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}
