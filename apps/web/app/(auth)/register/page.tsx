import type { Metadata } from 'next';
import { RegisterPage } from '@/pages/register';

export const metadata: Metadata = {
  title: 'Create account',
};

/**
 * Register route — thin wrapper that delegates to the RegisterPage composition.
 */
export default function RegisterRoute() {
  return <RegisterPage />;
}
