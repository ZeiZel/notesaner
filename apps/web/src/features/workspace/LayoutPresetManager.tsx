/**
 * LayoutPresetManager.tsx
 *
 * UI component for managing named layout presets.
 *
 * Provides:
 *   - A list of saved layout presets
 *   - Save current layout as a new preset
 *   - Load a preset by clicking on it
 *   - Delete a preset
 *   - Mark a preset as default (restored on login)
 *
 * Design notes:
 *   - No useEffect for data fetching: preset list is loaded via a callback
 *     triggered when the panel opens, keeping the component pure.
 *   - Form submission handled via event handler, not useEffect.
 *   - Uses native form elements styled with Tailwind for consistency.
 */

'use client';

import { useCallback, useRef, useState } from 'react';
import { useAuthStore } from '@/shared/stores/auth-store';
import { useWorkspaceStore } from '@/shared/stores/workspace-store';
import {
  fetchLayoutPresets,
  saveLayoutPreset,
  loadLayoutPreset,
  deleteLayoutPreset,
  type LayoutPreset,
} from './layout-persistence';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function SaveIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M11.5 1h-7A1.5 1.5 0 003 2.5v11A1.5 1.5 0 004.5 15h7a1.5 1.5 0 001.5-1.5v-11A1.5 1.5 0 0011.5 1zM5 2h6v3H5V2zm6 12H5V9h6v5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
      <path d="M5.5 1a.5.5 0 00-.5.5V2H2.5a.5.5 0 000 1H3v10a1 1 0 001 1h8a1 1 0 001-1V3h.5a.5.5 0 000-1H10v-.5A.5.5 0 009.5 1h-4zM6 2h4v.5H6V2zM4 3h8v10H4V3zm2 2v6a.5.5 0 001 0V5a.5.5 0 00-1 0zm3 0v6a.5.5 0 001 0V5a.5.5 0 00-1 0z" />
    </svg>
  );
}

function LayoutIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
      <path d="M2 2h5v5H2V2zm7 0h5v12H9V2zM2 9h5v5H2V9z" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      className="h-3 w-3"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M8 1l2.245 4.549 5.02.73-3.633 3.541.857 5.001L8 12.347 3.511 14.82l.857-5.001L.735 6.279l5.02-.73L8 1z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface LayoutPresetManagerProps {
  /** Whether the preset panel is visible. */
  isOpen: boolean;
  /** Callback to close the panel. */
  onClose: () => void;
}

export function LayoutPresetManager({ isOpen, onClose }: LayoutPresetManagerProps) {
  const token = useAuthStore((s) => s.accessToken);
  const workspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);

  const [presets, setPresets] = useState<LayoutPreset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPresetName, setNewPresetName] = useState('');
  const [isDefaultChecked, setIsDefaultChecked] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch presets when the panel opens — called as a callback, not an effect
  const loadPresets = useCallback(async () => {
    if (!token || !workspaceId) return;

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchLayoutPresets(token, workspaceId);
      setPresets(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load presets');
    } finally {
      setIsLoading(false);
    }
  }, [token, workspaceId]);

  // Load presets when panel opens — triggered via onTransitionEnd or on first render
  // Using a ref to track if we've loaded for this open cycle
  const hasLoaded = useRef(false);
  if (isOpen && !hasLoaded.current) {
    hasLoaded.current = true;
    void loadPresets();
  }
  if (!isOpen && hasLoaded.current) {
    hasLoaded.current = false;
  }

  if (!isOpen) return null;

  async function handleSavePreset(e: React.FormEvent) {
    e.preventDefault();

    const name = newPresetName.trim();
    if (!name || !token || !workspaceId) return;

    setIsSaving(true);
    setError(null);

    try {
      const created = await saveLayoutPreset(token, workspaceId, name, isDefaultChecked);
      setPresets((prev) => [...prev, created]);
      setNewPresetName('');
      setIsDefaultChecked(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save preset');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLoadPreset(presetId: string) {
    if (!token || !workspaceId) return;

    try {
      await loadLayoutPreset(token, workspaceId, presetId);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load preset');
    }
  }

  async function handleDeletePreset(presetId: string) {
    if (!token || !workspaceId) return;

    try {
      await deleteLayoutPreset(token, workspaceId, presetId);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete preset');
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Layout presets"
      className="absolute right-0 top-full z-50 mt-1 w-72 rounded-lg border border-border bg-background-surface shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <LayoutIcon />
          Layout Presets
        </div>
        <button
          onClick={onClose}
          aria-label="Close layout presets"
          className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted transition-colors hover:bg-secondary hover:text-foreground"
        >
          <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden="true">
            <path d="M4.646 4.646a.5.5 0 01.708 0L8 7.293l2.646-2.647a.5.5 0 01.708.708L8.707 8l2.647 2.646a.5.5 0 01-.708.708L8 8.707l-2.646 2.647a.5.5 0 01-.708-.708L7.293 8 4.646 5.354a.5.5 0 010-.708z" />
          </svg>
        </button>
      </div>

      {/* Error message */}
      {error !== null && (
        <div className="border-b border-border bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Preset list */}
      <div className="max-h-48 overflow-y-auto">
        {isLoading && (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-foreground-muted">Loading presets...</span>
          </div>
        )}

        {!isLoading && presets.length === 0 && (
          <div className="flex items-center justify-center py-6">
            <span className="text-xs text-foreground-muted">No saved presets</span>
          </div>
        )}

        {!isLoading &&
          presets.map((preset) => (
            <div
              key={preset.id}
              className="group flex items-center gap-2 border-b border-border/50 px-3 py-2 last:border-b-0"
            >
              <button
                onClick={() => handleLoadPreset(preset.id)}
                className="flex flex-1 items-center gap-2 rounded px-1 py-0.5 text-left text-xs text-foreground transition-colors hover:bg-secondary"
              >
                <StarIcon filled={preset.isDefault} />
                <span className="truncate">{preset.name}</span>
              </button>

              <button
                onClick={() => handleDeletePreset(preset.id)}
                aria-label={`Delete preset "${preset.name}"`}
                className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
      </div>

      {/* Save new preset form */}
      <form onSubmit={handleSavePreset} className="border-t border-border p-3">
        <label
          htmlFor="preset-name"
          className="mb-1.5 block text-xs font-medium text-foreground-muted"
        >
          Save current layout
        </label>
        <div className="flex gap-1.5">
          <input
            ref={inputRef}
            id="preset-name"
            type="text"
            value={newPresetName}
            onChange={(e) => setNewPresetName(e.target.value)}
            placeholder="Preset name..."
            disabled={isSaving}
            className="flex-1 rounded border border-border bg-background-input px-2 py-1 text-xs text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isSaving || newPresetName.trim().length === 0}
            aria-label="Save layout preset"
            className="flex h-7 items-center gap-1 rounded bg-primary px-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            <SaveIcon />
            Save
          </button>
        </div>

        <label className="mt-2 flex items-center gap-1.5 text-xs text-foreground-muted">
          <input
            type="checkbox"
            checked={isDefaultChecked}
            onChange={(e) => setIsDefaultChecked(e.target.checked)}
            disabled={isSaving}
            className="rounded border-border"
          />
          Set as default (restored on login)
        </label>
      </form>
    </div>
  );
}
