import { IsString, Matches, MaxLength } from 'class-validator';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

/**
 * Payload for POST /workspaces/:id/domain
 * Sets (or replaces) the custom domain for a workspace's public vault.
 */
export class SetDomainDto {
  /**
   * Fully-qualified hostname without protocol or path.
   * Examples: "docs.mycompany.com", "notes.acme.io"
   */
  @IsString()
  @MaxLength(253, { message: 'domain must not exceed 253 characters (RFC 1035)' })
  @Matches(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, {
    message: 'domain must be a valid hostname (e.g. docs.mycompany.com)',
  })
  domain!: string;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

export type DomainVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';

/**
 * Current domain configuration returned by GET /workspaces/:id/domain
 * and after mutating operations.
 */
export interface DomainStatusResponse {
  /**
   * The configured custom domain, or null when none is set.
   */
  domain: string | null;

  /**
   * Current verification status:
   *  - unverified: domain is set but verification has never been attempted
   *  - pending:    verification is in progress (DNS TTL still propagating)
   *  - verified:   DNS TXT record confirmed present and correct
   *  - failed:     last verification attempt could not find the TXT record
   */
  status: DomainVerificationStatus;

  /**
   * The TXT record value that must be added under _notesaner-verify.<domain>
   * to prove ownership. Null when no domain is configured.
   */
  verificationToken: string | null;

  /**
   * ISO-8601 timestamp of the last verification attempt.
   * Null when verification has never been attempted.
   */
  lastVerifiedAt: string | null;

  /**
   * Human-readable DNS instructions for the current domain.
   * Present only when a domain is set.
   */
  dnsInstructions: DnsInstructions | null;
}

export interface DnsInstructions {
  /**
   * TXT record host — typically "_notesaner-verify.<domain>"
   */
  txtRecordHost: string;

  /**
   * Expected TXT record value (the verificationToken).
   */
  txtRecordValue: string;

  /**
   * CNAME record host — the bare domain or "www" subdomain.
   */
  cnameHost: string;

  /**
   * CNAME target — the notesaner.app wildcard subdomain that maps to the origin.
   * e.g. "vault-slug.notesaner.app"
   */
  cnameTarget: string;
}
