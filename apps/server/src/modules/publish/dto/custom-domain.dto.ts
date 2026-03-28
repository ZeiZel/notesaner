import { IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

// ---- Request DTOs ----

/**
 * Payload for POST /workspaces/:id/domain
 * Sets (or replaces) the custom domain for a workspace's public vault.
 */
export class SetDomainDto {
  @ApiProperty({
    description: 'Fully-qualified hostname without protocol or path',
    example: 'docs.mycompany.com',
    maxLength: 253,
  })
  @IsString()
  @MaxLength(253, { message: 'domain must not exceed 253 characters (RFC 1035)' })
  @Matches(/^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/, {
    message: 'domain must be a valid hostname (e.g. docs.mycompany.com)',
  })
  domain!: string;
}

// ---- Response shapes ----

export type DomainVerificationStatus = 'unverified' | 'pending' | 'verified' | 'failed';

/**
 * Current domain configuration returned by GET /workspaces/:id/domain
 * and after mutating operations.
 */
export interface DomainStatusResponse {
  domain: string | null;
  status: DomainVerificationStatus;
  verificationToken: string | null;
  lastVerifiedAt: string | null;
  dnsInstructions: DnsInstructions | null;
}

export interface DnsInstructions {
  txtRecordHost: string;
  txtRecordValue: string;
  cnameHost: string;
  cnameTarget: string;
}
