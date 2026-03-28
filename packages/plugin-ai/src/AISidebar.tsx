/**
 * AISidebar — AI Writing Assistant sidebar panel.
 *
 * Renders action buttons, streaming output with history, and link/tag
 * suggestion panels. Integrates with ai-store for all state management.
 */

import React, { useCallback, useRef, useEffect } from 'react';
import { useAIStore, selectTopLinkSuggestions, selectTopTagSuggestions } from './ai-store';
import { SIDEBAR_ACTIONS, getAction } from './ai-actions';
import type { AIActionId } from './ai-actions';
import type { HistoryEntry, LinkSuggestion, TagSuggestion } from './ai-store';

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ActionButtonProps {
  actionId: AIActionId;
  disabled: boolean;
  onClick: (actionId: AIActionId) => void;
}

function ActionButton({ actionId, disabled, onClick }: ActionButtonProps): React.ReactElement {
  const action = getAction(actionId);

  return (
    <button
      className="ai-action-btn"
      disabled={disabled}
      onClick={() => onClick(actionId)}
      title={action.description}
      aria-label={action.label}
    >
      <span className="ai-action-icon" aria-hidden="true" data-icon={action.icon} />
      <span className="ai-action-label">{action.label}</span>
    </button>
  );
}

interface StreamingEntryProps {
  entry: HistoryEntry;
  onCopy: (text: string) => void;
  onInsert: (text: string) => void;
  onRetry: (entryId: string) => void;
  onDelete: (entryId: string) => void;
}

function StreamingEntry({
  entry,
  onCopy,
  onInsert,
  onRetry,
  onDelete,
}: StreamingEntryProps): React.ReactElement {
  const action = getAction(entry.actionId);
  const responseRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom while streaming
  useEffect(() => {
    if (entry.isStreaming && responseRef.current) {
      responseRef.current.scrollTop = responseRef.current.scrollHeight;
    }
  }, [entry.response, entry.isStreaming]);

  return (
    <div
      className={`ai-entry${entry.isStreaming ? ' ai-entry--streaming' : ''}${entry.error ? ' ai-entry--error' : ''}`}
    >
      <div className="ai-entry-header">
        <span className="ai-entry-action">{action.label}</span>
        <span className="ai-entry-time">
          {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {entry.error ? (
        <div className="ai-entry-error-msg" role="alert">
          {entry.error}
        </div>
      ) : (
        <div className="ai-entry-response" ref={responseRef}>
          {entry.response}
          {entry.isStreaming && (
            <span className="ai-cursor" aria-hidden="true">
              |
            </span>
          )}
        </div>
      )}

      {!entry.isStreaming && (
        <div className="ai-entry-actions" role="group" aria-label="Entry actions">
          {!entry.error && (
            <>
              <button
                className="ai-entry-btn"
                onClick={() => onCopy(entry.response)}
                title="Copy to clipboard"
              >
                Copy
              </button>
              <button
                className="ai-entry-btn"
                onClick={() => onInsert(entry.response)}
                title="Insert into editor"
              >
                Insert
              </button>
            </>
          )}
          {entry.error && (
            <button
              className="ai-entry-btn"
              onClick={() => onRetry(entry.id)}
              title="Retry this action"
            >
              Retry
            </button>
          )}
          <button
            className="ai-entry-btn ai-entry-btn--danger"
            onClick={() => onDelete(entry.id)}
            title="Remove this entry"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

interface LinkSuggestionsProps {
  suggestions: LinkSuggestion[];
  onInsert: (title: string) => void;
}

function LinkSuggestions({
  suggestions,
  onInsert,
}: LinkSuggestionsProps): React.ReactElement | null {
  if (suggestions.length === 0) return null;

  return (
    <section className="ai-suggestions" aria-labelledby="ai-links-heading">
      <h3 className="ai-suggestions-heading" id="ai-links-heading">
        Suggested Links
      </h3>
      <ul className="ai-suggestions-list" role="list">
        {suggestions.map((s) => (
          <li key={s.noteId} className="ai-suggestion-item">
            <span className="ai-suggestion-title">{s.noteTitle}</span>
            <span
              className="ai-suggestion-score"
              aria-label={`${Math.round(s.relevance * 100)}% relevant`}
            >
              {Math.round(s.relevance * 100)}%
            </span>
            <button
              className="ai-suggestion-btn"
              onClick={() => onInsert(`[[${s.noteTitle}]]`)}
              title={`Insert link to ${s.noteTitle}`}
            >
              Link
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

interface TagSuggestionsProps {
  suggestions: TagSuggestion[];
  onAdd: (tag: string) => void;
}

function TagSuggestions({ suggestions, onAdd }: TagSuggestionsProps): React.ReactElement | null {
  if (suggestions.length === 0) return null;

  return (
    <section className="ai-suggestions" aria-labelledby="ai-tags-heading">
      <h3 className="ai-suggestions-heading" id="ai-tags-heading">
        Suggested Tags
      </h3>
      <div className="ai-tag-chips" role="list">
        {suggestions.map((s) => (
          <button
            key={s.tag}
            className="ai-tag-chip"
            role="listitem"
            onClick={() => onAdd(s.tag)}
            title={`Add tag: ${s.tag} (${Math.round(s.confidence * 100)}% confidence)`}
          >
            #{s.tag}
          </button>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export interface AISidebarProps {
  /** Text currently selected in the editor */
  selection?: string;
  /** Full content of the active note */
  noteContent?: string;
  /** Title of the active note */
  noteTitle?: string;
  /** Called when the user wants to insert text at cursor */
  onInsertText?: (text: string) => void;
  /** Called when the user wants to add a tag to the note */
  onAddTag?: (tag: string) => void;
  /** Called when the user clicks "Insert link" in suggestions */
  onInsertLink?: (wikiLink: string) => void;
  /** Called when an action button is pressed */
  onRunAction?: (actionId: AIActionId) => void;
}

export function AISidebar({
  selection = '',
  noteContent = '',
  noteTitle,
  onInsertText,
  onAddTag,
  onInsertLink,
  onRunAction,
}: AISidebarProps): React.ReactElement {
  const { isStreaming, history, actions } = useAIStore();
  const linkSuggestions = useAIStore(selectTopLinkSuggestions);
  const tagSuggestions = useAIStore(selectTopTagSuggestions);

  const handleActionClick = useCallback(
    (actionId: AIActionId) => {
      const actionDef = getAction(actionId);
      actions.setPendingAction({
        actionId,
        selection: actionDef.requiresSelection ? selection : undefined,
        params: noteContent ? { noteContent } : undefined,
      });
      onRunAction?.(actionId);
    },
    [selection, noteContent, actions, onRunAction],
  );

  const handleCopy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text);
  }, []);

  const handleInsert = useCallback(
    (text: string) => {
      onInsertText?.(text);
    },
    [onInsertText],
  );

  const handleRetry = useCallback(
    (entryId: string) => {
      const entry = history.find((e) => e.id === entryId);
      if (entry) {
        handleActionClick(entry.actionId);
      }
    },
    [history, handleActionClick],
  );

  const handleDelete = useCallback(
    (entryId: string) => {
      actions.removeEntry(entryId);
    },
    [actions],
  );

  const handleInsertLink = useCallback(
    (wikiLink: string) => {
      onInsertLink?.(wikiLink);
    },
    [onInsertLink],
  );

  const handleAddTag = useCallback(
    (tag: string) => {
      onAddTag?.(tag);
    },
    [onAddTag],
  );

  // Determine which actions are available given the current selection
  const hasSelection = selection.trim().length > 0;

  return (
    <aside className="ai-sidebar" aria-label="AI Writing Assistant">
      <style>{SIDEBAR_STYLES}</style>

      {/* Header */}
      <header className="ai-sidebar-header">
        <span className="ai-sidebar-title">AI Assistant</span>
        {isStreaming && (
          <span className="ai-streaming-badge" aria-live="polite">
            Generating...
          </span>
        )}
        {history.length > 0 && (
          <button
            className="ai-clear-btn"
            onClick={() => actions.clearHistory()}
            title="Clear history"
            aria-label="Clear all history"
          >
            Clear
          </button>
        )}
      </header>

      {/* Context info */}
      {noteTitle && (
        <div className="ai-context-bar" aria-label="Active note">
          <span className="ai-context-icon" aria-hidden="true" />
          <span className="ai-context-title" title={noteTitle}>
            {noteTitle}
          </span>
        </div>
      )}
      {hasSelection && (
        <div className="ai-selection-bar" role="status" aria-live="polite">
          <span className="ai-selection-text">{selection.length} chars selected</span>
        </div>
      )}

      {/* Action grid */}
      <nav className="ai-actions-grid" aria-label="AI actions">
        {SIDEBAR_ACTIONS.map((actionId) => {
          const action = getAction(actionId);
          const requiresSelection = action.requiresSelection;
          const disabled = isStreaming || (requiresSelection && !hasSelection);

          return (
            <ActionButton
              key={actionId}
              actionId={actionId}
              disabled={disabled}
              onClick={handleActionClick}
            />
          );
        })}
      </nav>

      {/* Suggestions */}
      <LinkSuggestions suggestions={linkSuggestions} onInsert={handleInsertLink} />
      <TagSuggestions suggestions={tagSuggestions} onAdd={handleAddTag} />

      {/* History */}
      {history.length > 0 && (
        <section className="ai-history" aria-labelledby="ai-history-heading">
          <h3 className="ai-history-heading" id="ai-history-heading">
            History
          </h3>
          <div className="ai-history-list">
            {history.map((entry) => (
              <StreamingEntry
                key={entry.id}
                entry={entry}
                onCopy={handleCopy}
                onInsert={handleInsert}
                onRetry={handleRetry}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {history.length === 0 && linkSuggestions.length === 0 && tagSuggestions.length === 0 && (
        <div className="ai-empty" role="status">
          <p>Select an action above to get started.</p>
          <p className="ai-empty-hint">Some actions require text to be selected in the editor.</p>
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const SIDEBAR_STYLES = `
  .ai-sidebar {
    display: flex;
    flex-direction: column;
    height: 100%;
    font-family: var(--font-sans, system-ui, sans-serif);
    font-size: 13px;
    color: var(--color-text, #1a1a1a);
    overflow: hidden;
    background: var(--color-bg, #fff);
  }

  .ai-sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    flex-shrink: 0;
    gap: 8px;
  }

  .ai-sidebar-title {
    font-weight: 600;
    font-size: 13px;
    color: var(--color-text-muted, #64748b);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    flex: 1;
  }

  .ai-streaming-badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 12px;
    background: var(--color-accent-bg, #eef2ff);
    color: var(--color-accent, #6366f1);
    animation: ai-pulse 1.5s ease-in-out infinite;
  }

  @keyframes ai-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .ai-clear-btn {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: transparent;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
  }

  .ai-clear-btn:hover {
    background: var(--color-bg-hover, #f1f5f9);
  }

  .ai-context-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 12px;
    font-size: 11px;
    color: var(--color-text-muted, #94a3b8);
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-subtle, #f8fafc);
    flex-shrink: 0;
  }

  .ai-context-title {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ai-selection-bar {
    padding: 3px 12px;
    font-size: 11px;
    color: var(--color-accent, #6366f1);
    background: var(--color-accent-bg, #eef2ff);
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    flex-shrink: 0;
  }

  .ai-actions-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    padding: 8px;
    flex-shrink: 0;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
  }

  .ai-action-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg, #fff);
    color: var(--color-text, #1a1a1a);
    font-size: 12px;
    cursor: pointer;
    transition: background 0.1s, border-color 0.1s;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
  }

  .ai-action-btn:hover:not(:disabled) {
    background: var(--color-bg-hover, #f1f5f9);
    border-color: var(--color-accent, #6366f1);
  }

  .ai-action-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .ai-action-icon {
    font-size: 14px;
    flex-shrink: 0;
  }

  .ai-action-label {
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ai-suggestions {
    padding: 8px 12px;
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    flex-shrink: 0;
  }

  .ai-suggestions-heading {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #64748b);
    margin: 0 0 6px 0;
  }

  .ai-suggestions-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .ai-suggestion-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
  }

  .ai-suggestion-title {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--color-link, #6366f1);
  }

  .ai-suggestion-score {
    font-size: 10px;
    color: var(--color-text-muted, #94a3b8);
    flex-shrink: 0;
  }

  .ai-suggestion-btn {
    font-size: 10px;
    padding: 1px 6px;
    border-radius: 3px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: transparent;
    color: var(--color-accent, #6366f1);
    cursor: pointer;
    flex-shrink: 0;
  }

  .ai-suggestion-btn:hover {
    background: var(--color-accent-bg, #eef2ff);
  }

  .ai-tag-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .ai-tag-chip {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 12px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-subtle, #f8fafc);
    color: var(--color-text, #1a1a1a);
    font-size: 11px;
    cursor: pointer;
    transition: background 0.1s;
  }

  .ai-tag-chip:hover {
    background: var(--color-accent-bg, #eef2ff);
    border-color: var(--color-accent, #6366f1);
    color: var(--color-accent, #6366f1);
  }

  .ai-history {
    flex: 1;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

  .ai-history-heading {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted, #64748b);
    margin: 0;
    padding: 8px 12px 4px;
    flex-shrink: 0;
  }

  .ai-history-list {
    flex: 1;
    overflow-y: auto;
    padding: 4px 8px 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .ai-entry {
    border: 1px solid var(--color-border, #e2e8f0);
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-bg, #fff);
  }

  .ai-entry--streaming {
    border-color: var(--color-accent, #6366f1);
  }

  .ai-entry--error {
    border-color: var(--color-error, #ef4444);
  }

  .ai-entry-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
    background: var(--color-bg-subtle, #f8fafc);
    border-bottom: 1px solid var(--color-border, #e2e8f0);
    font-size: 11px;
  }

  .ai-entry-action {
    font-weight: 600;
    color: var(--color-accent, #6366f1);
  }

  .ai-entry-time {
    color: var(--color-text-muted, #94a3b8);
  }

  .ai-entry-response {
    padding: 8px;
    font-size: 12px;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
    color: var(--color-text, #1a1a1a);
  }

  .ai-entry-error-msg {
    padding: 8px;
    font-size: 12px;
    color: var(--color-error, #ef4444);
  }

  .ai-cursor {
    display: inline-block;
    width: 1px;
    animation: ai-blink 1s step-end infinite;
    margin-left: 1px;
    font-weight: 700;
    color: var(--color-accent, #6366f1);
  }

  @keyframes ai-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .ai-entry-actions {
    display: flex;
    gap: 4px;
    padding: 4px 8px;
    border-top: 1px solid var(--color-border, #e2e8f0);
    background: var(--color-bg-subtle, #f8fafc);
  }

  .ai-entry-btn {
    font-size: 10px;
    padding: 2px 8px;
    border-radius: 4px;
    border: 1px solid var(--color-border, #e2e8f0);
    background: transparent;
    color: var(--color-text-muted, #64748b);
    cursor: pointer;
  }

  .ai-entry-btn:hover {
    background: var(--color-bg-hover, #f1f5f9);
    color: var(--color-text, #1a1a1a);
  }

  .ai-entry-btn--danger:hover {
    background: var(--color-error-bg, #fef2f2);
    color: var(--color-error, #ef4444);
    border-color: var(--color-error, #ef4444);
  }

  .ai-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px 16px;
    text-align: center;
    color: var(--color-text-muted, #64748b);
    gap: 4px;
  }

  .ai-empty p {
    margin: 0;
    font-size: 12px;
  }

  .ai-empty-hint {
    font-size: 11px;
    color: var(--color-text-muted, #94a3b8);
  }
`;
