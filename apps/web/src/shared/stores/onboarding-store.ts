/**
 * onboarding-store.ts
 *
 * Zustand store for first-time user onboarding flow.
 *
 * Responsibilities:
 *   - Track onboarding completion state (persisted in localStorage)
 *   - Track current step in the wizard
 *   - Store user input collected during onboarding (name, workspace name)
 *   - Provide actions for step navigation and completion
 *
 * Design notes:
 *   - Persisted to localStorage so onboarding only shows once per device.
 *   - The `hasCompletedOnboarding` flag is also reconciled with the server
 *     (via user profile flags) when the API is available.
 *   - Step indices are zero-based.
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

// ---- Types ----------------------------------------------------------------

export type OnboardingStepId = 'welcome' | 'create-workspace' | 'tour' | 'create-note';

export interface OnboardingStepConfig {
  id: OnboardingStepId;
  title: string;
  description: string;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  {
    id: 'welcome',
    title: 'Welcome to Notesaner',
    description: 'Tell us a bit about yourself to personalize your experience.',
  },
  {
    id: 'create-workspace',
    title: 'Create your workspace',
    description: 'Workspaces organize your notes into separate collections.',
  },
  {
    id: 'tour',
    title: 'Quick tour',
    description: 'Learn the key areas of the interface to get productive fast.',
  },
  {
    id: 'create-note',
    title: 'Create your first note',
    description: 'Start writing! You can always come back and explore later.',
  },
] as const;

// ---- Store State & Actions ------------------------------------------------

interface OnboardingState {
  // ---- State ----

  /** Whether the user has completed (or skipped) onboarding. */
  hasCompletedOnboarding: boolean;
  /** Current step index (0-based). */
  currentStep: number;
  /** Display name entered during the welcome step. */
  displayName: string;
  /** Workspace name entered during workspace creation step. */
  workspaceName: string;
  /** Whether the wizard modal is visible. */
  isOpen: boolean;

  // ---- Actions ----

  /** Open the onboarding wizard. */
  open: () => void;
  /** Close the wizard without completing. */
  close: () => void;
  /** Move to the next step. */
  nextStep: () => void;
  /** Move to the previous step. */
  previousStep: () => void;
  /** Jump to a specific step by index. */
  goToStep: (step: number) => void;
  /** Update the display name. */
  setDisplayName: (name: string) => void;
  /** Update the workspace name. */
  setWorkspaceName: (name: string) => void;
  /** Mark onboarding as completed and close the wizard. */
  complete: () => void;
  /** Skip onboarding entirely — marks as completed. */
  skip: () => void;
  /** Reset onboarding state (for testing or re-onboarding). */
  reset: () => void;
}

// ---- Store Implementation -------------------------------------------------

const TOTAL_STEPS = ONBOARDING_STEPS.length;

export const useOnboardingStore = create<OnboardingState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        hasCompletedOnboarding: false,
        currentStep: 0,
        displayName: '',
        workspaceName: '',
        isOpen: false,

        // Actions

        open: () => set({ isOpen: true }, false, 'onboarding/open'),

        close: () => set({ isOpen: false }, false, 'onboarding/close'),

        nextStep: () =>
          set(
            (state) => {
              const next = state.currentStep + 1;
              if (next >= TOTAL_STEPS) {
                return {
                  hasCompletedOnboarding: true,
                  isOpen: false,
                  currentStep: TOTAL_STEPS - 1,
                };
              }
              return { currentStep: next };
            },
            false,
            'onboarding/nextStep',
          ),

        previousStep: () =>
          set(
            (state) => ({
              currentStep: Math.max(0, state.currentStep - 1),
            }),
            false,
            'onboarding/previousStep',
          ),

        goToStep: (step) =>
          set(
            { currentStep: Math.max(0, Math.min(TOTAL_STEPS - 1, step)) },
            false,
            'onboarding/goToStep',
          ),

        setDisplayName: (displayName) => set({ displayName }, false, 'onboarding/setDisplayName'),

        setWorkspaceName: (workspaceName) =>
          set({ workspaceName }, false, 'onboarding/setWorkspaceName'),

        complete: () =>
          set({ hasCompletedOnboarding: true, isOpen: false }, false, 'onboarding/complete'),

        skip: () => set({ hasCompletedOnboarding: true, isOpen: false }, false, 'onboarding/skip'),

        reset: () =>
          set(
            {
              hasCompletedOnboarding: false,
              currentStep: 0,
              displayName: '',
              workspaceName: '',
              isOpen: false,
            },
            false,
            'onboarding/reset',
          ),
      }),
      {
        name: 'notesaner-onboarding',
        partialize: (state) => ({
          hasCompletedOnboarding: state.hasCompletedOnboarding,
          displayName: state.displayName,
          workspaceName: state.workspaceName,
        }),
      },
    ),
    { name: 'OnboardingStore' },
  ),
);

// ---- Selectors ------------------------------------------------------------

/**
 * Derive the current step configuration from the step index.
 */
export function selectCurrentStepConfig(currentStep: number): OnboardingStepConfig {
  return ONBOARDING_STEPS[currentStep] ?? ONBOARDING_STEPS[0];
}

/**
 * Derive the completion percentage (0-100).
 */
export function selectProgressPercent(currentStep: number): number {
  return Math.round(((currentStep + 1) / TOTAL_STEPS) * 100);
}

/**
 * Check whether onboarding should be shown for a first-time user.
 */
export function shouldShowOnboarding(
  hasCompletedOnboarding: boolean,
  isAuthenticated: boolean,
): boolean {
  return isAuthenticated && !hasCompletedOnboarding;
}
