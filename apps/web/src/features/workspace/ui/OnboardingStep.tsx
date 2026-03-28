'use client';

/**
 * OnboardingStep — renders the content for a single onboarding wizard step.
 *
 * Each step receives its configuration (title, description) and renders
 * step-specific interactive content via a render-prop pattern.
 *
 * Features:
 *   - Animated entrance/exit transitions (CSS-based)
 *   - Consistent layout across all steps
 *   - Accessible heading structure
 *   - Step-specific content slot via children
 */

import { type ReactNode, useId } from 'react';
import { cn } from '@/shared/lib/utils';

// ---- Types ----------------------------------------------------------------

export type TransitionDirection = 'forward' | 'backward' | 'none';

interface OnboardingStepProps {
  /** Step title. */
  title: string;
  /** Step description. */
  description: string;
  /** Whether this step is the currently active one (controls visibility). */
  isActive: boolean;
  /** Step index (0-based) — used for key-framing and ARIA. */
  stepIndex: number;
  /** Total number of steps — for ARIA labelling. */
  totalSteps: number;
  /** Direction of transition for entrance animation. */
  direction: TransitionDirection;
  /** Step-specific interactive content. */
  children: ReactNode;
}

// ---- Component ------------------------------------------------------------

export function OnboardingStep({
  title,
  description,
  isActive,
  stepIndex,
  totalSteps,
  direction,
  children,
}: OnboardingStepProps) {
  const headingId = useId();

  if (!isActive) return null;

  return (
    <section
      role="tabpanel"
      aria-labelledby={headingId}
      aria-label={`Step ${stepIndex + 1} of ${totalSteps}: ${title}`}
      className={cn(
        'flex flex-col gap-6',
        'animate-in fade-in duration-300',
        direction === 'forward' && 'slide-in-from-right-4',
        direction === 'backward' && 'slide-in-from-left-4',
        direction === 'none' && 'slide-in-from-bottom-2',
      )}
    >
      {/* Step header */}
      <div className="space-y-2 text-center">
        <h2 id={headingId} className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          {title}
        </h2>
        <p className="text-sm text-foreground-secondary">{description}</p>
      </div>

      {/* Step content */}
      <div className="flex-1">{children}</div>
    </section>
  );
}

// ---- Step Content Presets -------------------------------------------------

/**
 * WelcomeStepContent — name input for the welcome step.
 */
interface WelcomeStepContentProps {
  displayName: string;
  onDisplayNameChange: (name: string) => void;
}

export function WelcomeStepContent({ displayName, onDisplayNameChange }: WelcomeStepContentProps) {
  const inputId = useId();

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {/* Decorative illustration */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-primary"
            aria-hidden="true"
          >
            <path d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            <path d="M4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
          </svg>
        </div>
      </div>

      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
          What should we call you?
        </label>
        <input
          id={inputId}
          type="text"
          value={displayName}
          onChange={(e) => onDisplayNameChange(e.target.value)}
          placeholder="Your name"
          autoFocus
          autoComplete="name"
          maxLength={100}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
      </div>
    </div>
  );
}

/**
 * CreateWorkspaceStepContent — workspace name input.
 */
interface CreateWorkspaceStepContentProps {
  workspaceName: string;
  onWorkspaceNameChange: (name: string) => void;
}

export function CreateWorkspaceStepContent({
  workspaceName,
  onWorkspaceNameChange,
}: CreateWorkspaceStepContentProps) {
  const inputId = useId();

  return (
    <div className="mx-auto max-w-sm space-y-4">
      {/* Decorative illustration */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-primary"
            aria-hidden="true"
          >
            <path d="M2.25 12.75V12A2.25 2.25 0 0 1 4.5 9.75h15A2.25 2.25 0 0 1 21.75 12v.75m-8.69-6.44-2.12-2.12a1.5 1.5 0 0 0-1.061-.44H4.5A2.25 2.25 0 0 0 2.25 6v12a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9a2.25 2.25 0 0 0-2.25-2.25h-5.379a1.5 1.5 0 0 1-1.06-.44Z" />
          </svg>
        </div>
      </div>

      <div>
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-foreground">
          Name your workspace
        </label>
        <input
          id={inputId}
          type="text"
          value={workspaceName}
          onChange={(e) => onWorkspaceNameChange(e.target.value)}
          placeholder="e.g. Personal Notes, Work, Research"
          autoFocus
          maxLength={100}
          className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
        />
        <p className="mt-1.5 text-xs text-foreground-muted">
          You can rename it or create more workspaces later.
        </p>
      </div>
    </div>
  );
}

/**
 * TourStepContent — highlights key UI areas with visual annotations.
 */
export function TourStepContent() {
  const areas = [
    {
      label: 'File Explorer',
      description: 'Browse and organize your notes in folders.',
      iconPath:
        'M2 3.5A1.5 1.5 0 0 1 3.5 2h2.879a1.5 1.5 0 0 1 1.06.44l1.122 1.12A1.5 1.5 0 0 0 9.62 4H12.5A1.5 1.5 0 0 1 14 5.5v7A1.5 1.5 0 0 1 12.5 14h-9A1.5 1.5 0 0 1 2 12.5v-9z',
    },
    {
      label: 'Editor',
      description: 'Write in rich Markdown with real-time collaboration.',
      iconPath:
        'M13.5 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7.5L13.5 3ZM5 2a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7.086a1 1 0 0 0-.293-.707l-4.086-4.086A1 1 0 0 0 12.914 2H5Z',
    },
    {
      label: 'Graph View',
      description: 'Visualize connections between your notes.',
      iconPath:
        'M12 2a3 3 0 0 0-2.1 5.133A5.006 5.006 0 0 0 7 11.5a.5.5 0 0 0 1 0 4 4 0 0 1 8 0 .5.5 0 0 0 1 0 5.006 5.006 0 0 0-2.9-4.367A3 3 0 0 0 12 2Z',
    },
    {
      label: 'Search',
      description: 'Find anything instantly across all your notes.',
      iconPath:
        'M10 2a8 8 0 1 0 4.906 14.32l3.387 3.387a1 1 0 0 0 1.414-1.414l-3.387-3.387A8 8 0 0 0 10 2Zm-6 8a6 6 0 1 1 12 0 6 6 0 0 1-12 0Z',
    },
  ];

  return (
    <div className="mx-auto max-w-md">
      <div className="grid grid-cols-2 gap-3">
        {areas.map((area) => (
          <div
            key={area.label}
            className="rounded-lg border border-border bg-background-surface p-3 transition-colors hover:border-primary/40"
          >
            <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4 text-primary"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d={area.iconPath} />
              </svg>
            </div>
            <p className="text-sm font-medium text-foreground">{area.label}</p>
            <p className="mt-0.5 text-xs text-foreground-muted">{area.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * CreateNoteStepContent — prompt to create the first note.
 */
export function CreateNoteStepContent() {
  return (
    <div className="mx-auto max-w-sm space-y-4 text-center">
      {/* Decorative illustration */}
      <div className="flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary/10">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-10 w-10 text-primary"
            aria-hidden="true"
          >
            <path d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
          </svg>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-foreground-secondary">
          You are all set! Click <strong>Finish</strong> to create a blank note and start writing.
        </p>
        <p className="text-xs text-foreground-muted">
          Tip: Use{' '}
          <kbd className="rounded border border-border px-1 py-0.5 text-[10px] font-mono">
            Ctrl+N
          </kbd>{' '}
          to create new notes anytime.
        </p>
      </div>
    </div>
  );
}
