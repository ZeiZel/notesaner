/**
 * StatusBar.tsx
 *
 * Workspace status bar rendered at the bottom of the main content area.
 *
 * Displays:
 *   - Word count, character count, reading time estimate
 *   - Cursor position (line:column)
 *   - Current editor mode (edit/preview/source)
 *   - Sync status indicator (synced/syncing/offline/error)
 *   - Active collaborator count with avatar stack
 *   - Plugin-registered status items
 *
 * Design notes:
 *   - All displayed values are derived from store state at render time.
 *     Reading time is computed, not stored in state (no useEffect).
 *   - Click handlers on status items open detail popovers via local state.
 *   - Sync status uses a color-coded dot indicator.
 *   - Collaborator avatars are shown as a compact stacked row.
 */

'use client';

import { useState } from 'react';
import {
  useStatusBarStore,
  computeReadingTime,
  formatCursorPosition,
  formatEditorMode,
  formatSyncStatus,
  type SyncStatus,
} from './status-bar-store';

// ---------------------------------------------------------------------------
// Sync status dot color map
// ---------------------------------------------------------------------------

const SYNC_DOT_CLASSES: Record<SyncStatus, string> = {
  synced: 'bg-green-500',
  syncing: 'bg-yellow-500 animate-pulse',
  offline: 'bg-gray-400',
  error: 'bg-red-500',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface StatusItemProps {
  label: string;
  tooltip?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * A single clickable status bar segment.
 */
function StatusItem({ label, tooltip, onClick, children }: StatusItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={tooltip ?? label}
      aria-label={tooltip ?? label}
      className="flex items-center gap-1 rounded px-1.5 py-0.5 text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

/**
 * Popover that shows detail information for a status item.
 */
function StatusDetailPopover({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />
      {/* Popover */}
      <div
        role="dialog"
        aria-label={title}
        className="absolute bottom-full left-0 z-50 mb-1 min-w-48 rounded-lg border border-border bg-background-surface p-3 shadow-lg"
      >
        <div className="mb-2 text-xs font-semibold text-foreground">{title}</div>
        {children}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Editor Stats Section
// ---------------------------------------------------------------------------

function EditorStatsSection() {
  const wordCount = useStatusBarStore((s) => s.wordCount);
  const characterCount = useStatusBarStore((s) => s.characterCount);
  const [isOpen, setIsOpen] = useState(false);

  const readingTime = computeReadingTime(wordCount);

  return (
    <div className="relative">
      <StatusItem
        label={`${wordCount} words`}
        tooltip={`${wordCount} words, ${characterCount} characters, ~${readingTime} read`}
        onClick={() => setIsOpen((prev) => !prev)}
      />

      <StatusDetailPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Document Statistics"
      >
        <div className="space-y-1 text-xs text-foreground-muted">
          <div className="flex justify-between gap-4">
            <span>Words</span>
            <span className="font-medium text-foreground">{wordCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Characters</span>
            <span className="font-medium text-foreground">{characterCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Reading time</span>
            <span className="font-medium text-foreground">{readingTime}</span>
          </div>
        </div>
      </StatusDetailPopover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Cursor Position Section
// ---------------------------------------------------------------------------

function CursorPositionSection() {
  const cursorPosition = useStatusBarStore((s) => s.cursorPosition);
  const formatted = formatCursorPosition(cursorPosition);

  return <StatusItem label={formatted} tooltip="Cursor position" />;
}

// ---------------------------------------------------------------------------
// Editor Mode Section
// ---------------------------------------------------------------------------

function EditorModeSection() {
  const editorMode = useStatusBarStore((s) => s.editorMode);
  const label = formatEditorMode(editorMode);

  return <StatusItem label={label} tooltip={`Current mode: ${label}`} />;
}

// ---------------------------------------------------------------------------
// Sync Status Section
// ---------------------------------------------------------------------------

function SyncStatusSection() {
  const syncStatus = useStatusBarStore((s) => s.syncStatus);
  const lastSyncedAt = useStatusBarStore((s) => s.lastSyncedAt);
  const syncError = useStatusBarStore((s) => s.syncError);
  const [isOpen, setIsOpen] = useState(false);

  const label = formatSyncStatus(syncStatus);
  const dotClass = SYNC_DOT_CLASSES[syncStatus];

  // Screen reader live announcement for sync status (hidden visually)
  const srLabel = syncError ? `Sync error: ${syncError}` : `Sync status: ${label}`;

  return (
    <div className="relative">
      {/* Screen reader announcement for sync status changes */}
      <span className="sr-only" role="status" aria-live="polite">
        {srLabel}
      </span>
      <StatusItem
        label={label}
        tooltip={syncError ?? `Last synced: ${lastSyncedAt ?? 'never'}`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      </StatusItem>

      <StatusDetailPopover isOpen={isOpen} onClose={() => setIsOpen(false)} title="Sync Status">
        <div className="space-y-1 text-xs text-foreground-muted">
          <div className="flex items-center gap-2">
            <span className={`inline-block h-2 w-2 rounded-full ${dotClass}`} aria-hidden="true" />
            <span className="font-medium text-foreground">{label}</span>
          </div>
          {lastSyncedAt !== null && (
            <div className="flex justify-between gap-4">
              <span>Last synced</span>
              <span className="font-medium text-foreground">
                {new Date(lastSyncedAt).toLocaleTimeString()}
              </span>
            </div>
          )}
          {syncError !== null && (
            <div className="mt-1 rounded bg-destructive/10 p-1.5 text-destructive">{syncError}</div>
          )}
        </div>
      </StatusDetailPopover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collaborators Section
// ---------------------------------------------------------------------------

function CollaboratorsSection() {
  const collaborators = useStatusBarStore((s) => s.collaborators);
  const [isOpen, setIsOpen] = useState(false);

  if (collaborators.length === 0) return null;

  return (
    <div className="relative">
      <StatusItem
        label={`${collaborators.length} user${collaborators.length !== 1 ? 's' : ''}`}
        tooltip={`${collaborators.length} collaborator${collaborators.length !== 1 ? 's' : ''} editing`}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {/* Avatar stack */}
        <div className="flex -space-x-1">
          {collaborators.slice(0, 3).map((collab) => (
            <div
              key={collab.userId}
              className="flex h-4 w-4 items-center justify-center rounded-full border border-background text-[8px] font-bold"
              style={{ backgroundColor: collab.cursorColor }}
              title={collab.displayName}
              aria-hidden="true"
            >
              {collab.displayName.charAt(0).toUpperCase()}
            </div>
          ))}
          {collaborators.length > 3 && (
            <div className="flex h-4 w-4 items-center justify-center rounded-full border border-background bg-secondary text-[8px] font-bold text-foreground-muted">
              +{collaborators.length - 3}
            </div>
          )}
        </div>
      </StatusItem>

      <StatusDetailPopover
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Active Collaborators"
      >
        <div className="space-y-2">
          {collaborators.map((collab) => (
            <div key={collab.userId} className="flex items-center gap-2 text-xs">
              <div
                className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                style={{ backgroundColor: collab.cursorColor }}
              >
                {collab.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-foreground">{collab.displayName}</span>
            </div>
          ))}
        </div>
      </StatusDetailPopover>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Plugin Status Items Section
// ---------------------------------------------------------------------------

function PluginStatusSection() {
  const pluginItems = useStatusBarStore((s) => s.pluginStatusItems);

  if (pluginItems.length === 0) return null;

  return (
    <>
      {/* Separator */}
      <div className="mx-1 h-3 w-px bg-border" aria-hidden="true" />

      {pluginItems.map((item) => (
        <StatusItem key={item.id} label={item.label} tooltip={item.tooltip}>
          {item.icon !== undefined && (
            <span className="text-[10px]" aria-hidden="true">
              {item.icon}
            </span>
          )}
        </StatusItem>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main StatusBar component
// ---------------------------------------------------------------------------

export function StatusBar() {
  return (
    <footer
      className="flex h-6 items-center border-t border-border bg-background-surface px-2 text-foreground-muted"
      style={{ fontSize: 'var(--ns-text-2xs)' }}
      role="status"
      aria-label="Workspace status bar"
    >
      {/* Left section: branding + editor stats */}
      <div className="flex items-center gap-0.5">
        <span className="px-1.5 text-foreground-muted">Notesaner</span>

        {/* Separator */}
        <div className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />

        <EditorStatsSection />

        {/* Separator */}
        <div className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />

        <CursorPositionSection />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right section: plugin items, collaborators, sync, mode */}
      <div className="flex items-center gap-0.5">
        <PluginStatusSection />

        <CollaboratorsSection />

        {/* Separator before sync/mode */}
        <div className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />

        <SyncStatusSection />

        {/* Separator */}
        <div className="mx-0.5 h-3 w-px bg-border" aria-hidden="true" />

        <EditorModeSection />
      </div>
    </footer>
  );
}
