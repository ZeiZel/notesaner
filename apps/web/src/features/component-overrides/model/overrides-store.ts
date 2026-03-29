/**
 * overrides-store.ts
 *
 * Zustand store for the component override editor workflow.
 *
 * Responsibilities:
 *   - Track the list of existing overrides and the component registry
 *   - Manage the "active editor" state (which component is being edited)
 *   - Track async operation states (save, compile, revert)
 *
 * UI state (editor open/closed, active tab) lives in local useState.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { componentOverridesApi } from '../api/component-overrides-api';
import type { ComponentOverride, OverridableComponentMeta } from '@notesaner/component-sdk';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type OverrideOpStatus = 'idle' | 'pending' | 'success' | 'error';

export interface OverrideOpState {
  status: OverrideOpStatus;
  error?: string;
}

interface OverridesStoreState {
  /** Loaded overrides by componentId. */
  overrides: Record<string, ComponentOverride>;
  /** Component registry (loaded once). */
  registry: OverridableComponentMeta[];
  /** Per-operation tracking keyed by componentId. */
  operations: Record<string, OverrideOpState>;
  /** Which componentId is currently open in the editor. */
  activeComponentId: string | null;
  /** Unsaved source code in the editor (keyed by componentId). */
  draftSources: Record<string, string>;

  // Actions
  loadRegistry: (token: string, workspaceId: string) => Promise<void>;
  loadOverrides: (token: string, workspaceId: string) => Promise<void>;
  openEditor: (componentId: string) => void;
  closeEditor: () => void;
  setDraftSource: (componentId: string, source: string) => void;
  saveOverride: (token: string, workspaceId: string, componentId: string) => Promise<void>;
  compileOverride: (token: string, workspaceId: string, componentId: string) => Promise<void>;
  revertOverride: (token: string, workspaceId: string, componentId: string) => Promise<void>;
  deleteOverride: (token: string, workspaceId: string, componentId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store implementation
// ---------------------------------------------------------------------------

export const useOverridesStore = create<OverridesStoreState>()(
  devtools(
    (set, get) => ({
      overrides: {},
      registry: [],
      operations: {},
      activeComponentId: null,
      draftSources: {},

      loadRegistry: async (token, workspaceId) => {
        const registry = await componentOverridesApi.getRegistry(token, workspaceId);
        set({ registry }, false, 'overrides/loadRegistry');
      },

      loadOverrides: async (token, workspaceId) => {
        const list = await componentOverridesApi.list(token, workspaceId);
        const overrides: Record<string, ComponentOverride> = {};
        for (const o of list) {
          overrides[o.componentId] = o;
        }
        set({ overrides }, false, 'overrides/loadOverrides');
      },

      openEditor: (componentId) => {
        const existing = get().overrides[componentId];
        const meta = get().registry.find((r) => r.id === componentId);
        const draft = get().draftSources[componentId];

        set(
          (s) => ({
            activeComponentId: componentId,
            draftSources: {
              ...s.draftSources,
              [componentId]: draft ?? existing?.sourceCode ?? meta?.starterTemplate ?? '',
            },
          }),
          false,
          'overrides/openEditor',
        );
      },

      closeEditor: () => set({ activeComponentId: null }, false, 'overrides/closeEditor'),

      setDraftSource: (componentId, source) =>
        set(
          (s) => ({ draftSources: { ...s.draftSources, [componentId]: source } }),
          false,
          'overrides/setDraftSource',
        ),

      saveOverride: async (token, workspaceId, componentId) => {
        const source = get().draftSources[componentId];
        if (source === undefined) return;

        set(
          (s) => ({ operations: { ...s.operations, [componentId]: { status: 'pending' } } }),
          false,
          'overrides/saveOverride/pending',
        );

        try {
          const existing = get().overrides[componentId];
          const updated = existing
            ? await componentOverridesApi.update(token, workspaceId, componentId, {
                sourceCode: source,
              })
            : await componentOverridesApi.create(token, workspaceId, {
                componentId,
                sourceCode: source,
              });

          set(
            (s) => ({
              overrides: { ...s.overrides, [componentId]: updated },
              operations: { ...s.operations, [componentId]: { status: 'success' } },
            }),
            false,
            'overrides/saveOverride/success',
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Save failed';
          set(
            (s) => ({
              operations: { ...s.operations, [componentId]: { status: 'error', error: msg } },
            }),
            false,
            'overrides/saveOverride/error',
          );
        }
      },

      compileOverride: async (token, workspaceId, componentId) => {
        set(
          (s) => ({ operations: { ...s.operations, [componentId]: { status: 'pending' } } }),
          false,
          'overrides/compileOverride/pending',
        );

        try {
          const updated = await componentOverridesApi.compile(token, workspaceId, componentId);
          set(
            (s) => ({
              overrides: { ...s.overrides, [componentId]: updated },
              operations: { ...s.operations, [componentId]: { status: 'success' } },
            }),
            false,
            'overrides/compileOverride/success',
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Compile failed';
          set(
            (s) => ({
              operations: { ...s.operations, [componentId]: { status: 'error', error: msg } },
            }),
            false,
            'overrides/compileOverride/error',
          );
        }
      },

      revertOverride: async (token, workspaceId, componentId) => {
        set(
          (s) => ({ operations: { ...s.operations, [componentId]: { status: 'pending' } } }),
          false,
          'overrides/revertOverride/pending',
        );

        try {
          const updated = await componentOverridesApi.revert(token, workspaceId, componentId);
          set(
            (s) => ({
              overrides: { ...s.overrides, [componentId]: updated },
              draftSources: { ...s.draftSources, [componentId]: updated.sourceCode },
              operations: { ...s.operations, [componentId]: { status: 'success' } },
            }),
            false,
            'overrides/revertOverride/success',
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Revert failed';
          set(
            (s) => ({
              operations: { ...s.operations, [componentId]: { status: 'error', error: msg } },
            }),
            false,
            'overrides/revertOverride/error',
          );
        }
      },

      deleteOverride: async (token, workspaceId, componentId) => {
        set(
          (s) => ({ operations: { ...s.operations, [componentId]: { status: 'pending' } } }),
          false,
          'overrides/deleteOverride/pending',
        );

        try {
          await componentOverridesApi.delete(token, workspaceId, componentId);
          set(
            (s) => {
              const { [componentId]: _removed, ...remaining } = s.overrides;
              return {
                overrides: remaining,
                operations: { ...s.operations, [componentId]: { status: 'success' } },
                activeComponentId: s.activeComponentId === componentId ? null : s.activeComponentId,
              };
            },
            false,
            'overrides/deleteOverride/success',
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Delete failed';
          set(
            (s) => ({
              operations: { ...s.operations, [componentId]: { status: 'error', error: msg } },
            }),
            false,
            'overrides/deleteOverride/error',
          );
        }
      },
    }),
    { name: 'OverridesStore' },
  ),
);

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export function selectOverrideOp(
  operations: Record<string, OverrideOpState>,
  componentId: string,
): OverrideOpState {
  return operations[componentId] ?? { status: 'idle' };
}
