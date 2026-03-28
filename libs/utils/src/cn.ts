import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind CSS class names with conflict resolution.
 * Uses clsx for conditional classes and tailwind-merge for deduplication.
 *
 * This is the canonical single source of truth for cn() across the monorepo.
 * All other packages re-export from here.
 *
 * @example
 * cn('px-4 py-2', condition && 'bg-primary', 'rounded-md')
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
