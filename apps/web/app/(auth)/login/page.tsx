import type { Metadata } from 'next';
import { LoginPage } from '@/pages/login';

export const metadata: Metadata = {
  title: 'Sign in',
};

/**
 * Login route — thin wrapper that delegates to the LoginPage composition.
 */
export default function LoginRoute() {
  return <LoginPage />;
}
