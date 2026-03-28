/**
 * Re-exported from @notesaner/utils — the canonical source of truth for cn().
 */
export { cn } from '@notesaner/utils';

/**
 * Formats a date using the user's locale.
 */
export function formatDate(
  date: Date | string | number,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    ...options,
  }).format(new Date(date));
}

/**
 * Formats a relative time string (e.g. "3 minutes ago").
 */
export function formatRelativeTime(date: Date | string | number): string {
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const diff = new Date(date).getTime() - Date.now();
  const diffSeconds = Math.round(diff / 1000);
  const diffMinutes = Math.round(diffSeconds / 60);
  const diffHours = Math.round(diffMinutes / 60);
  const diffDays = Math.round(diffHours / 24);

  if (Math.abs(diffSeconds) < 60) return rtf.format(diffSeconds, 'second');
  if (Math.abs(diffMinutes) < 60) return rtf.format(diffMinutes, 'minute');
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(diffDays, 'day');
}

/**
 * Creates a debounced version of a function.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Truncates a string to the given length, appending an ellipsis if truncated.
 */
export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return `${str.slice(0, length)}...`;
}

/**
 * Converts a file path to a display name (last segment, without extension).
 */
export function pathToDisplayName(path: string): string {
  const segment = path.split('/').pop() ?? path;
  return segment.replace(/\.[^.]+$/, '');
}

/**
 * Generates a random hex color from the Catppuccin Mocha palette.
 * Used for presence cursor colors.
 */
const CURSOR_COLORS = [
  '#cba6f7', // mauve
  '#89b4fa', // blue
  '#a6e3a1', // green
  '#fab387', // peach
  '#f38ba8', // red
  '#89dceb', // sky
  '#f5c2e7', // pink
  '#94e2d5', // teal
  '#f9e2af', // yellow
] as const;

export function getPresenceColor(userId: string): string {
  const index = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CURSOR_COLORS[index % CURSOR_COLORS.length] ?? CURSOR_COLORS[0];
}
