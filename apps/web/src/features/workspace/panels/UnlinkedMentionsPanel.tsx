'use client';

/**
 * UnlinkedMentionsPanel
 *
 * Displays notes that mention the current note's title in plain text but do
 * not have a formal [[wiki link]] pointing to it. Provides a one-click "Link"
 * button that inserts a [[wiki-link]] in the source note at the exact position
 * of the first unlinked mention.
 *
 * Intended to be rendered below or alongside the BacklinksPanel in the right
 * sidebar. The panel is self-contained and fetches its own data.
 *
 * Wiring:
 *   Import from '@/features/workspace/panels' (add to panels/index.ts barrel)
 *   and place inside the right sidebar layout component.
 */

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/stores/auth-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UnlinkedMentionDto {
  sourceNoteId: string;
  sourceNoteTitle: string;
  sourceNotePath: string;
  context: string;
  position: number;
}

interface CreateLinkResult {
  success: boolean;
  message: string;
}

interface UnlinkedMentionsPanelProps {
  noteId: string;
  workspaceId: string;
  /** When true the panel renders in a read-only mode (no "Link" buttons). */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchUnlinkedMentions(
  token: string,
  workspaceId: string,
  noteId: string,
): Promise<UnlinkedMentionDto[]> {
  return apiClient.get<UnlinkedMentionDto[]>(
    `/api/workspaces/${workspaceId}/notes/${noteId}/unlinked-mentions`,
    { token },
  );
}

async function createLinkFromMention(
  token: string,
  workspaceId: string,
  noteId: string,
  sourceNoteId: string,
): Promise<CreateLinkResult> {
  return apiClient.post<CreateLinkResult>(
    `/api/workspaces/${workspaceId}/notes/${noteId}/unlinked-mentions/${sourceNoteId}/link`,
    {},
    { token },
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelSkeleton() {
  return (
    <div className="space-y-2 animate-pulse px-1">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-sm bg-sidebar-accent/50 px-2 py-3">
          <div className="mb-1.5 h-3 w-3/4 rounded bg-sidebar-muted/30" />
          <div className="h-2 w-full rounded bg-sidebar-muted/20" />
          <div className="mt-1 h-2 w-2/3 rounded bg-sidebar-muted/20" />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-2 py-6 px-3">
      <svg
        viewBox="0 0 16 16"
        className="h-5 w-5 text-sidebar-muted"
        fill="currentColor"
        aria-hidden="true"
      >
        {/* search / magnifying glass icon */}
        <path
          fillRule="evenodd"
          d="M9.965 11.026a5 5 0 1 1 1.06-1.06l2.755 2.754a.75.75 0 1 1-1.06 1.06l-2.755-2.754ZM10.5 7a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Z"
          clipRule="evenodd"
        />
      </svg>
      <p className="text-center text-xs text-sidebar-muted">No unlinked mentions found</p>
      <p className="px-2 text-center text-2xs text-sidebar-muted leading-relaxed">
        Other notes that mention this note by name but don&apos;t link to it will appear here.
      </p>
    </div>
  );
}

interface MentionRowProps {
  mention: UnlinkedMentionDto;
  workspaceId: string;
  targetNoteId: string;
  readOnly: boolean;
  isLinking: boolean;
  onNavigate: (noteId: string) => void;
  onLink: (sourceNoteId: string) => void;
}

function MentionRow({
  mention,
  workspaceId: _workspaceId,
  targetNoteId: _targetNoteId,
  readOnly,
  isLinking,
  onNavigate,
  onLink,
}: MentionRowProps) {
  return (
    <div className="group flex w-full flex-col gap-0.5 rounded-sm px-2 py-1.5 transition-colors duration-fast hover:bg-sidebar-accent">
      {/* Title row with navigation + optional link button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => onNavigate(mention.sourceNoteId)}
          className="flex-1 truncate text-left text-xs font-medium text-sidebar-foreground hover:text-foreground transition-colors"
          title={`Open ${mention.sourceNoteTitle}`}
        >
          {mention.sourceNoteTitle}
        </button>

        {!readOnly && (
          <button
            type="button"
            disabled={isLinking}
            onClick={() => onLink(mention.sourceNoteId)}
            className={[
              'shrink-0 rounded px-1.5 py-0.5 text-2xs font-medium transition-colors duration-fast',
              isLinking
                ? 'cursor-wait bg-sidebar-accent text-sidebar-muted'
                : 'bg-primary/10 text-primary hover:bg-primary/20 active:scale-95',
            ].join(' ')}
            title={`Insert [[${mention.sourceNoteTitle}]] wiki-link in this note`}
            aria-label={`Link "${mention.sourceNoteTitle}" to this note`}
          >
            {isLinking ? 'Linking\u2026' : 'Link'}
          </button>
        )}
      </div>

      {/* Context snippet */}
      {mention.context && (
        <p className="line-clamp-2 text-2xs text-sidebar-muted leading-snug">{mention.context}</p>
      )}

      {/* Source path */}
      <p className="text-2xs text-sidebar-muted truncate">{mention.sourceNotePath}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UnlinkedMentionsPanel({
  noteId,
  workspaceId,
  readOnly = false,
}: UnlinkedMentionsPanelProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();
  const queryClient = useQueryClient();

  // Track which source notes are currently being linked to prevent double-clicks.
  const [linkingIds, setLinkingIds] = useState<Set<string>>(new Set());

  // Track toast-style inline feedback messages keyed by sourceNoteId.
  const [feedbackMessages, setFeedbackMessages] = useState<
    Map<string, { ok: boolean; text: string }>
  >(new Map());

  const enabled = !!accessToken && !!noteId && !!workspaceId;

  const {
    data: mentions,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['unlinked-mentions', workspaceId, noteId],
    queryFn: () => fetchUnlinkedMentions(accessToken ?? '', workspaceId, noteId),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
    refetchIntervalInBackground: false,
  });

  const linkMutation = useMutation({
    mutationFn: ({ sourceNoteId }: { sourceNoteId: string }) =>
      createLinkFromMention(accessToken ?? '', workspaceId, noteId, sourceNoteId),
    onMutate: ({ sourceNoteId }) => {
      setLinkingIds((prev) => new Set(prev).add(sourceNoteId));
    },
    onSettled: (data, _error, { sourceNoteId }) => {
      setLinkingIds((prev) => {
        const next = new Set(prev);
        next.delete(sourceNoteId);
        return next;
      });
    },
    onSuccess: (result, { sourceNoteId }) => {
      setFeedbackMessages((prev) => {
        const next = new Map(prev);
        next.set(sourceNoteId, {
          ok: result.success,
          text: result.success ? 'Link created' : result.message,
        });
        return next;
      });

      if (result.success) {
        // Invalidate both backlinks and unlinked-mentions so the UI reflects
        // that the mention is now a formal link.
        void queryClient.invalidateQueries({
          queryKey: ['unlinked-mentions', workspaceId, noteId],
        });
        void queryClient.invalidateQueries({
          queryKey: ['backlinks', workspaceId, noteId],
        });
      }

      // Auto-clear feedback after 3 seconds.
      setTimeout(() => {
        setFeedbackMessages((prev) => {
          const next = new Map(prev);
          next.delete(sourceNoteId);
          return next;
        });
      }, 3_000);
    },
    onError: (_error, { sourceNoteId }) => {
      setFeedbackMessages((prev) => {
        const next = new Map(prev);
        next.set(sourceNoteId, { ok: false, text: 'Request failed' });
        return next;
      });

      setTimeout(() => {
        setFeedbackMessages((prev) => {
          const next = new Map(prev);
          next.delete(sourceNoteId);
          return next;
        });
      }, 3_000);
    },
  });

  const handleNavigate = useCallback(
    (sourceNoteId: string) => {
      router.push(`/workspaces/${workspaceId}/notes/${sourceNoteId}`);
    },
    [router, workspaceId],
  );

  const handleLink = useCallback(
    (sourceNoteId: string) => {
      if (linkingIds.has(sourceNoteId)) return;
      linkMutation.mutate({ sourceNoteId });
    },
    [linkMutation, linkingIds],
  );

  // ─── Render ───────────────────────────────────────────────────────────────

  const count = mentions?.length;

  return (
    <section aria-label="Unlinked mentions" className="space-y-2">
      {/* Section header */}
      <div className="flex items-center justify-between px-1">
        <h3 className="text-2xs font-semibold uppercase tracking-wider text-sidebar-muted">
          Unlinked Mentions
        </h3>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-2xs font-medium text-amber-600 dark:text-amber-400">
            {count}
          </span>
        )}
      </div>

      {/* Body */}
      {isLoading && !mentions ? (
        <PanelSkeleton />
      ) : isError ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-destructive">Failed to load unlinked mentions</p>
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded bg-sidebar-accent px-2 py-1 text-2xs font-medium text-sidebar-foreground hover:bg-sidebar-border transition-colors duration-fast"
          >
            Retry
          </button>
        </div>
      ) : !mentions || mentions.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="space-y-0.5" role="list">
          {mentions.map((mention) => {
            const feedback = feedbackMessages.get(mention.sourceNoteId);

            return (
              <li key={mention.sourceNoteId}>
                <MentionRow
                  mention={mention}
                  workspaceId={workspaceId}
                  targetNoteId={noteId}
                  readOnly={readOnly}
                  isLinking={linkingIds.has(mention.sourceNoteId)}
                  onNavigate={handleNavigate}
                  onLink={handleLink}
                />
                {/* Inline feedback message (success / error) */}
                {feedback && (
                  <p
                    className={[
                      'px-2 pb-1 text-2xs',
                      feedback.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive',
                    ].join(' ')}
                    role="status"
                    aria-live="polite"
                  >
                    {feedback.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
