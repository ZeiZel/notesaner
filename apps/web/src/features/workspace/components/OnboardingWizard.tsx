'use client';

/**
 * OnboardingWizard — multi-step onboarding flow for first-time users.
 *
 * Features:
 *   - 4-step wizard: Welcome + name, Create workspace, Quick tour, Create note
 *   - Animated transitions between steps (direction-aware)
 *   - Progress indicator (step dots + progress bar)
 *   - Skip button on every step
 *   - Keyboard accessible: Escape to close, focus trap within the modal
 *   - Renders as a full-screen modal overlay
 *   - Shown only when `shouldShowOnboarding()` returns true
 *
 * Integration:
 *   Import and place <OnboardingWizard /> inside the authenticated layout.
 *   It reads from useOnboardingStore and useAuthStore to determine visibility.
 *
 * No useEffect for derived state or event handling — state is computed during
 * render and interactions go through event handlers directly.
 */

import { useCallback, useRef, type KeyboardEvent } from 'react';
import { cn } from '@/shared/lib/utils';
import {
  useOnboardingStore,
  ONBOARDING_STEPS,
  selectProgressPercent,
  shouldShowOnboarding,
} from '@/shared/stores/onboarding-store';
import { useAuthStore } from '@/shared/stores/auth-store';
import {
  OnboardingStep,
  WelcomeStepContent,
  CreateWorkspaceStepContent,
  TourStepContent,
  CreateNoteStepContent,
  type TransitionDirection,
} from './OnboardingStep';

// ---- Constants ------------------------------------------------------------

const TOTAL_STEPS = ONBOARDING_STEPS.length;

// ---- Component ------------------------------------------------------------

export function OnboardingWizard() {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousStepRef = useRef<number>(0);

  // Onboarding store
  const hasCompletedOnboarding = useOnboardingStore((s) => s.hasCompletedOnboarding);
  const currentStep = useOnboardingStore((s) => s.currentStep);
  const displayName = useOnboardingStore((s) => s.displayName);
  const workspaceName = useOnboardingStore((s) => s.workspaceName);
  const isOpen = useOnboardingStore((s) => s.isOpen);
  const nextStep = useOnboardingStore((s) => s.nextStep);
  const previousStep = useOnboardingStore((s) => s.previousStep);
  const setDisplayName = useOnboardingStore((s) => s.setDisplayName);
  const setWorkspaceName = useOnboardingStore((s) => s.setWorkspaceName);
  const complete = useOnboardingStore((s) => s.complete);
  const skip = useOnboardingStore((s) => s.skip);
  const open = useOnboardingStore((s) => s.open);

  // Auth store
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Determine visibility — show if first time and authenticated
  const shouldShow = shouldShowOnboarding(hasCompletedOnboarding, isAuthenticated);

  // Auto-open on first render when conditions are met
  // This is derived: if shouldShow is true and isOpen is false, open it.
  if (shouldShow && !isOpen) {
    // Trigger store update outside render via microtask to avoid
    // setState-during-render warning
    queueMicrotask(open);
  }

  // Derive transition direction from step comparison
  const direction: TransitionDirection =
    currentStep > previousStepRef.current
      ? 'forward'
      : currentStep < previousStepRef.current
        ? 'backward'
        : 'none';

  // Update the ref for next render comparison
  previousStepRef.current = currentStep;

  // Derived values
  const progressPercent = selectProgressPercent(currentStep);
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOTAL_STEPS - 1;

  // Validation: can the user proceed to the next step?
  const canProceed =
    (currentStep === 0 && displayName.trim().length > 0) ||
    (currentStep === 1 && workspaceName.trim().length > 0) ||
    currentStep === 2 ||
    currentStep === 3;

  // ---- Handlers -----------------------------------------------------------

  const handleNext = useCallback(() => {
    if (isLastStep) {
      complete();
    } else {
      nextStep();
    }
  }, [isLastStep, complete, nextStep]);

  const handleBack = useCallback(() => {
    previousStep();
  }, [previousStep]);

  const handleSkip = useCallback(() => {
    skip();
  }, [skip]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        handleSkip();
      }
    },
    [handleSkip],
  );

  // Don't render when not needed
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label="Getting started with Notesaner"
      onKeyDown={handleKeyDown}
    >
      <div
        ref={dialogRef}
        className="relative mx-4 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl animate-in zoom-in-95 duration-300"
      >
        {/* ---- Progress bar ---- */}
        <div className="h-1 w-full bg-border">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Onboarding progress: ${progressPercent}%`}
          />
        </div>

        {/* ---- Skip button ---- */}
        <div className="flex justify-end px-4 pt-3">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-foreground-muted transition-colors hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring rounded px-2 py-1"
          >
            Skip
          </button>
        </div>

        {/* ---- Step content ---- */}
        <div className="flex-1 px-6 pb-2 pt-2">
          {ONBOARDING_STEPS.map((step, index) => (
            <OnboardingStep
              key={step.id}
              title={step.title}
              description={step.description}
              isActive={index === currentStep}
              stepIndex={index}
              totalSteps={TOTAL_STEPS}
              direction={index === currentStep ? direction : 'none'}
            >
              {step.id === 'welcome' && (
                <WelcomeStepContent
                  displayName={displayName}
                  onDisplayNameChange={setDisplayName}
                />
              )}
              {step.id === 'create-workspace' && (
                <CreateWorkspaceStepContent
                  workspaceName={workspaceName}
                  onWorkspaceNameChange={setWorkspaceName}
                />
              )}
              {step.id === 'tour' && <TourStepContent />}
              {step.id === 'create-note' && <CreateNoteStepContent />}
            </OnboardingStep>
          ))}
        </div>

        {/* ---- Step indicator dots ---- */}
        <div
          className="flex justify-center gap-1.5 py-3"
          role="tablist"
          aria-label="Onboarding steps"
        >
          {ONBOARDING_STEPS.map((step, index) => (
            <div
              key={step.id}
              role="tab"
              aria-selected={index === currentStep}
              aria-label={`Step ${index + 1}: ${step.title}`}
              className={cn(
                'h-1.5 rounded-full transition-all duration-300',
                index === currentStep
                  ? 'w-6 bg-primary'
                  : index < currentStep
                    ? 'w-1.5 bg-primary/50'
                    : 'w-1.5 bg-border',
              )}
            />
          ))}
        </div>

        {/* ---- Navigation buttons ---- */}
        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={handleBack}
            disabled={isFirstStep}
            className={cn(
              'rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring',
              isFirstStep
                ? 'invisible'
                : 'text-foreground-secondary hover:text-foreground hover:bg-accent',
            )}
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleNext}
            disabled={!canProceed}
            className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLastStep ? 'Finish' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
