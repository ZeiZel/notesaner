/**
 * Settings page for the Notesaner web clipper browser extension.
 *
 * Allows the user to configure:
 * - Server URL (Notesaner instance URL)
 * - Authentication (OAuth token)
 * - Default destination folder
 * - Default tags
 * - Default clip template
 */

import React, { useState, useCallback } from 'react';
import { useClipperStore } from './clip-store';
import { DEFAULT_TEMPLATES } from './clip-templates';
import type { FolderOption } from './ClipperPopup.types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClipperSettingsProps {
  /**
   * Called when the user clicks "Connect" or "Verify" to validate the token.
   * Receives the current serverUrl and returns the display name of the
   * authenticated user, or throws on failure.
   */
  onConnect: (serverUrl: string, token: string) => Promise<{ userName: string }>;

  /** Available folders to show in the default destination picker. */
  folders?: FolderOption[];

  /** Available tags for the default tags picker. */
  availableTags?: string[];

  /** Called when the user wants to navigate back to the popup. */
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClipperSettings({
  onConnect,
  folders = [],
  availableTags = [],
  onBack,
}: ClipperSettingsProps) {
  const {
    serverUrl,
    authToken,
    connectionStatus,
    connectionError,
    destination,
    tags,
    templateId,
    setServerUrl,
    setAuthToken,
    setConnectionStatus,
    disconnect,
    setDestination,
    setTags,
    setTemplateId,
  } = useClipperStore();

  const [localServerUrl, setLocalServerUrl] = useState(serverUrl);
  const [localToken, setLocalToken] = useState(authToken ?? '');
  const [connectMessage, setConnectMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [defaultTagInput, setDefaultTagInput] = useState('');

  const isConnected = connectionStatus === 'connected';

  const handleConnect = useCallback(async () => {
    const trimmedUrl = localServerUrl.trim().replace(/\/$/, '');
    const trimmedToken = localToken.trim();

    if (!trimmedUrl) {
      setConnectMessage('Please enter a server URL.');
      return;
    }

    setIsConnecting(true);
    setConnectMessage('');
    setConnectionStatus('connecting');
    setServerUrl(trimmedUrl);

    try {
      const { userName } = await onConnect(trimmedUrl, trimmedToken);
      setAuthToken(trimmedToken);
      setConnectMessage(`Connected as ${userName}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setConnectionStatus('error', msg);
      setConnectMessage(`Error: ${msg}`);
    } finally {
      setIsConnecting(false);
    }
  }, [localServerUrl, localToken, onConnect, setConnectionStatus, setServerUrl, setAuthToken]);

  const handleDisconnect = useCallback(() => {
    disconnect();
    setLocalToken('');
    setConnectMessage('');
  }, [disconnect]);

  const handleAddDefaultTag = useCallback(() => {
    if (!defaultTagInput.trim()) return;
    setTags([...tags, defaultTagInput.trim().toLowerCase()]);
    setDefaultTagInput('');
  }, [defaultTagInput, tags, setTags]);

  const handleRemoveDefaultTag = useCallback(
    (tag: string) => {
      setTags(tags.filter((t) => t !== tag));
    },
    [tags, setTags],
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        {onBack && (
          <button type="button" style={styles.backButton} onClick={onBack} aria-label="Back">
            ←
          </button>
        )}
        <h1 style={styles.title}>Clipper Settings</h1>
      </div>

      {/* Server URL */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Connection</h2>

        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="server-url">
            Notesaner Server URL
          </label>
          <input
            id="server-url"
            type="url"
            style={styles.input}
            value={localServerUrl}
            onChange={(e) => setLocalServerUrl(e.target.value)}
            placeholder="https://notes.example.com"
            disabled={isConnected}
          />
        </div>

        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="auth-token">
            Auth Token
          </label>
          <input
            id="auth-token"
            type="password"
            style={styles.input}
            value={localToken}
            onChange={(e) => setLocalToken(e.target.value)}
            placeholder="Paste your API token here"
            disabled={isConnected}
          />
          <p style={styles.hint}>Generate a token in Notesaner under Settings → API Tokens.</p>
        </div>

        {connectMessage && (
          <p style={connectionStatus === 'error' ? styles.errorText : styles.successText}>
            {connectMessage}
          </p>
        )}
        {connectionError && connectionStatus === 'error' && !connectMessage && (
          <p style={styles.errorText}>{connectionError}</p>
        )}

        <div style={styles.buttonRow}>
          {isConnected ? (
            <button type="button" style={styles.dangerButton} onClick={handleDisconnect}>
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              style={{
                ...styles.primaryButton,
                ...(isConnecting ? styles.disabledButton : {}),
              }}
              onClick={handleConnect}
              disabled={isConnecting}
            >
              {isConnecting ? 'Connecting…' : 'Connect'}
            </button>
          )}
        </div>
      </section>

      {/* Default clip settings */}
      <section style={styles.section}>
        <h2 style={styles.sectionTitle}>Defaults</h2>

        {/* Default template */}
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="default-template">
            Default template
          </label>
          <select
            id="default-template"
            style={styles.select}
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {Object.values(DEFAULT_TEMPLATES).map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name} — {tpl.description}
              </option>
            ))}
          </select>
        </div>

        {/* Default destination */}
        <div style={styles.fieldGroup}>
          <label style={styles.label} htmlFor="default-destination">
            Default destination
          </label>
          <select
            id="default-destination"
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
        </div>

        {/* Default tags */}
        <div style={styles.fieldGroup}>
          <label style={styles.label}>Default tags</label>
          <div style={styles.tagContainer}>
            {tags.map((tag) => (
              <span key={tag} style={styles.tagBadge}>
                {tag}
                <button
                  type="button"
                  style={styles.tagRemove}
                  onClick={() => handleRemoveDefaultTag(tag)}
                  aria-label={`Remove tag ${tag}`}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              style={styles.tagInput}
              value={defaultTagInput}
              onChange={(e) => setDefaultTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  handleAddDefaultTag();
                }
              }}
              placeholder="Add default tag…"
              list="default-tag-suggestions"
            />
            <datalist id="default-tag-suggestions">
              {availableTags
                .filter((t) => !tags.includes(t))
                .map((t) => (
                  <option key={t} value={t} />
                ))}
            </datalist>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline styles
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
    maxHeight: 560,
    overflowY: 'auto',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  backButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    padding: '0 4px',
    color: '#374151',
  },
  title: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  section: {
    marginBottom: 16,
    paddingBottom: 16,
    borderBottom: '1px solid #f3f4f6',
  },
  sectionTitle: {
    margin: '0 0 10px',
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#6b7280',
  },
  fieldGroup: {
    marginBottom: 10,
  },
  label: {
    display: 'block',
    fontWeight: 500,
    marginBottom: 4,
    color: '#374151',
  },
  input: {
    width: '100%',
    padding: '6px 8px',
    border: '1px solid #d1d5db',
    borderRadius: 6,
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box',
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
  hint: {
    margin: '4px 0 0',
    fontSize: 11,
    color: '#9ca3af',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 12,
    margin: '4px 0',
  },
  successText: {
    color: '#059669',
    fontSize: 12,
    margin: '4px 0',
  },
  buttonRow: {
    display: 'flex',
    gap: 8,
    marginTop: 10,
  },
  primaryButton: {
    padding: '7px 16px',
    backgroundColor: '#6366f1',
    color: '#ffffff',
    border: 'none',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  dangerButton: {
    padding: '7px 16px',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
  disabledButton: {
    backgroundColor: '#a5b4fc',
    cursor: 'not-allowed',
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
};
