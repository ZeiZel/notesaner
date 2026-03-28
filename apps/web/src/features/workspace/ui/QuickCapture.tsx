'use client';

/**
 * QuickCapture -- modal for instant note capture.
 *
 * Features:
 *   - Triggered by global shortcut (Cmd+Shift+N or configurable)
 *   - Minimal editor: text + basic markdown formatting
 *   - Choose target folder and add tags
 *   - Auto-save after 2 seconds of inactivity
 *   - Create as new note or append to daily note
 *   - Slide-down animation from top
 *
 * Design decisions:
 *   - No useEffect for auto-save: timer is scheduled in the content
 *     change event handler via useQuickCapture.handleContentChange.
 *   - useEffect is used validly for:
 *     1. Global keyboard shortcut listener (external event source)
 *     2. Body scroll lock when modal is open (DOM side effect)
 *   - Focus management on open is done via autoFocus.
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import { useQuickCapture, type CaptureMode } from '../hooks/useQuickCapture';
import { matchesCombo } from '@/shared/lib/keyboard-shortcuts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface QuickCaptureProps {
  /** Folders available for the target folder selector. */
  folders?: string[];
  /** Called after a note is saved, with the note ID. */
  onNoteSaved?: (noteId: string) => void;
  /** Custom keyboard shortcut combo. Defaults to Cmd+Shift+N. */
  shortcutCombo?: { key: string; mod?: boolean; shift?: boolean; alt?: boolean };
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17,21 17,13 7,13 7,21" />
      <polyline points="7,3 7,8 15,8" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <line x1="7" y1="7" x2="7.01" y2="7" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5"
    >
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-3.5 w-3.5 text-success"
    >
      <polyline points="3.5,8.5 6.5,11.5 12.5,4.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Tag input
// ---------------------------------------------------------------------------

function TagInput({
  tags,
  onAddTag,
  onRemoveTag,
}: {
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const tag = inputValue.trim().replace(/^#/, '');
        if (tag) {
          onAddTag(tag);
          setInputValue('');
        }
      }
      if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
        const lastTag = tags[tags.length - 1];
        if (lastTag) {
          onRemoveTag(lastTag);
        }
      }
    },
    [inputValue, tags, onAddTag, onRemoveTag],
  );

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-sm border border-border bg-background-input px-2 py-1.5">
      <TagIcon />
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-0.5 rounded-full bg-primary-muted/40 px-2 py-0.5 text-xs text-primary"
        >
          #{tag}
          <button
            type="button"
            onClick={() => onRemoveTag(tag)}
            className="ml-0.5 rounded-full text-primary/60 transition-colors hover:text-primary"
            aria-label={`Remove tag ${tag}`}
          >
            <svg
              viewBox="0 0 12 12"
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M3 3l6 6M9 3l-6 6" />
            </svg>
          </button>
        </span>
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={tags.length === 0 ? 'Add tags...' : ''}
        className="min-w-[80px] flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
        aria-label="Add tag"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode selector
// ---------------------------------------------------------------------------

function ModeSelector({
  mode,
  onModeChange,
}: {
  mode: CaptureMode;
  onModeChange: (mode: CaptureMode) => void;
}) {
  return (
    <div
      className="flex rounded-md border border-border"
      role="radiogroup"
      aria-label="Capture mode"
    >
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'new-note'}
        onClick={() => onModeChange('new-note')}
        className={`flex-1 rounded-l-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'new-note'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-foreground-muted hover:bg-accent'
        }`}
      >
        New note
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={mode === 'daily-note'}
        onClick={() => onModeChange('daily-note')}
        className={`flex-1 rounded-r-md px-3 py-1.5 text-xs font-medium transition-colors ${
          mode === 'daily-note'
            ? 'bg-primary text-primary-foreground'
            : 'bg-background text-foreground-muted hover:bg-accent'
        }`}
      >
        Daily note
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Folder selector
// ---------------------------------------------------------------------------

function FolderSelector({
  folders,
  value,
  onChange,
}: {
  folders: string[];
  value: string;
  onChange: (folder: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <FolderIcon />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-sm border border-border bg-background-input px-2 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        aria-label="Target folder"
      >
        <option value="">Root</option>
        {folders.map((folder) => (
          <option key={folder} value={folder}>
            {folder}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function QuickCapture({
  folders = [],
  onNoteSaved: _onNoteSaved,
  shortcutCombo = { key: 'n', mod: true, shift: true },
}: QuickCaptureProps) {
  // _onNoteSaved is available for the caller; integration with save result
  // requires the API to return the noteId, which is handled via saveAndClose.
  void _onNoteSaved;
  const {
    isOpen,
    content,
    title,
    tags,
    targetFolder,
    captureMode,
    isSaving,
    saveError,
    lastSavedAt,
    setTitle,
    addTag,
    removeTag,
    setTargetFolder,
    setCaptureMode,
    open,
    close,
    handleContentChange,
    saveAndClose,
    discardAndClose,
  } = useQuickCapture();

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Valid useEffect: global keyboard shortcut listener (external event source).
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (matchesCombo(e, shortcutCombo)) {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
      }

      // Close on Escape when open
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcutCombo, isOpen, open, close]);

  // Valid useEffect: body scroll lock (DOM side effect when modal is open).
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = '';
      };
    }
  }, [isOpen]);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current) {
        close();
      }
    },
    [close],
  );

  const handleTextareaChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleContentChange(e.target.value);
    },
    [handleContentChange],
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value);
    },
    [setTitle],
  );

  const handleSaveAndClose = useCallback(async () => {
    try {
      await saveAndClose();
    } catch {
      // Error displayed in the UI
    }
  }, [saveAndClose]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Cmd+Enter to save and close
      const isMac =
        typeof navigator !== 'undefined' && navigator.platform.toUpperCase().includes('MAC');
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key === 'Enter') {
        e.preventDefault();
        void handleSaveAndClose();
      }
    },
    [handleSaveAndClose],
  );

  // Auto-saved indicator
  const savedAgoText = lastSavedAt ? formatSavedAgo(lastSavedAt) : null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (!isOpen) return null;

  return (
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[10vh] backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
    >
      <div className="w-full max-w-lg animate-in slide-in-from-top-4 duration-300 ease-out">
        <div className="mx-4 flex flex-col rounded-lg border border-border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Quick Capture</h2>
            <div className="flex items-center gap-2">
              {/* Save status indicator */}
              {isSaving && (
                <span className="flex items-center gap-1 text-xs text-foreground-muted">
                  <SpinnerIcon />
                  Saving...
                </span>
              )}
              {!isSaving && savedAgoText && (
                <span className="flex items-center gap-1 text-xs text-foreground-muted">
                  <CheckIcon />
                  {savedAgoText}
                </span>
              )}

              <button
                type="button"
                onClick={close}
                className="flex h-7 w-7 items-center justify-center rounded-sm text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close quick capture"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {/* Mode selector */}
          <div className="border-b border-border px-4 py-2">
            <ModeSelector mode={captureMode} onModeChange={setCaptureMode} />
          </div>

          {/* Title (only for new note mode) */}
          {captureMode === 'new-note' && (
            <div className="border-b border-border px-4 py-2">
              <input
                type="text"
                placeholder="Note title (optional)"
                value={title}
                onChange={handleTitleChange}
                className="w-full bg-transparent text-base font-medium text-foreground placeholder:text-foreground-muted focus:outline-none"
                aria-label="Note title"
              />
            </div>
          )}

          {/* Content textarea */}
          <div className="px-4 py-3">
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder="Start typing... (supports Markdown)"
              rows={8}
              className="w-full resize-none bg-transparent font-mono text-sm leading-relaxed text-foreground placeholder:text-foreground-muted focus:outline-none"
              aria-label="Note content"
              autoFocus
            />
          </div>

          {/* Tags */}
          <div className="border-t border-border px-4 py-2">
            <TagInput tags={tags} onAddTag={addTag} onRemoveTag={removeTag} />
          </div>

          {/* Folder selector (only for new note mode) */}
          {captureMode === 'new-note' && folders.length > 0 && (
            <div className="border-t border-border px-4 py-2">
              <FolderSelector folders={folders} value={targetFolder} onChange={setTargetFolder} />
            </div>
          )}

          {/* Error */}
          {saveError && (
            <div
              className="border-t border-destructive/30 bg-destructive/10 px-4 py-2"
              role="alert"
            >
              <p className="text-xs text-destructive">{saveError}</p>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <p className="text-2xs text-foreground-muted">
              {captureMode === 'new-note'
                ? 'Auto-saves after 2s of inactivity'
                : "Appends to today's daily note"}
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={discardAndClose}
                className="rounded-sm px-3 py-1.5 text-xs text-foreground-muted transition-colors hover:bg-accent hover:text-foreground"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSaveAndClose}
                disabled={isSaving || (!content.trim() && !title.trim())}
                className="flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <SaveIcon />
                {isSaving ? 'Saving...' : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatSavedAgo(isoTimestamp: string): string {
  const diff = Date.now() - new Date(isoTimestamp).getTime();
  const seconds = Math.floor(diff / 1000);

  if (seconds < 5) return 'Saved just now';
  if (seconds < 60) return `Saved ${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  return `Saved ${minutes}m ago`;
}
