'use client';

/**
 * Module-level error boundary for isolating feature crashes.
 *
 * Use this to wrap feature slices (editor, sidebar, graph, plugins) so that
 * a crash in one module does not bring down the entire application.
 *
 * Features:
 *   - Configurable fallback: custom component or built-in minimal UI
 *   - Retry button: re-renders the subtree without losing parent state
 *   - Error reporting: logs to console + optional onError callback
 *   - Dev mode: shows error message and stack trace
 *   - Prod mode: shows user-friendly message with error reference code
 *
 * Note: React class component is required for error boundaries — there is no
 * hook-based equivalent as of React 19. This is one of the few valid cases
 * for a class component.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { isDevelopment } from '@/shared/config/env';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ErrorBoundaryProps {
  children: ReactNode;

  /** Human-readable label for the module (e.g. "Editor", "Graph View") */
  moduleName?: string;

  /** Custom fallback UI. Receives error, reset function, and module name. */
  fallback?: (props: ErrorBoundaryFallbackProps) => ReactNode;

  /** Called when an error is caught. Use for logging to external services. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;

  /**
   * When true, the retry button remounts the entire subtree (key-based reset).
   * When false (default), it calls setState to clear the error and re-render.
   */
  remountOnRetry?: boolean;
}

export interface ErrorBoundaryFallbackProps {
  error: Error;
  errorInfo: ErrorInfo | null;
  moduleName: string;
  reset: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo });

    const moduleName = this.props.moduleName ?? 'Unknown module';

    // Always log to console
    console.error(`[Notesaner] Error in ${moduleName}:`, {
      message: error.message,
      componentStack: errorInfo.componentStack,
      stack: error.stack,
    });

    // Call optional external handler
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: prev.retryCount + 1,
    }));
  };

  render(): ReactNode {
    const { hasError, error, errorInfo, retryCount } = this.state;
    const { children, fallback, moduleName = 'Module', remountOnRetry } = this.props;

    if (hasError && error) {
      if (fallback) {
        return fallback({
          error,
          errorInfo,
          moduleName,
          reset: this.handleReset,
        });
      }

      return (
        <DefaultErrorFallback
          error={error}
          errorInfo={errorInfo}
          moduleName={moduleName}
          reset={this.handleReset}
        />
      );
    }

    // When remountOnRetry is true, changing the key forces React to
    // unmount and remount the entire subtree — a clean slate.
    if (remountOnRetry) {
      return <div key={retryCount}>{children}</div>;
    }

    return children;
  }
}

// ---------------------------------------------------------------------------
// Default fallback UI
// ---------------------------------------------------------------------------

function DefaultErrorFallback({ error, errorInfo, moduleName, reset }: ErrorBoundaryFallbackProps) {
  const errorCode = `NS-${Date.now().toString(36).toUpperCase().slice(-8)}`;

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-border bg-background-surface p-6 text-center">
      {/* Warning icon */}
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning-muted">
        <svg
          className="h-5 w-5 text-warning"
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

      <div>
        <h3 className="text-sm font-semibold text-foreground">{moduleName} encountered an error</h3>
        <p className="mt-1 text-xs text-foreground-secondary">
          This section crashed but the rest of your workspace is still available.
        </p>
      </div>

      {/* Error reference */}
      <p className="text-xs text-foreground-muted">
        Ref:{' '}
        <code className="rounded bg-background-elevated px-1 py-0.5 font-mono text-foreground-muted">
          {errorCode}
        </code>
      </p>

      {/* Dev mode details */}
      {isDevelopment && (
        <details className="w-full text-left">
          <summary className="cursor-pointer text-xs text-foreground-muted">Error details</summary>
          <pre className="mt-2 max-h-40 overflow-auto rounded bg-background-elevated p-2 text-2xs text-destructive">
            {error.message}
          </pre>
          {errorInfo?.componentStack && (
            <pre className="mt-1 max-h-32 overflow-auto rounded bg-background-elevated p-2 text-2xs text-foreground-muted">
              {errorInfo.componentStack}
            </pre>
          )}
        </details>
      )}

      <button
        onClick={reset}
        className="mt-1 inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Reload {moduleName.toLowerCase()}
      </button>
    </div>
  );
}
