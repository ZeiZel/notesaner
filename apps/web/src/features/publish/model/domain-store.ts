/**
 * domain-store.ts
 *
 * Zustand store managing the custom domain configuration and verification
 * state for a workspace's public vault.
 *
 * State:
 *   - domain             : current custom domain (null if none set)
 *   - status             : DNS verification status
 *   - verificationToken  : TXT record value to add for domain verification
 *   - lastVerifiedAt     : ISO timestamp of last verification attempt
 *   - dnsInstructions    : structured DNS setup instructions
 *   - isLoading          : true while fetching domain config from backend
 *   - isSaving           : true while a save/verify operation is in-flight
 *   - error              : last error message, or null
 *
 * The store is NOT persisted to localStorage — domain config is authoritative
 * on the server. Always call loadDomainConfig() on mount.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Types (mirroring backend DomainStatusResponse) ──────────────────────────

export type DomainVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';

export interface DnsInstructions {
  /** TXT record host — _notesaner-verify.<domain> */
  txtRecordHost: string;
  /** Expected TXT record value (the verificationToken) */
  txtRecordValue: string;
  /** CNAME record host — the bare domain */
  cnameHost: string;
  /** CNAME target — vault-slug.notesaner.app */
  cnameTarget: string;
}

export interface DomainStatusDto {
  domain: string | null;
  status: DomainVerificationStatus;
  verificationToken: string | null;
  lastVerifiedAt: string | null;
  dnsInstructions: DnsInstructions | null;
}

// ─── Store state interface ────────────────────────────────────────────────────

export interface DomainState {
  // ---- Remote state ----

  /** Current custom domain value, or null when none is configured. */
  domain: string | null;

  /** DNS verification status. */
  status: DomainVerificationStatus;

  /** The TXT record value to place under _notesaner-verify.<domain>. */
  verificationToken: string | null;

  /** ISO-8601 timestamp of the last DNS verification attempt. */
  lastVerifiedAt: string | null;

  /** Structured DNS setup instructions, or null when no domain is set. */
  dnsInstructions: DnsInstructions | null;

  // ---- UI state ----

  /** True while loading the domain config from the backend. */
  isLoading: boolean;

  /** True while a save, verify, or delete operation is in-flight. */
  isSaving: boolean;

  /** Last error message, or null when there is no active error. */
  error: string | null;

  // ---- Actions ----

  /**
   * Hydrate the store with data returned from the backend.
   * Typically called after GET /workspaces/:id/domain resolves.
   */
  setDomainConfig: (config: DomainStatusDto) => void;

  /** Mark loading as started (clears any previous error). */
  setLoading: (loading: boolean) => void;

  /** Mark saving as started/stopped. */
  setSaving: (saving: boolean) => void;

  /** Set an error message (also stops saving). */
  setError: (error: string | null) => void;

  /** Clear all error state. */
  clearError: () => void;

  /** Reset the store to its initial state (called on workspace change). */
  reset: () => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_STATE = {
  domain: null,
  status: 'unverified' as DomainVerificationStatus,
  verificationToken: null,
  lastVerifiedAt: null,
  dnsInstructions: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

// ─── Store definition ─────────────────────────────────────────────────────────

export const useDomainStore = create<DomainState>()(
  devtools(
    (set) => ({
      ...INITIAL_STATE,

      setDomainConfig: (config) =>
        set(
          {
            domain: config.domain,
            status: config.status,
            verificationToken: config.verificationToken,
            lastVerifiedAt: config.lastVerifiedAt,
            dnsInstructions: config.dnsInstructions,
            isLoading: false,
            error: null,
          },
          false,
          'domain/setDomainConfig',
        ),

      setLoading: (loading) =>
        set({ isLoading: loading, error: loading ? null : undefined }, false, 'domain/setLoading'),

      setSaving: (saving) => set({ isSaving: saving }, false, 'domain/setSaving'),

      setError: (error) =>
        set({ error, isSaving: false, isLoading: false }, false, 'domain/setError'),

      clearError: () => set({ error: null }, false, 'domain/clearError'),

      reset: () => set({ ...INITIAL_STATE }, false, 'domain/reset'),
    }),
    { name: 'DomainStore' },
  ),
);
