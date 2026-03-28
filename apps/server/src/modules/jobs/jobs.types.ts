// ─── Webhook delivery ──────────────────────────────────────────────────────

/** Payload for the DELIVER_WEBHOOK_JOB BullMQ job. */
export interface DeliverWebhookJobData {
  webhookId: string;
  deliveryId: string;
  url: string;
  event: string;
  /** Pre-serialized JSON body to POST. */
  body: string;
  /** HMAC-SHA256 signature header value: `sha256=<hex>`. */
  signature: string;
}

/** Structured result returned by the webhook delivery processor. */
export interface DeliverWebhookJobResult {
  deliveryId: string;
  statusCode: number | null;
  success: boolean;
  responseTimeMs: number;
}

// ─── Note indexing ──────────────────────────────────────────────────────────

/** Payload for the INDEX_NOTE_JOB BullMQ job. */
export interface IndexNoteJobData {
  noteId: string;
  workspaceId: string;
  /** Absolute filesystem path to the note's .md file. */
  filePath: string;
}

/** Payload for the REINDEX_WORKSPACE_JOB BullMQ job. */
export interface ReindexWorkspaceJobData {
  workspaceId: string;
}

/** Structured result returned by the note-indexing processor. */
export interface IndexNoteJobResult {
  noteId: string;
  indexed: boolean;
  durationMs: number;
}

/** Structured result returned by the workspace reindex processor. */
export interface ReindexWorkspaceJobResult {
  workspaceId: string;
  total: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

// ─── Freshness check ────────────────────────────────────────────────────────

/** Payload for the FRESHNESS_CHECK_JOB BullMQ job. */
export interface FreshnessCheckJobData {
  /** Optional: only check a specific workspace. When omitted, checks all workspaces. */
  workspaceId?: string;
}

/** Structured result returned by the freshness check processor. */
export interface FreshnessCheckJobResult {
  workspacesChecked: number;
  staleNotesFound: number;
  emailsQueued: number;
  durationMs: number;
}

// ─── Storage recalculation ──────────────────────────────────────────────────

/** Payload for the STORAGE_RECALCULATION_JOB BullMQ job. */
export interface StorageRecalculationJobData {
  /** Optional: only recalculate a specific workspace. When omitted, recalculates all workspaces. */
  workspaceId?: string;
}

/** Structured result returned by the storage recalculation processor. */
export interface StorageRecalculationJobResult {
  workspacesProcessed: number;
  errors: number;
  durationMs: number;
}

/** Stale note summary grouped by owner, used internally by the freshness processor. */
export interface OwnerStaleNoteSummary {
  ownerId: string;
  ownerEmail: string;
  ownerDisplayName: string;
  workspaceName: string;
  workspaceId: string;
  notes: Array<{
    noteId: string;
    title: string;
    path: string;
    ageInDays: number;
  }>;
}
