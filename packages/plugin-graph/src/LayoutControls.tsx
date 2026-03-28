'use client';

/**
 * LayoutControls — UI for saving, loading, and resetting named graph layouts.
 *
 * Renders three interactive areas:
 * 1. Layout name input  — user types a name before saving.
 * 2. Save button        — persists the current node positions under that name.
 * 3. Layout dropdown    — lists saved layouts; selecting one restores positions.
 * 4. Reset button       — clears the active layout so d3-force re-runs freely.
 *
 * This component is intentionally dumb: it receives current positions from
 * the parent (GraphView) via `getCurrentPositions`, and notifies the parent
 * when a layout is selected so it can apply positions to the simulation.
 */

import { useState, useRef } from 'react';
import {
  useGraphLayoutStore,
  selectLayoutList,
  selectActiveLayout,
  type NodePosition,
} from './graph-layout-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LayoutControlsProps {
  /**
   * Called by the Save button.  Parent should supply current node positions
   * so the store can persist them.
   */
  getCurrentPositions: () => Record<string, NodePosition>;

  /**
   * Called when the user selects a layout from the dropdown or clicks Reset.
   * - Receives the positions map to apply (null = reset to force-simulation).
   */
  onLayoutRestore: (positions: Record<string, NodePosition> | null) => void;
}

// ---------------------------------------------------------------------------
// Sub-component: compact select-style dropdown built from plain elements
// ---------------------------------------------------------------------------

function LayoutDropdown({
  layouts,
  activeId,
  onSelect,
}: {
  layouts: ReturnType<typeof selectLayoutList>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (layouts.length === 0) return null;

  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
      }}
      aria-label="Select saved layout"
      className="h-7 rounded-md border border-border bg-card/90 px-1.5 text-xs text-foreground backdrop-blur focus:outline-none focus:ring-1 focus:ring-ring"
    >
      <option value="" disabled>
        Load layout…
      </option>
      {layouts.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * LayoutControls renders the save / load / reset row.
 *
 * It subscribes to the Zustand store for layout list and active layout state,
 * but delegates position capture and application to the parent via callbacks.
 */
export function LayoutControls({ getCurrentPositions, onLayoutRestore }: LayoutControlsProps) {
  const [layoutName, setLayoutName] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const saveStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layouts = useGraphLayoutStore(selectLayoutList);
  const activeLayout = useGraphLayoutStore(selectActiveLayout);

  const { saveLayout, setActiveLayoutId } = useGraphLayoutStore.getState();

  // ----- handlers -----

  function handleSave() {
    const positions = getCurrentPositions();
    const name = layoutName.trim() || activeLayout?.name || 'Untitled layout';
    saveLayout(name, positions);
    setLayoutName('');

    // Brief "Saved!" feedback
    setSaveStatus('saved');
    if (saveStatusTimerRef.current) clearTimeout(saveStatusTimerRef.current);
    saveStatusTimerRef.current = setTimeout(() => setSaveStatus('idle'), 1500);
  }

  function handleSelect(id: string) {
    const state = useGraphLayoutStore.getState();
    const layout = state.layouts[id];
    if (!layout) return;
    setActiveLayoutId(id);
    onLayoutRestore(layout.positions);
  }

  function handleReset() {
    setActiveLayoutId(null);
    onLayoutRestore(null);
  }

  // ----- render -----

  return (
    <div className="pointer-events-auto flex items-center gap-1" aria-label="Graph layout controls">
      {/* Layout name input */}
      <input
        type="text"
        value={layoutName}
        onChange={(e) => setLayoutName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSave();
        }}
        placeholder={activeLayout?.name ?? 'Layout name…'}
        aria-label="Layout name"
        className="h-7 w-32 rounded-md border border-border bg-card/90 px-2 text-xs text-foreground backdrop-blur placeholder:text-foreground-muted focus:outline-none focus:ring-1 focus:ring-ring"
      />

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        title="Save current layout"
        aria-label="Save current layout"
        className="flex h-7 items-center gap-1 rounded-md border border-border bg-card/90 px-2 text-xs text-foreground backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
      >
        {saveStatus === 'saved' ? (
          <>
            {/* Checkmark icon */}
            <svg
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-3 w-3 text-emerald-500"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                clipRule="evenodd"
              />
            </svg>
            Saved
          </>
        ) : (
          <>
            {/* Floppy-disk icon */}
            <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
              <path d="M2.5 1A1.5 1.5 0 0 0 1 2.5v11A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5V5.621a1.5 1.5 0 0 0-.44-1.06L11.44 1.44A1.5 1.5 0 0 0 10.378 1H2.5Zm0 1.5h7.878l2.622 2.622V13.5H11v-4a.5.5 0 0 0-.5-.5h-5a.5.5 0 0 0-.5.5v4H2.5v-11ZM6 9.5h4v4H6v-4Z" />
            </svg>
            Save
          </>
        )}
      </button>

      {/* Layout selector dropdown */}
      <LayoutDropdown
        layouts={layouts}
        activeId={activeLayout?.id ?? null}
        onSelect={handleSelect}
      />

      {/* Reset button — only shown when a layout is active */}
      {activeLayout && (
        <button
          type="button"
          onClick={handleReset}
          title="Reset to force-simulation layout"
          aria-label="Reset to force-simulation layout"
          className="flex h-7 items-center gap-1 rounded-md border border-border bg-card/90 px-2 text-xs text-foreground-muted backdrop-blur transition-colors hover:bg-accent hover:text-foreground"
        >
          {/* Reset/undo icon */}
          <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M1.5 8a6.5 6.5 0 1 1 13 0 6.5 6.5 0 0 1-13 0ZM8 0a8 8 0 1 0 0 16A8 8 0 0 0 8 0Zm-.75 4.75a.75.75 0 0 1 1.5 0v4.5l2.27 2.27a.75.75 0 1 1-1.06 1.06l-2.5-2.5a.75.75 0 0 1-.22-.53V4.75Z"
              clipRule="evenodd"
            />
          </svg>
          Reset
        </button>
      )}
    </div>
  );
}
