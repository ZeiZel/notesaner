import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AdminAuthProvidersService, AuthProviderRecord } from '../admin-auth-providers.service';

// ---------------------------------------------------------------------------
// Mock PrismaClient so tests don't need a real DB
// ---------------------------------------------------------------------------

const mockPrismaAuthProvider = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@prisma/client', () => {
  class PrismaClient {
    authProvider = mockPrismaAuthProvider;
  }
  return { PrismaClient };
});

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const SAML_PROVIDER: AuthProviderRecord = {
  id: 'provider-saml-1',
  workspaceId: null,
  type: 'SAML',
  name: 'Corporate SAML',
  config: {
    certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
    ssoUrl: 'https://idp.example.com/sso',
    entityId: 'https://app.example.com',
    signRequests: false,
  },
  isEnabled: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const OIDC_PROVIDER: AuthProviderRecord = {
  id: 'provider-oidc-1',
  workspaceId: null,
  type: 'OIDC',
  name: 'Google SSO',
  config: {
    issuer: 'https://accounts.google.com',
    clientId: 'my-client',
    clientSecret: 'my-secret',
    scopes: ['openid', 'email', 'profile'],
  },
  isEnabled: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const VALID_SAML_CREATE = {
  type: 'SAML',
  name: 'Corporate SAML',
  config: {
    certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
    ssoUrl: 'https://idp.example.com/sso',
    entityId: 'https://app.example.com',
  },
};

const VALID_OIDC_CREATE = {
  type: 'OIDC',
  name: 'Google SSO',
  config: {
    issuer: 'https://accounts.google.com',
    clientId: 'my-client',
    clientSecret: 'my-secret',
  },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminAuthProvidersService', () => {
  let service: AdminAuthProvidersService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AdminAuthProvidersService();
  });

  // -------------------------------------------------------------------------
  // listProviders
  // -------------------------------------------------------------------------

  describe('listProviders', () => {
    it('returns all providers when no filters', async () => {
      mockPrismaAuthProvider.findMany.mockResolvedValue([SAML_PROVIDER, OIDC_PROVIDER]);

      const result = await service.listProviders({});

      expect(result).toHaveLength(2);
      expect(mockPrismaAuthProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by type', async () => {
      mockPrismaAuthProvider.findMany.mockResolvedValue([SAML_PROVIDER]);

      const result = await service.listProviders({ type: 'SAML' });

      expect(result).toHaveLength(1);
      expect(mockPrismaAuthProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: 'SAML' } }),
      );
    });

    it('filters by workspaceId', async () => {
      mockPrismaAuthProvider.findMany.mockResolvedValue([]);
      const wsId = '00000000-0000-0000-0000-000000000001';

      await service.listProviders({ workspaceId: wsId });

      expect(mockPrismaAuthProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { workspaceId: wsId } }),
      );
    });

    it('rejects invalid type filter', async () => {
      await expect(service.listProviders({ type: 'GITHUB' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects invalid workspaceId (not UUID)', async () => {
      await expect(service.listProviders({ workspaceId: 'not-uuid' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // -------------------------------------------------------------------------
  // getProvider
  // -------------------------------------------------------------------------

  describe('getProvider', () => {
    it('returns the provider when found', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);

      const result = await service.getProvider('provider-saml-1');

      expect(result).toEqual(SAML_PROVIDER);
      expect(mockPrismaAuthProvider.findUnique).toHaveBeenCalledWith({
        where: { id: 'provider-saml-1' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(null);

      await expect(service.getProvider('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('NotFoundException message includes the id', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(null);

      await expect(service.getProvider('bad-id')).rejects.toThrow(
        /bad-id/,
      );
    });
  });

  // -------------------------------------------------------------------------
  // createProvider
  // -------------------------------------------------------------------------

  describe('createProvider', () => {
    it('creates a SAML provider with valid DTO', async () => {
      mockPrismaAuthProvider.create.mockResolvedValue(SAML_PROVIDER);

      const result = await service.createProvider(VALID_SAML_CREATE);

      expect(result).toEqual(SAML_PROVIDER);
      expect(mockPrismaAuthProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type: 'SAML',
            name: 'Corporate SAML',
            isEnabled: true,
            workspaceId: null,
          }),
        }),
      );
    });

    it('creates an OIDC provider with valid DTO', async () => {
      mockPrismaAuthProvider.create.mockResolvedValue(OIDC_PROVIDER);

      const result = await service.createProvider(VALID_OIDC_CREATE);

      expect(result).toEqual(OIDC_PROVIDER);
    });

    it('creates with explicit workspaceId', async () => {
      const wsId = '00000000-0000-0000-0000-000000000001';
      mockPrismaAuthProvider.create.mockResolvedValue({ ...OIDC_PROVIDER, workspaceId: wsId });

      await service.createProvider({ ...VALID_OIDC_CREATE, workspaceId: wsId });

      expect(mockPrismaAuthProvider.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ workspaceId: wsId }),
        }),
      );
    });

    it('throws BadRequestException for missing SAML certificate', async () => {
      await expect(
        service.createProvider({
          type: 'SAML',
          name: 'Bad SAML',
          config: { ssoUrl: 'https://idp.example.com', entityId: 'https://app.example.com' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for invalid OIDC config (missing clientSecret)', async () => {
      await expect(
        service.createProvider({
          type: 'OIDC',
          name: 'Bad OIDC',
          config: { issuer: 'https://accounts.google.com', clientId: 'id' },
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for unknown provider type', async () => {
      await expect(
        service.createProvider({ type: 'OAUTH2', name: 'Test', config: {} }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // updateProvider
  // -------------------------------------------------------------------------

  describe('updateProvider', () => {
    it('updates name successfully', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);
      mockPrismaAuthProvider.update.mockResolvedValue({ ...SAML_PROVIDER, name: 'Renamed' });

      const result = await service.updateProvider('provider-saml-1', { name: 'Renamed' });

      expect(result.name).toBe('Renamed');
    });

    it('updates isEnabled to false', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);
      mockPrismaAuthProvider.update.mockResolvedValue({ ...SAML_PROVIDER, isEnabled: false });

      const result = await service.updateProvider('provider-saml-1', { isEnabled: false });

      expect(result.isEnabled).toBe(false);
    });

    it('accepts empty update body (no-op)', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);
      mockPrismaAuthProvider.update.mockResolvedValue(SAML_PROVIDER);

      const result = await service.updateProvider('provider-saml-1', {});

      expect(result).toEqual(SAML_PROVIDER);
    });

    it('throws NotFoundException for non-existent provider', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(null);

      await expect(service.updateProvider('ghost-id', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPrismaAuthProvider.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException for invalid update data', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);

      await expect(
        service.updateProvider('provider-saml-1', { name: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // -------------------------------------------------------------------------
  // deleteProvider
  // -------------------------------------------------------------------------

  describe('deleteProvider', () => {
    it('deletes an existing provider', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);
      mockPrismaAuthProvider.delete.mockResolvedValue(SAML_PROVIDER);

      await expect(service.deleteProvider('provider-saml-1')).resolves.toBeUndefined();
      expect(mockPrismaAuthProvider.delete).toHaveBeenCalledWith({
        where: { id: 'provider-saml-1' },
      });
    });

    it('throws NotFoundException for non-existent provider', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(null);

      await expect(service.deleteProvider('ghost-id')).rejects.toThrow(NotFoundException);
      expect(mockPrismaAuthProvider.delete).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // toggleProvider
  // -------------------------------------------------------------------------

  describe('toggleProvider', () => {
    it('enables a disabled provider', async () => {
      const disabled = { ...SAML_PROVIDER, isEnabled: false };
      mockPrismaAuthProvider.findUnique.mockResolvedValue(disabled);
      mockPrismaAuthProvider.update.mockResolvedValue({ ...disabled, isEnabled: true });

      const result = await service.toggleProvider('provider-saml-1', { isEnabled: true });

      expect(result.isEnabled).toBe(true);
      expect(mockPrismaAuthProvider.update).toHaveBeenCalledWith({
        where: { id: 'provider-saml-1' },
        data: { isEnabled: true },
      });
    });

    it('disables an enabled provider', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(SAML_PROVIDER);
      mockPrismaAuthProvider.update.mockResolvedValue({ ...SAML_PROVIDER, isEnabled: false });

      const result = await service.toggleProvider('provider-saml-1', { isEnabled: false });

      expect(result.isEnabled).toBe(false);
    });

    it('throws NotFoundException for non-existent provider', async () => {
      mockPrismaAuthProvider.findUnique.mockResolvedValue(null);

      await expect(
        service.toggleProvider('ghost-id', { isEnabled: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when isEnabled is missing', async () => {
      await expect(service.toggleProvider('provider-saml-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when isEnabled is a string', async () => {
      await expect(
        service.toggleProvider('provider-saml-1', { isEnabled: 'yes' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
