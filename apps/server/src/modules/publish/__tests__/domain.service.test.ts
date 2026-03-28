/**
 * Unit tests for DomainService
 *
 * All external dependencies (PrismaService) are mocked so no real database
 * access occurs. The `dns` module is mocked to control resolution outcomes.
 *
 * Coverage targets:
 *  - setDomain: happy path, conflict, not found, token generation
 *  - getDomainConfig: all status variants, no domain set
 *  - removeDomain: clears settings fields, not found
 *  - verifyDomain: verified, failed (DNS error), failed (record absent),
 *                  no domain configured, missing token
 *  - resolveHostToWorkspace: wildcard subdomain, verified custom domain,
 *                             unverified domain not exposed, unknown host
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DomainService } from '../domain.service';
import { PrismaService } from '../../../prisma/prisma.service';

// ---------------------------------------------------------------------------
// Mock the `dns` module
// ---------------------------------------------------------------------------

vi.mock('dns', async (importOriginal) => {
  const actual = await importOriginal<typeof import('dns')>();
  return {
    ...actual,
    resolveTxt: vi.fn(),
  };
});

// We need to access the mocked resolveTxt after the mock is registered.
// Import after vi.mock so the mock is in place.
import * as dns from 'dns';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeWorkspace(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'ws-1',
    name: 'My Vault',
    slug: 'my-vault',
    description: 'Test vault',
    storagePath: '/tmp/ws-1',
    isPublic: true,
    publicSlug: 'my-vault',
    settings: {},
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Service factory
// ---------------------------------------------------------------------------

function makeService(prismaOverrides: Record<string, unknown> = {}) {
  const prisma = {
    workspace: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    ...prismaOverrides,
  } as unknown as PrismaService;

  const service = new DomainService(prisma);
  return { service, prisma };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DomainService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── setDomain ────────────────────────────────────────────────────────────

  describe('setDomain', () => {
    it('should set a new custom domain and return unverified status', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]); // no conflict
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const result = await service.setDomain('ws-1', 'docs.example.com');

      expect(result.domain).toBe('docs.example.com');
      expect(result.status).toBe('unverified');
      expect(result.verificationToken).toBeTruthy();
      expect(result.lastVerifiedAt).toBeNull();
    });

    it('should generate a non-empty verification token', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const result = await service.setDomain('ws-1', 'docs.example.com');

      expect(result.verificationToken).toHaveLength(32);
    });

    it('should include DNS instructions in the response', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const result = await service.setDomain('ws-1', 'docs.example.com');

      expect(result.dnsInstructions).not.toBeNull();
      expect(result.dnsInstructions!.txtRecordHost).toBe('_notesaner-verify.docs.example.com');
      expect(result.dnsInstructions!.txtRecordValue).toBe(result.verificationToken);
      expect(result.dnsInstructions!.cnameHost).toBe('docs.example.com');
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.setDomain('ghost', 'docs.example.com')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException when domain is already used by another workspace', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ id: 'ws-1' }) as never,
      );
      // Another workspace already has this domain
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        makeWorkspace({
          id: 'ws-2',
          isPublic: true,
          settings: { customDomain: 'docs.example.com' },
        }),
      ] as never[]);

      await expect(service.setDomain('ws-1', 'docs.example.com')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should allow setting a domain that the same workspace already owns', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({ settings: { customDomain: 'docs.example.com' } }) as never,
      );
      // Same workspace returned — not a conflict
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        makeWorkspace({ id: 'ws-1', settings: { customDomain: 'docs.example.com' } }),
      ] as never[]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      await expect(service.setDomain('ws-1', 'docs.example.com')).resolves.not.toThrow();
    });

    it('should persist the domain settings to the database', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      await service.setDomain('ws-1', 'docs.example.com');

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            settings: expect.objectContaining({
              customDomain: 'docs.example.com',
              domainVerificationStatus: 'unverified',
            }),
          }),
        }),
      );
    });

    it('should generate different tokens for different domains', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const result1 = await service.setDomain('ws-1', 'docs.example.com');
      const result2 = await service.setDomain('ws-1', 'notes.example.com');

      expect(result1.verificationToken).not.toBe(result2.verificationToken);
    });
  });

  // ─── getDomainConfig ──────────────────────────────────────────────────────

  describe('getDomainConfig', () => {
    it('should return null domain config when no domain is set', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      const result = await service.getDomainConfig('ws-1');

      expect(result.domain).toBeNull();
      expect(result.status).toBe('unverified');
      expect(result.verificationToken).toBeNull();
      expect(result.dnsInstructions).toBeNull();
    });

    it('should return domain config with verified status', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'abc123token',
            domainVerificationStatus: 'verified',
            domainLastVerifiedAt: '2024-01-15T10:00:00.000Z',
          },
        }) as never,
      );

      const result = await service.getDomainConfig('ws-1');

      expect(result.domain).toBe('docs.example.com');
      expect(result.status).toBe('verified');
      expect(result.verificationToken).toBe('abc123token');
      expect(result.lastVerifiedAt).toBe('2024-01-15T10:00:00.000Z');
    });

    it('should return domain config with failed status', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'tok',
            domainVerificationStatus: 'failed',
            domainLastVerifiedAt: '2024-01-14T08:00:00.000Z',
          },
        }) as never,
      );

      const result = await service.getDomainConfig('ws-1');

      expect(result.status).toBe('failed');
      expect(result.dnsInstructions).not.toBeNull();
    });

    it('should default status to unverified when settings missing the field', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'tok',
            // domainVerificationStatus intentionally absent
          },
        }) as never,
      );

      const result = await service.getDomainConfig('ws-1');

      expect(result.status).toBe('unverified');
    });

    it('should throw NotFoundException for unknown workspace', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.getDomainConfig('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── removeDomain ─────────────────────────────────────────────────────────

  describe('removeDomain', () => {
    it('should remove the custom domain and clear related settings', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'tok',
            domainVerificationStatus: 'verified',
            domainLastVerifiedAt: '2024-01-01T00:00:00.000Z',
            otherSetting: 'preserved',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      await service.removeDomain('ws-1');

      const updateCall = vi.mocked(prisma.workspace.update).mock.calls[0][0];
      const updatedSettings = updateCall.data.settings as Record<string, unknown>;

      expect(updatedSettings['customDomain']).toBeUndefined();
      expect(updatedSettings['domainVerificationToken']).toBeUndefined();
      expect(updatedSettings['domainVerificationStatus']).toBeUndefined();
      expect(updatedSettings['domainLastVerifiedAt']).toBeUndefined();
      // Other workspace settings must be preserved
      expect(updatedSettings['otherSetting']).toBe('preserved');
    });

    it('should succeed even when no domain was previously set', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      await expect(service.removeDomain('ws-1')).resolves.not.toThrow();
      expect(prisma.workspace.update).toHaveBeenCalledTimes(1);
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.removeDomain('ghost')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── verifyDomain ─────────────────────────────────────────────────────────

  describe('verifyDomain', () => {
    it('should set status to "verified" when TXT record matches token', async () => {
      const { service, prisma } = makeService();
      const token = 'abc123verificationtoken0000000000';
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: token,
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      // resolveTxt returns records as string[][]
      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(null, [[token]]);
        },
      );

      const result = await service.verifyDomain('ws-1');

      expect(result.status).toBe('verified');
      expect(result.lastVerifiedAt).not.toBeNull();
    });

    it('should set status to "failed" when TXT record is absent', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'abc123',
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      // DNS resolves but returns different records (not matching token)
      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(null, [['unrelated-record']]);
        },
      );

      const result = await service.verifyDomain('ws-1');

      expect(result.status).toBe('failed');
    });

    it('should set status to "failed" when DNS lookup throws (ENOTFOUND)', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'abc123',
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const dnsError = Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' });
      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(dnsError as NodeJS.ErrnoException, []);
        },
      );

      const result = await service.verifyDomain('ws-1');

      expect(result.status).toBe('failed');
    });

    it('should set status to "failed" when DNS returns empty records', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: 'abc123',
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(null, []);
        },
      );

      const result = await service.verifyDomain('ws-1');

      expect(result.status).toBe('failed');
    });

    it('should look up the TXT record at _notesaner-verify.<domain>', async () => {
      const { service, prisma } = makeService();
      const token = 'verificationtoken1234567890abcde';
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'notes.mycompany.com',
            domainVerificationToken: token,
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      let capturedHost = '';
      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          capturedHost = hostname;
          callback(null, [[token]]);
        },
      );

      await service.verifyDomain('ws-1');

      expect(capturedHost).toBe('_notesaner-verify.notes.mycompany.com');
    });

    it('should throw BadRequestException when no domain is configured', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);

      await expect(service.verifyDomain('ws-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when verification token is missing', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            // domainVerificationToken intentionally absent
          },
        }) as never,
      );

      await expect(service.verifyDomain('ws-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException when workspace does not exist', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(null);

      await expect(service.verifyDomain('ghost')).rejects.toThrow(NotFoundException);
    });

    it('should persist updated status to the database', async () => {
      const { service, prisma } = makeService();
      const token = 'abc123verificationtoken0000000000';
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: token,
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(null, [[token]]);
        },
      );

      await service.verifyDomain('ws-1');

      expect(prisma.workspace.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ws-1' },
          data: expect.objectContaining({
            settings: expect.objectContaining({
              domainVerificationStatus: 'verified',
            }),
          }),
        }),
      );
    });

    it('should handle TXT record with multiple chunks (long values)', async () => {
      const { service, prisma } = makeService();
      const token = 'abc123';
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(
        makeWorkspace({
          settings: {
            customDomain: 'docs.example.com',
            domainVerificationToken: token,
            domainVerificationStatus: 'unverified',
          },
        }) as never,
      );
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      // DNS returns the token split across multiple string chunks
      vi.mocked(dns.resolveTxt).mockImplementation(
        (
          _hostname: string,
          callback: (err: NodeJS.ErrnoException | null, addresses: string[][]) => void,
        ) => {
          callback(null, [['abc', '123']]);
        },
      );

      const result = await service.verifyDomain('ws-1');

      expect(result.status).toBe('verified');
    });
  });

  // ─── resolveHostToWorkspace ───────────────────────────────────────────────

  describe('resolveHostToWorkspace', () => {
    it('should resolve a wildcard notesaner.app subdomain to a workspace', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-1', publicSlug: 'my-vault' }) as never,
      );

      const result = await service.resolveHostToWorkspace('my-vault.notesaner.app');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ws-1');
      expect(result!.publicSlug).toBe('my-vault');
    });

    it('should resolve a verified custom domain to a workspace', async () => {
      const { service, prisma } = makeService();
      // findFirst (by publicSlug) returns null — not a wildcard subdomain
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        makeWorkspace({
          id: 'ws-1',
          isPublic: true,
          settings: {
            customDomain: 'docs.mycompany.com',
            domainVerificationStatus: 'verified',
          },
        }),
      ] as never[]);

      const result = await service.resolveHostToWorkspace('docs.mycompany.com');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('ws-1');
    });

    it('should not expose an unverified custom domain', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        makeWorkspace({
          id: 'ws-1',
          isPublic: true,
          settings: {
            customDomain: 'docs.mycompany.com',
            domainVerificationStatus: 'unverified',
          },
        }),
      ] as never[]);

      const result = await service.resolveHostToWorkspace('docs.mycompany.com');

      expect(result).toBeNull();
    });

    it('should not expose a failed custom domain', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([
        makeWorkspace({
          id: 'ws-1',
          isPublic: true,
          settings: {
            customDomain: 'docs.mycompany.com',
            domainVerificationStatus: 'failed',
          },
        }),
      ] as never[]);

      const result = await service.resolveHostToWorkspace('docs.mycompany.com');

      expect(result).toBeNull();
    });

    it('should return null for an unknown host', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

      const result = await service.resolveHostToWorkspace('unknown.example.com');

      expect(result).toBeNull();
    });

    it('should strip the port from the host before resolution', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-1', publicSlug: 'my-vault' }) as never,
      );

      // Port should be stripped, resolving "my-vault.notesaner.app"
      const result = await service.resolveHostToWorkspace('my-vault.notesaner.app:443');

      expect(result).not.toBeNull();
      expect(result!.publicSlug).toBe('my-vault');
    });

    it('should return null for an empty host string', async () => {
      const { service, prisma } = makeService();

      const result = await service.resolveHostToWorkspace('');

      expect(result).toBeNull();
      expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
    });

    it('should not attempt custom domain lookup for notesaner.app subdomains', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(
        makeWorkspace({ id: 'ws-1', publicSlug: 'my-vault' }) as never,
      );

      await service.resolveHostToWorkspace('my-vault.notesaner.app');

      // findMany is used for the custom domain fallback — should not be called
      expect(prisma.workspace.findMany).not.toHaveBeenCalled();
    });

    it('should not expose a private workspace through wildcard subdomain', async () => {
      const { service, prisma } = makeService();
      // findFirst is called with isPublic: true filter — returns null when workspace is private
      vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

      const result = await service.resolveHostToWorkspace('private-vault.notesaner.app');

      expect(result).toBeNull();
    });
  });

  // ─── Token determinism ────────────────────────────────────────────────────

  describe('token generation', () => {
    it('should generate the same token for the same workspaceId + domain pair', async () => {
      const { service, prisma } = makeService();
      vi.mocked(prisma.workspace.findUnique).mockResolvedValue(makeWorkspace() as never);
      vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);
      vi.mocked(prisma.workspace.update).mockResolvedValue(makeWorkspace() as never);

      const result1 = await service.setDomain('ws-1', 'docs.example.com');
      const result2 = await service.setDomain('ws-1', 'docs.example.com');

      expect(result1.verificationToken).toBe(result2.verificationToken);
    });

    it('should generate different tokens for different workspaceIds', async () => {
      const wsA = makeWorkspace({ id: 'ws-A' });
      const wsB = makeWorkspace({ id: 'ws-B' });

      // Alternate calls between ws-A and ws-B
      const prisma = {
        workspace: {
          findUnique: vi.fn(),
          findFirst: vi.fn(),
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn().mockResolvedValue(wsA),
        },
      } as unknown as PrismaService;

      const service = new DomainService(prisma);

      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(wsA as never);
      const resultA = await service.setDomain('ws-A', 'docs.example.com');

      vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce(wsB as never);
      vi.mocked(prisma.workspace.update).mockResolvedValue(wsB as never);
      const resultB = await service.setDomain('ws-B', 'docs.example.com');

      expect(resultA.verificationToken).not.toBe(resultB.verificationToken);
    });
  });
});
