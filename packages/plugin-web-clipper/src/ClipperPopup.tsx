/**
 * Browser extension popup UI for the Notesaner web clipper.
 *
 * Renders:
 * - Clip mode selector (full page / article / selection / screenshot)
 * - Destination picker (inbox or folder)
 * - Tag input with add/remove
 * - Clip button with loading + success/error feedback
 * - Recent clip history (last 5)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useClipperStore } from './clip-store';
import type { ClipMode, ClipDestination, FolderOption } from './ClipperPopup.types';

// ---------------------------------------------------------------------------
// Local types
// ---------------------------------------------------------------------------

export interface ClipperPopupProps {
  /**
   * Called when the user clicks "Clip". Receives the current clip configuration.
   * The host is responsible for orchestrating content extraction and API calls,
   * then calling the store's startClip / finishClip / setClipError accordingly.
   */
  onClip: (config: {
    mode: ClipMode;
    destination: ClipDestination;
    tags: string[];
    templateId: string;
  }) => void | Promise<void>;

  /**
   * Available folders to display in the destination picker.
   * Fetched by the background script after authentication.
   */
  folders?: FolderOption[];

  /**
   * Available tags for autocomplete suggestions.
   */
  availableTags?: string[];

  /**
   * Called when the user clicks the Settings gear icon.
   */
  onOpenSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Mode metadata
// ---------------------------------------------------------------------------

interface ModeOption {
  id: ClipMode;
  label: string;
  description: string;
  icon: string;
}

const CLIP_MODES: ModeOption[] = [
  {
    id: 'article',
    label: 'Article',
    description: 'Extract main article content',
    icon: '📄',
  },
  {
    id: 'full',
    label: 'Full Page',
    description: 'Clip the entire page',
    icon: '🌐',
  },
  {
    id: 'selection',
    label: 'Selection',
    description: 'Clip selected text',
    icon: '✂️',
  },
  {
    id: 'screenshot',
    label: 'Screenshot',
    description: 'Capture a screenshot',
    icon: '📷',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClipperPopup({
  onClip,
  folders = [],
  availableTags = [],
  onOpenSettings,
}: ClipperPopupProps) {
  const {
    clipMode,
    destination,
    tags,
    templateId,
    isClipping,
    clipError,
    clipSuccess,
    connectionStatus,
    clipHistory,
    setClipMode,
    setDestination,
    addTag,
    removeTag,
    clearClipStatus,
  } = useClipperStore();

  const [tagInput, setTagInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Clear status when mode changes
  useEffect(() => {
    clearClipStatus();
  }, [clipMode, clearClipStatus]);

  const handleClip = useCallback(async () => {
    clearClipStatus();
    await onClip({ mode: clipMode, destination, tags, templateId });
  }, [onClip, clipMode, destination, tags, templateId, clearClipStatus]);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
        e.preventDefault();
        addTag(tagInput.trim());
        setTagInput('');
      } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
        removeTag(tags[tags.length - 1]);
      }
    },
    [tagInput, tags, addTag, removeTag],
  );

  const isConnected = connectionStatus === 'connected';
  const recentHistory = clipHistory.slice(0, 5);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <span style={styles.logo}>📎</span>
          <span style={styles.title}>Web Clipper</span>
        </div>
        {onOpenSettings && (
          <button
            style={styles.iconButton}
            onClick={onOpenSettings}
            aria-label="Open settings"
            type="button"
          >
            ⚙️
          </button>
        )}
      </div>

      {/* Connection status banner */}
      {!isConnected && (
        <div style={styles.warningBanner}>
          {connectionStatus === 'error'
            ? 'Connection error — check Settings'
            : 'Not connected to Notesaner'}
        </div>
      )}

      {/* Clip mode selector */}
      <section style={styles.section}>
        <label style={styles.label}>Clip mode</label>
        <div style={styles.modeGrid}>
          {CLIP_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              style={{
                ...styles.modeButton,
                ...(clipMode === mode.id ? styles.modeButtonActive : {}),
              }}
              onClick={() => setClipMode(mode.id)}
              title={mode.description}
              aria-pressed={clipMode === mode.id}
            >
              <span style={styles.modeIcon}>{mode.icon}</span>
              <span style={styles.modeLabel}>{mode.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Destination picker */}
      <section style={styles.section}>
        <label style={styles.label} htmlFor="destination-select">
          Destination
        </label>
        <select
          id="destination-select"
          style={styles.select}
          value={destination.type === 'folder' ? (destination.folderId ?? '') : 'inbox'}
          onChange={(e) => {
            const value = e.target.value;
            if (value === 'inbox') {
              setDestination({ type: 'inbox' });
            } else {
              const folder = folders.find((f) => f.id === value);
              setDestination({
                type: 'folder',
                folderId: value,
                folderPath: folder?.path,
              });
            }
          }}
        >
          <option value="inbox">Inbox (root)</option>
          {folders.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {folder.path}
            </option>
          ))}
        </select>
      </section>

      {/* Tag input */}
      <section style={styles.section}>
        <label style={styles.label} htmlFor="tag-input">
          Tags
        </label>
        <div style={styles.tagContainer}>
          {tags.map((tag) => (
            <span key={tag} style={styles.tagBadge}>
              {tag}
              <button
                type="button"
                style={styles.tagRemove}
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
          <input
            id="tag-input"
            style={styles.tagInput}
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            placeholder={tags.length === 0 ? 'Add tags…' : ''}
            list="tag-suggestions"
            aria-label="Add a tag"
          />
          <datalist id="tag-suggestions">
            {availableTags
              .filter((t) => !tags.includes(t))
              .map((t) => (
                <option key={t} value={t} />
              ))}
          </datalist>
        </div>
      </section>

      {/* Status messages */}
      {clipError && (
        <div style={styles.errorBanner} role="alert">
          {clipError}
        </div>
      )}
      {clipSuccess && (
        <div style={styles.successBanner} role="status">
          Clipped successfully!
        </div>
      )}

      {/* Clip button */}
      <button
        type="button"
        style={{
          ...styles.clipButton,
          ...(isClipping || !isConnected ? styles.clipButtonDisabled : {}),
        }}
        onClick={handleClip}
        disabled={isClipping || !isConnected}
      >
        {isClipping ? 'Clipping…' : '📎 Clip to Notesaner'}
      </button>

      {/* Recent history toggle */}
      {recentHistory.length > 0 && (
        <div style={styles.historySection}>
          <button
            type="button"
            style={styles.historyToggle}
            onClick={() => setShowHistory((prev) => !prev)}
          >
            {showHistory ? '▲' : '▼'} Recent clips ({recentHistory.length})
          </button>
          {showHistory && (
            <ul style={styles.historyList}>
              {recentHistory.map((entry) => (
                <li key={entry.id} style={styles.historyItem}>
                  <span
                    style={entry.status === 'success' ? styles.historySuccess : styles.historyError}
                  >
                    {entry.status === 'success' ? '✓' : '✗'}
                  </span>
                  <span style={styles.historyTitle} title={entry.url}>
                    {entry.title.slice(0, 40) || entry.url}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles (no external CSS dependency for portability in extension popup)
// ---------------------------------------------------------------------------

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 320,
    padding: '12px 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 13,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  logo: {
    fontSize: 18,
  },
  title: {
    fontWeight: 600,
    fontSize: 15,
  },
  iconButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    padding: 4,
    borderRadius: 4,
  },
  warningBanner: {
    backgroundColor: '#fef3c7',
    border: '1px solid #f59e0b',
    borderRadius: 4,
    padding: '6px 10px',
    marginBottom: 10,
    fontSize: 12,
    color: '#92400e',
  },
  section: {
    marginBottom: 10,
  },
  label: {
    display: 'block',
    fontWeight: 500,
    marginBottom: 4,
    color: '#374151',
  },
  modeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 4,
  },
  modeButton: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: '6px 4px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
  modeButtonActive: {
    borderColor: '#6366f1',
    backgroundColor: '#eef2ff',
    color: '#4f46e5',
  },
  modeIcon: {
    fontSize: 16,
  },
  modeLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  select: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    backgroundColor: '#ffffff',
    fontSize: 13,
    outline: 'none',
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 4,
    padding: '4px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    minHeight: 34,
    backgroundColor: '#ffffff',
  },
  tagBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 2,
    padding: '2px 6px',
    backgroundColor: '#e0e7ff',
    color: '#3730a3',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 500,
  },
  tagRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontSize: 14,
    lineHeight: 1,
    color: '#6366f1',
  },
  tagInput: {
    flex: 1,
    minWidth: 80,
    border: 'none',
    outline: 'none',
    fontSize: 13,
    padding: '2px 0',
  },
  errorBanner: {
    backgroundColor: '#fee2e2',
    border: '1px solid #f87171',
    borderRadius: 4,
    padding: '6px 10px',
    marginBottom: 8,
    fontSize: 12,
    color: '#991b1b',
  },
  successBanner: {
    backgroundColor: '#d1fae5',
    border: '1px solid #34d399',
    borderRadius: 4,
    padding: '6px 10px',
    marginBottom: 8,
    fontSize: 12,
    color: '#065f46',
  },
  clipButton: {
    width: '100%',
    padding: '10px 16px',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    borderRadius: 8,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  },
  clipButtonDisabled: {
    backgroundColor: '#a5b4fc',
    cursor: 'not-allowed',
  },
  historySection: {
    marginTop: 10,
    borderTop: '1px solid #f3f4f6',
    paddingTop: 8,
  },
  historyToggle: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    color: '#6b7280',
    padding: 0,
  },
  historyList: {
    listStyle: 'none',
    margin: '6px 0 0',
    padding: 0,
  },
  historyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '3px 0',
    fontSize: 12,
  },
  historySuccess: {
    color: '#10b981',
  },
  historyError: {
    color: '#ef4444',
  },
  historyTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: 260,
    color: '#374151',
  },
};
