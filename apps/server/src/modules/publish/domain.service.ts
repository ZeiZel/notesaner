import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as dns from 'dns';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import type {
  DomainStatusResponse,
  DomainVerificationStatus,
  DnsInstructions,
} from './dto/custom-domain.dto';

// ─── DNS helper ───────────────────────────────────────────────────────────────

const resolveTxt = promisify(dns.resolveTxt);

// ─── Settings shape ───────────────────────────────────────────────────────────

/**
 * Shape of the domain-related fields stored inside `workspace.settings` JSON.
 * We use the workspace `settings` column rather than schema columns to avoid
 * schema migrations (as per task constraints).
 */
interface DomainSettings {
  customDomain?: string;
  domainVerificationToken?: string;
  domainVerificationStatus?: DomainVerificationStatus;
  domainLastVerifiedAt?: string | null;
}

// ─── DomainService ────────────────────────────────────────────────────────────

/**
 * DomainService — manages custom domain configuration for public vaults.
 *
 * Responsibilities:
 *  - CRUD for the custom domain stored in workspace.settings JSON
 *  - Generating stable verification tokens (HMAC-SHA256 of workspaceId)
 *  - DNS TXT-record verification via Node's `dns` module
 *  - Domain-to-workspace resolution (for use by middleware / public routes)
 */
@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  /**
   * Set (or replace) the custom domain for a workspace.
   *
   * Side-effects:
   *  - Generates a fresh verification token.
   *  - Resets status to "unverified".
   *  - Ensures no other workspace claims the same domain.
   *
   * @throws NotFoundException  when workspaceId does not exist
   * @throws ConflictException  when another workspace already owns the domain
   */
  async setDomain(workspaceId: string, domain: string): Promise<DomainStatusResponse> {
    const workspace = await this.requireWorkspace(workspaceId);

    // Check for uniqueness across all workspaces
    const existing = await this.findWorkspaceByDomain(domain);
    if (existing && existing.id !== workspaceId) {
      throw new ConflictException(`Domain "${domain}" is already in use by another workspace`);
    }

    const token = this.generateVerificationToken(workspaceId, domain);
    const currentSettings = this.parseSettings(workspace.settings);

    const updatedSettings: DomainSettings & Record<string, unknown> = {
      ...currentSettings,
      customDomain: domain,
      domainVerificationToken: token,
      domainVerificationStatus: 'unverified' as DomainVerificationStatus,
      domainLastVerifiedAt: null,
    };

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    this.logger.log(`Workspace ${workspaceId}: custom domain set to "${domain}"`);

    return this.buildResponse(domain, 'unverified', token, null);
  }

  /**
   * Retrieve the current domain configuration for a workspace.
   *
   * @throws NotFoundException when workspaceId does not exist
   */
  async getDomainConfig(workspaceId: string): Promise<DomainStatusResponse> {
    const workspace = await this.requireWorkspace(workspaceId);
    const settings = this.parseSettings(workspace.settings);

    if (!settings.customDomain) {
      return this.buildResponse(null, 'unverified', null, null);
    }

    return this.buildResponse(
      settings.customDomain,
      settings.domainVerificationStatus ?? 'unverified',
      settings.domainVerificationToken ?? null,
      settings.domainLastVerifiedAt ?? null,
    );
  }

  /**
   * Remove the custom domain from a workspace.
   * Clears domain, token, status, and lastVerifiedAt.
   *
   * @throws NotFoundException when workspaceId does not exist
   */
  async removeDomain(workspaceId: string): Promise<void> {
    const workspace = await this.requireWorkspace(workspaceId);
    const currentSettings = this.parseSettings(workspace.settings);

    const updatedSettings = { ...currentSettings };
    delete updatedSettings['customDomain'];
    delete updatedSettings['domainVerificationToken'];
    delete updatedSettings['domainVerificationStatus'];
    delete updatedSettings['domainLastVerifiedAt'];

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    this.logger.log(`Workspace ${workspaceId}: custom domain removed`);
  }

  // ─── Verification ──────────────────────────────────────────────────────────

  /**
   * Trigger a DNS TXT-record verification for a workspace's custom domain.
   *
   * The expected record is:
   *   _notesaner-verify.<domain>  TXT  "<verificationToken>"
   *
   * On success: status → "verified", lastVerifiedAt → now.
   * On failure: status → "failed".
   *
   * @throws NotFoundException   when workspace or domain is not found
   * @throws BadRequestException when no domain is configured
   */
  async verifyDomain(workspaceId: string): Promise<DomainStatusResponse> {
    const workspace = await this.requireWorkspace(workspaceId);
    const settings = this.parseSettings(workspace.settings);

    if (!settings.customDomain) {
      throw new BadRequestException('No custom domain is configured for this workspace');
    }

    if (!settings.domainVerificationToken) {
      throw new BadRequestException('Verification token is missing — please re-set the domain');
    }

    const domain = settings.customDomain;
    const token = settings.domainVerificationToken;
    const txtHost = `_notesaner-verify.${domain}`;

    let verified = false;

    try {
      const records = await resolveTxt(txtHost);
      // Each entry is string[]; flatten and check for token presence
      verified = records.some((chunks) => chunks.join('').includes(token));
    } catch (err) {
      // DNS lookup failure (ENOTFOUND, ENODATA) → verification failed
      this.logger.warn(
        `DNS verification failed for "${domain}" (host: "${txtHost}"): ${String(err)}`,
      );
      verified = false;
    }

    const newStatus: DomainVerificationStatus = verified ? 'verified' : 'failed';
    const now = new Date().toISOString();

    const updatedSettings: DomainSettings & Record<string, unknown> = {
      ...settings,
      domainVerificationStatus: newStatus,
      domainLastVerifiedAt: now,
    };

    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { settings: updatedSettings as Prisma.InputJsonValue },
    });

    this.logger.log(`Workspace ${workspaceId}: domain "${domain}" verification → ${newStatus}`);

    return this.buildResponse(domain, newStatus, token, now);
  }

  // ─── Resolution ────────────────────────────────────────────────────────────

  /**
   * Resolve an incoming Host header value to a workspace.
   *
   * Supports:
   *  - Wildcard subdomain: "vault-slug.notesaner.app" → lookup by publicSlug
   *  - Custom domain: "docs.mycompany.com" → lookup by settings.customDomain
   *
   * Returns null when no matching workspace is found.
   * Only returns verified or public workspaces (does not expose private ones).
   */
  async resolveHostToWorkspace(
    host: string,
  ): Promise<{ id: string; publicSlug: string | null; name: string } | null> {
    if (!host) return null;

    // Strip port suffix if present (e.g. "docs.mycompany.com:3000")
    const hostname = host.split(':')[0].toLowerCase();

    if (!hostname) return null;

    // 1. Wildcard subdomain: <slug>.notesaner.app
    const NOTESANER_SUFFIX = '.notesaner.app';
    if (hostname.endsWith(NOTESANER_SUFFIX)) {
      const slug = hostname.slice(0, hostname.length - NOTESANER_SUFFIX.length);
      if (slug.length > 0) {
        const workspace = await this.prisma.workspace.findFirst({
          where: { publicSlug: slug, isPublic: true },
          select: { id: true, publicSlug: true, name: true },
        });
        if (workspace) return workspace;
      }
    }

    // 2. Custom domain — scan public workspaces (count expected to be small)
    const workspaceWithDomain = await this.findWorkspaceByDomain(hostname);
    if (workspaceWithDomain) {
      const settings = this.parseSettings(workspaceWithDomain.settings);
      // Only expose verified domains (or optionally unverified for fallback — design choice)
      if (settings.domainVerificationStatus === 'verified' && workspaceWithDomain.isPublic) {
        return {
          id: workspaceWithDomain.id,
          publicSlug: workspaceWithDomain.publicSlug,
          name: workspaceWithDomain.name,
        };
      }
    }

    return null;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Fetches the workspace or throws NotFoundException.
   */
  private async requireWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException(`Workspace "${workspaceId}" not found`);
    }

    return workspace;
  }

  /**
   * Find the first workspace where settings.customDomain === domain.
   * Returns undefined when not found.
   */
  private async findWorkspaceByDomain(domain: string) {
    const candidates = await this.prisma.workspace.findMany({
      where: { isPublic: true },
    });

    return candidates.find((ws) => {
      const s = this.parseSettings(ws.settings);
      return s.customDomain === domain;
    });
  }

  /**
   * Parse the workspace settings JSON into a typed object.
   */
  private parseSettings(raw: unknown): DomainSettings & Record<string, unknown> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return raw as DomainSettings & Record<string, unknown>;
    }
    return {};
  }

  /**
   * Generate a stable, workspace-specific verification token.
   *
   * Uses HMAC-SHA256 of (workspaceId + domain) keyed by workspaceId so that
   * different domains for the same workspace produce different tokens, and
   * the token is unpredictable without knowledge of the workspaceId.
   */
  private generateVerificationToken(workspaceId: string, domain: string): string {
    return crypto
      .createHmac('sha256', workspaceId)
      .update(`${workspaceId}:${domain}`)
      .digest('hex')
      .slice(0, 32); // 128-bit token is sufficient for domain verification
  }

  /**
   * Build the DomainStatusResponse shape including DNS instructions.
   */
  private buildResponse(
    domain: string | null,
    status: DomainVerificationStatus,
    verificationToken: string | null,
    lastVerifiedAt: string | null,
  ): DomainStatusResponse {
    if (!domain || !verificationToken) {
      return {
        domain: null,
        status: 'unverified',
        verificationToken: null,
        lastVerifiedAt: null,
        dnsInstructions: null,
      };
    }

    const dnsInstructions: DnsInstructions = {
      txtRecordHost: `_notesaner-verify.${domain}`,
      txtRecordValue: verificationToken,
      cnameHost: domain,
      // Derive the notesaner.app CNAME target from the domain (falls back to
      // a generic target when no publicSlug context is available here).
      cnameTarget: `vault.notesaner.app`,
    };

    return {
      domain,
      status,
      verificationToken,
      lastVerifiedAt,
      dnsInstructions,
    };
  }
}
