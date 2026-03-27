import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { AdminAuthProvidersController } from '../admin-auth-providers.controller';
import { AdminAuthProvidersService, AuthProviderRecord } from '../admin-auth-providers.service';
import { SuperAdminGuard } from '../../../common/guards/super-admin.guard';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const ADMIN_USER: JwtPayload = {
  sub: 'admin-user-id',
  email: 'admin@example.com',
  isSuperAdmin: true,
  sessionId: 'session-1',
};

const NON_ADMIN_USER: JwtPayload = {
  sub: 'regular-user-id',
  email: 'user@example.com',
  isSuperAdmin: false,
  sessionId: 'session-2',
};

const SAML_PROVIDER: AuthProviderRecord = {
  id: 'provider-saml-1',
  workspaceId: null,
  type: 'SAML',
  name: 'Corporate SAML',
  config: {
    certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
    ssoUrl: 'https://idp.example.com/sso',
    entityId: 'https://app.example.com',
  },
  isEnabled: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// Mock service
// ---------------------------------------------------------------------------

const mockService = {
  listProviders: vi.fn(),
  getProvider: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  deleteProvider: vi.fn(),
  toggleProvider: vi.fn(),
} satisfies Partial<AdminAuthProvidersService>;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AdminAuthProvidersController', () => {
  let controller: AdminAuthProvidersController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new AdminAuthProvidersController(mockService as unknown as AdminAuthProvidersService);
  });

  // -------------------------------------------------------------------------
  // listProviders
  // -------------------------------------------------------------------------

  describe('GET /admin/auth-providers', () => {
    it('delegates to service.listProviders', async () => {
      mockService.listProviders.mockResolvedValue([SAML_PROVIDER]);

      const result = await controller.listProviders({}, ADMIN_USER);

      expect(result).toEqual([SAML_PROVIDER]);
      expect(mockService.listProviders).toHaveBeenCalledWith({});
    });

    it('passes query params to service', async () => {
      mockService.listProviders.mockResolvedValue([]);

      await controller.listProviders({ type: 'SAML', isEnabled: 'true' }, ADMIN_USER);

      expect(mockService.listProviders).toHaveBeenCalledWith({
        type: 'SAML',
        isEnabled: 'true',
      });
    });
  });

  // -------------------------------------------------------------------------
  // getProvider
  // -------------------------------------------------------------------------

  describe('GET /admin/auth-providers/:id', () => {
    it('returns the provider by id', async () => {
      mockService.getProvider.mockResolvedValue(SAML_PROVIDER);

      const result = await controller.getProvider('provider-saml-1', ADMIN_USER);

      expect(result).toEqual(SAML_PROVIDER);
      expect(mockService.getProvider).toHaveBeenCalledWith('provider-saml-1');
    });
  });

  // -------------------------------------------------------------------------
  // createProvider
  // -------------------------------------------------------------------------

  describe('POST /admin/auth-providers', () => {
    const validSamlDto = {
      type: 'SAML',
      name: 'New SAML',
      config: {
        certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
        ssoUrl: 'https://idp.example.com/sso',
        entityId: 'https://app.example.com',
      },
    };

    it('delegates to service.createProvider', async () => {
      mockService.createProvider.mockResolvedValue(SAML_PROVIDER);

      const result = await controller.createProvider(validSamlDto, ADMIN_USER);

      expect(result).toEqual(SAML_PROVIDER);
      expect(mockService.createProvider).toHaveBeenCalledWith(validSamlDto);
    });
  });

  // -------------------------------------------------------------------------
  // updateProvider
  // -------------------------------------------------------------------------

  describe('PUT /admin/auth-providers/:id', () => {
    it('delegates to service.updateProvider', async () => {
      const updated = { ...SAML_PROVIDER, name: 'Renamed' };
      mockService.updateProvider.mockResolvedValue(updated);

      const result = await controller.updateProvider(
        'provider-saml-1',
        { name: 'Renamed' },
        ADMIN_USER,
      );

      expect(result.name).toBe('Renamed');
      expect(mockService.updateProvider).toHaveBeenCalledWith('provider-saml-1', {
        name: 'Renamed',
      });
    });
  });

  // -------------------------------------------------------------------------
  // deleteProvider
  // -------------------------------------------------------------------------

  describe('DELETE /admin/auth-providers/:id', () => {
    it('delegates to service.deleteProvider and returns void', async () => {
      mockService.deleteProvider.mockResolvedValue(undefined);

      const result = await controller.deleteProvider('provider-saml-1', ADMIN_USER);

      expect(result).toBeUndefined();
      expect(mockService.deleteProvider).toHaveBeenCalledWith('provider-saml-1');
    });
  });

  // -------------------------------------------------------------------------
  // toggleProvider
  // -------------------------------------------------------------------------

  describe('PATCH /admin/auth-providers/:id/toggle', () => {
    it('delegates to service.toggleProvider', async () => {
      const toggled = { ...SAML_PROVIDER, isEnabled: false };
      mockService.toggleProvider.mockResolvedValue(toggled);

      const result = await controller.toggleProvider(
        'provider-saml-1',
        { isEnabled: false },
        ADMIN_USER,
      );

      expect(result.isEnabled).toBe(false);
      expect(mockService.toggleProvider).toHaveBeenCalledWith('provider-saml-1', {
        isEnabled: false,
      });
    });
  });
});

// ---------------------------------------------------------------------------
// SuperAdminGuard
// ---------------------------------------------------------------------------

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  function buildContext(user: JwtPayload | undefined) {
    return {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
      getHandler: () => null,
      getClass: () => null,
    } as unknown as Parameters<SuperAdminGuard['canActivate']>[0];
  }

  it('allows super-admin users', () => {
    expect(guard.canActivate(buildContext(ADMIN_USER))).toBe(true);
  });

  it('throws ForbiddenException for non-super-admin users', () => {
    expect(() => guard.canActivate(buildContext(NON_ADMIN_USER))).toThrow(ForbiddenException);
  });

  it('throws ForbiddenException when user is undefined', () => {
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(ForbiddenException);
  });

  it('error message indicates super-admin requirement', () => {
    try {
      guard.canActivate(buildContext(NON_ADMIN_USER));
    } catch (e) {
      expect((e as ForbiddenException).message).toContain('Super-admin');
    }
  });
});
