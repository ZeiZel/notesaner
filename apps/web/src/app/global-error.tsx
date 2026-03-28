'use client';

/**
 * Global error boundary — catches errors that occur in the root layout itself.
 *
 * This is the outermost error boundary in a Next.js App Router application.
 * It renders its own <html> and <body> because the root layout may have been
 * the source of the error.
 *
 * Important: This component must be self-contained — it cannot rely on any
 * providers, Zustand stores, or context that the root layout normally sets up.
 */

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

function generateErrorCode(digest?: string): string {
  if (digest) {
    return `NS-${digest.slice(0, 8).toUpperCase()}`;
  }
  const ts = Date.now().toString(36).toUpperCase();
  return `NS-${ts.slice(-8)}`;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  const errorCode = generateErrorCode(error.digest);
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inter Variable', 'Inter', system-ui, -apple-system, sans-serif",
          backgroundColor: '#1e1e2e',
          color: '#cdd6f4',
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center', padding: 24 }}>
          {/* Error icon */}
          <div
            style={{
              margin: '0 auto 16px',
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: 'rgba(243, 139, 168, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f38ba8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>

          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              marginBottom: 8,
            }}
          >
            Critical Error
          </h1>

          <p
            style={{
              fontSize: 14,
              color: '#a6adc8',
              lineHeight: 1.5,
              marginBottom: 12,
            }}
          >
            Notesaner encountered a critical error and could not load. Your data is safe on disk.
          </p>

          <p
            style={{
              fontSize: 12,
              color: '#6c7086',
              marginBottom: 20,
            }}
          >
            Error reference:{' '}
            <code
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                backgroundColor: '#2d2d44',
                padding: '2px 6px',
                borderRadius: 4,
                color: '#a6adc8',
              }}
            >
              {errorCode}
            </code>
          </p>

          {/* Dev mode: show error message */}
          {isDev && (
            <pre
              style={{
                textAlign: 'left',
                fontSize: 11,
                backgroundColor: '#2d2d44',
                color: '#f38ba8',
                padding: 12,
                borderRadius: 8,
                overflow: 'auto',
                maxHeight: 200,
                marginBottom: 20,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error.message}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          )}

          <div
            style={{
              display: 'flex',
              gap: 12,
              justifyContent: 'center',
            }}
          >
            <button
              onClick={reset}
              style={{
                backgroundColor: '#cba6f7',
                color: '#1e1e2e',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Reload application
            </button>

            <button
              onClick={() => {
                window.location.href = '/';
              }}
              style={{
                backgroundColor: '#45475a',
                color: '#cdd6f4',
                border: 'none',
                padding: '8px 20px',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Go home
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
