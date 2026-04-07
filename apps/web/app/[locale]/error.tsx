'use client';

import { useEffect } from 'react';
import { isDevelopment } from '@/shared/config/env';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Generates a short, human-readable error reference code from the error digest
 * or a random fallback. Used for support tickets and log correlation.
 */
function generateErrorCode(digest?: string): string {
  if (digest) {
    // Use first 8 chars of the digest for brevity
    return `NS-${digest.slice(0, 8).toUpperCase()}`;
  }
  // Fallback: timestamp-based code
  const ts = Date.now().toString(36).toUpperCase();
  return `NS-${ts.slice(-8)}`;
}

/**
 * Global error boundary page.
 *
 * Caught by Next.js App Router when an unhandled error occurs in a route.
 * Shows different levels of detail in development vs production:
 *   - Dev: full error message and stack trace
 *   - Prod: user-friendly message with error reference code for support
 */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const errorCode = generateErrorCode(error.digest);

  // Log error to console (and optionally to a backend monitoring endpoint).
  // useEffect is valid here: logging is a side effect that should not affect render.
  useEffect(() => {
    console.error('[Notesaner] Unhandled application error:', {
      message: error.message,
      digest: error.digest,
      errorCode,
      stack: error.stack,
    });

    // Optional: send to backend error tracking endpoint
    if (!isDevelopment) {
      void reportErrorToBackend(error, errorCode).catch(() => {
        // Silent fail — error reporting should never block the UI
      });
    }
  }, [error, errorCode]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background text-foreground">
      <div className="max-w-lg text-center">
        {/* Error icon */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive-muted">
          <svg
            className="h-8 w-8 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            />
          </svg>
        </div>

        <h1 className="text-xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-foreground-secondary">
          An unexpected error occurred. Your workspace data is safe.
        </p>

        {/* Error reference code (always shown) */}
        <p className="mt-3 text-xs text-foreground-muted">
          Error reference:{' '}
          <code className="rounded bg-background-elevated px-1.5 py-0.5 font-mono text-foreground-secondary">
            {errorCode}
          </code>
        </p>

        {/* Development mode: full error details */}
        {isDevelopment && (
          <div className="mt-4 text-left">
            <details open>
              <summary className="cursor-pointer text-xs font-medium text-foreground-secondary">
                Error details (development only)
              </summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-background-elevated p-3 text-left text-xs text-destructive">
                {error.message}
              </pre>
              {error.stack && (
                <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-background-elevated p-3 text-left text-2xs leading-relaxed text-foreground-muted">
                  {error.stack}
                </pre>
              )}
            </details>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Try again
          </button>

          <a
            href={`https://github.com/notesaner/notesaner/issues/new?title=${encodeURIComponent(`Error: ${errorCode}`)}&body=${encodeURIComponent(`## Error Report\n\n**Error code**: ${errorCode}\n**URL**: ${typeof window !== 'undefined' ? window.location.href : 'unknown'}\n**Time**: ${new Date().toISOString()}\n\n## Steps to reproduce\n\n1. \n2. \n3. \n\n## Expected behavior\n\n\n## Additional context\n\n`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-md bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-secondary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Report issue
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Sends error details to the backend monitoring endpoint.
 * Best-effort: failures are silently ignored.
 */
async function reportErrorToBackend(
  error: Error & { digest?: string },
  errorCode: string,
): Promise<void> {
  try {
    await fetch('/api/error-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        errorCode,
        message: error.message,
        digest: error.digest,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Silent fail — error reporting must never throw
  }
}
