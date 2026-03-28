'use client';

/**
 * SearchOperators — help panel showing available search syntax and operators.
 *
 * Features:
 *   - Lists all supported search operators with descriptions
 *   - Clickable examples that insert the operator into the search input
 *   - Collapsible sections for quick reference
 *   - Keyboard accessible
 *
 * No useEffect — purely presentational component with event handlers.
 */

import { useState } from 'react';
import { SEARCH_OPERATORS, type SearchOperatorDoc } from '@/shared/lib/search-parser';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SearchOperatorsProps {
  /** Called when user clicks an example to insert it into the search input */
  onInsertOperator?: (operator: string) => void;
  /** Whether the panel is in compact mode (inline hints) vs full mode */
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Operator card
// ---------------------------------------------------------------------------

function OperatorCard({
  doc,
  onInsert,
}: {
  doc: SearchOperatorDoc;
  onInsert?: (example: string) => void;
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background-surface)',
      }}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <code
          className="text-sm font-mono font-semibold px-1.5 py-0.5 rounded"
          style={{
            backgroundColor: 'var(--ns-color-primary-muted)',
            color: 'var(--ns-color-primary)',
          }}
        >
          {doc.operator}
        </code>
      </div>
      <p className="text-xs mb-2" style={{ color: 'var(--ns-color-foreground-secondary)' }}>
        {doc.description}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {doc.examples.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => onInsert?.(example)}
            title={`Insert: ${example}`}
            className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-mono transition-colors hover:ring-1"
            style={{
              backgroundColor: 'var(--ns-color-background)',
              color: 'var(--ns-color-foreground-muted)',
              border: '1px solid var(--ns-color-border-subtle)',
            }}
          >
            {example}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact inline hint
// ---------------------------------------------------------------------------

function CompactOperatorHint({
  doc,
  onInsert,
}: {
  doc: SearchOperatorDoc;
  onInsert?: (example: string) => void;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <code
        className="text-[11px] font-mono font-medium shrink-0 px-1 rounded"
        style={{
          backgroundColor: 'var(--ns-color-primary-muted)',
          color: 'var(--ns-color-primary)',
        }}
      >
        {doc.operator}
      </code>
      <span
        className="text-[11px] flex-1 truncate"
        style={{ color: 'var(--ns-color-foreground-muted)' }}
      >
        {doc.description}
      </span>
      {doc.examples[0] && (
        <button
          type="button"
          onClick={() => onInsert?.(doc.examples[0])}
          className="text-[10px] font-mono shrink-0 transition-colors"
          style={{ color: 'var(--ns-color-foreground-muted)' }}
          title={`Insert: ${doc.examples[0]}`}
        >
          {doc.examples[0]}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function SearchOperators({ onInsertOperator, compact = false }: SearchOperatorsProps) {
  const [expanded, setExpanded] = useState(!compact);

  if (compact && !expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 px-2 py-1 text-xs rounded-md transition-colors"
        style={{
          color: 'var(--ns-color-foreground-muted)',
          backgroundColor: 'var(--ns-color-background-surface)',
        }}
        aria-expanded={false}
        aria-label="Show search operators help"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </svg>
        Search operators
      </button>
    );
  }

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        borderColor: 'var(--ns-color-border)',
        backgroundColor: 'var(--ns-color-background)',
      }}
      role="region"
      aria-label="Search operators reference"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{
          backgroundColor: 'var(--ns-color-background-surface)',
          borderColor: 'var(--ns-color-border)',
        }}
      >
        <div className="flex items-center gap-2">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ color: 'var(--ns-color-primary)' }}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <path d="M12 17h.01" />
          </svg>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--ns-color-foreground)' }}>
            Search Operators
          </h3>
        </div>

        {compact && (
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="rounded p-1 transition-colors"
            style={{ color: 'var(--ns-color-foreground-muted)' }}
            aria-label="Collapse search operators help"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2 2l8 8M10 2l-8 8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        {compact ? (
          // Compact: simple list
          <div className="divide-y" style={{ borderColor: 'var(--ns-color-border-subtle)' }}>
            {SEARCH_OPERATORS.map((doc) => (
              <CompactOperatorHint key={doc.operator} doc={doc} onInsert={onInsertOperator} />
            ))}
          </div>
        ) : (
          // Full: card layout
          <div className="grid gap-2 sm:grid-cols-2">
            {SEARCH_OPERATORS.map((doc) => (
              <OperatorCard key={doc.operator} doc={doc} onInsert={onInsertOperator} />
            ))}
          </div>
        )}

        {/* Tips */}
        <div
          className="mt-3 rounded-md p-2.5"
          style={{
            backgroundColor: 'var(--ns-color-info-muted)',
            border: '1px solid var(--ns-color-info)',
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--ns-color-info)' }}>
            Tips
          </p>
          <ul
            className="text-xs space-y-0.5"
            style={{ color: 'var(--ns-color-foreground-secondary)' }}
          >
            <li>Combine multiple operators in a single query.</li>
            <li>Use quotes for exact phrase matching.</li>
            <li>
              Prefix a term with{' '}
              <code
                className="font-mono text-[10px] px-0.5 rounded"
                style={{
                  backgroundColor: 'var(--ns-color-background-surface)',
                  color: 'var(--ns-color-foreground)',
                }}
              >
                -
              </code>{' '}
              to exclude results.
            </li>
            <li>
              Date ranges use{' '}
              <code
                className="font-mono text-[10px] px-0.5 rounded"
                style={{
                  backgroundColor: 'var(--ns-color-background-surface)',
                  color: 'var(--ns-color-foreground)',
                }}
              >
                ..
              </code>{' '}
              separator (e.g.,{' '}
              <code
                className="font-mono text-[10px] px-0.5 rounded"
                style={{
                  backgroundColor: 'var(--ns-color-background-surface)',
                  color: 'var(--ns-color-foreground)',
                }}
              >
                created:2024-01-01..2024-12-31
              </code>
              ).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
