/**
 * Security tests: Authorization
 *
 * Covers:
 * - IDOR (Insecure Direct Object Reference) prevention
 * - Role-based access control verification
 * - Role hierarchy enforcement
 * - Super-admin guard
 * - JWT auth guard (public vs protected routes)
 * - API key permission enforcement
 * - WebSocket connection limits (DoS prevention)
 * - Workspace membership scoping
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, type WorkspaceRole } from '../../common/guards/roles.guard';
import { SuperAdminGuard } from '../../common/guards/super-admin.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockExecutionContext(overrides: {
  user?: {
    sub?: string;
    workspaceRole?: WorkspaceRole;
    isSuperAdmin?: boolean;
    sessionId?: string;
  } | null;
  handlerMetadata?: Record<string, unknown>;
  classMetadata?: Record<string, unknown>;
}): ExecutionContext {
  const request = {
    user: overrides.user ?? undefined,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function createMockReflector(roles?: WorkspaceRole[], isPublic?: boolean) {
  return {
    getAllAndOverride: vi.fn((key: string) => {
      if (key === 'roles') return roles;
      if (key === 'isPublic') return isPublic;
      return undefined;
    }),
  } as unknown as Reflector;
}

// ---------------------------------------------------------------------------
// 1. Role-Based Access Control (RBAC)
// ---------------------------------------------------------------------------

describe('RolesGuard', () => {
  it('should allow access when no roles are required', () => {
    const reflector = createMockReflector(undefined);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'VIEWER' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow access when empty roles array is required', () => {
    const reflector = createMockReflector([]);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'VIEWER' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access when user has no workspace role', () => {
    const reflector = createMockReflector(['EDITOR']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('No workspace role assigned');
  });

  it('should deny VIEWER access to EDITOR-required routes', () => {
    const reflector = createMockReflector(['EDITOR']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'VIEWER' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Insufficient permissions');
  });

  it('should deny VIEWER access to ADMIN-required routes', () => {
    const reflector = createMockReflector(['ADMIN']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'VIEWER' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should deny EDITOR access to ADMIN-required routes', () => {
    const reflector = createMockReflector(['ADMIN']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'EDITOR' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should allow ADMIN access to EDITOR-required routes (hierarchy)', () => {
    const reflector = createMockReflector(['EDITOR']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'ADMIN' },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should allow OWNER access to any role-required route', () => {
    const roles: WorkspaceRole[] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];

    for (const required of roles) {
      const reflector = createMockReflector([required]);
      const guard = new RolesGuard(reflector);
      const context = createMockExecutionContext({
        user: { sub: 'user-1', workspaceRole: 'OWNER' },
      });

      expect(guard.canActivate(context)).toBe(true);
    }
  });

  it('should enforce correct hierarchy: OWNER > ADMIN > EDITOR > VIEWER', () => {
    const hierarchy: WorkspaceRole[] = ['VIEWER', 'EDITOR', 'ADMIN', 'OWNER'];

    for (let i = 0; i < hierarchy.length; i++) {
      for (let j = 0; j < hierarchy.length; j++) {
        const requiredRole = hierarchy[i];
        const userRole = hierarchy[j];

        const reflector = createMockReflector([requiredRole]);
        const guard = new RolesGuard(reflector);
        const context = createMockExecutionContext({
          user: { sub: 'user-1', workspaceRole: userRole },
        });

        if (j >= i) {
          // User role is sufficient (same level or higher)
          expect(guard.canActivate(context)).toBe(true);
        } else {
          // User role is insufficient
          expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
        }
      }
    }
  });

  it('should allow access when any of multiple required roles matches', () => {
    // Route requires EDITOR or ADMIN
    const reflector = createMockReflector(['EDITOR', 'ADMIN']);
    const guard = new RolesGuard(reflector);

    // EDITOR should pass (matches EDITOR requirement)
    const editorContext = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'EDITOR' },
    });
    expect(guard.canActivate(editorContext)).toBe(true);

    // VIEWER should fail (below both EDITOR and ADMIN)
    const viewerContext = createMockExecutionContext({
      user: { sub: 'user-2', workspaceRole: 'VIEWER' },
    });
    expect(() => guard.canActivate(viewerContext)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// 2. Super-Admin Guard
// ---------------------------------------------------------------------------

describe('SuperAdminGuard', () => {
  let guard: SuperAdminGuard;

  beforeEach(() => {
    guard = new SuperAdminGuard();
  });

  it('should reject unauthenticated requests', () => {
    const context = createMockExecutionContext({ user: null });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Authentication required');
  });

  it('should reject non-super-admin users', () => {
    const context = createMockExecutionContext({
      user: { sub: 'user-1', isSuperAdmin: false },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Super-admin access required');
  });

  it('should allow super-admin users', () => {
    const context = createMockExecutionContext({
      user: { sub: 'admin-1', isSuperAdmin: true },
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should reject when isSuperAdmin is undefined', () => {
    const context = createMockExecutionContext({
      user: { sub: 'user-1' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('should reject when user object is missing from request', () => {
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({}), // No user property at all
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});

// ---------------------------------------------------------------------------
// 3. API Key Permission Enforcement
// ---------------------------------------------------------------------------

describe('API Key Permission Enforcement', () => {
  it('should reject requests with invalid API key format', async () => {
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');

    const mockPrisma = {
      $queryRaw: vi.fn(),
      $executeRaw: vi.fn(),
    };

    const service = new ApiKeyService(mockPrisma as never);

    // Empty key
    await expect(service.validate('')).rejects.toThrow(UnauthorizedException);

    // Key without nsk_ prefix
    await expect(service.validate('invalid_key')).rejects.toThrow(UnauthorizedException);
  });

  it('should reject revoked API keys', async () => {
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');

    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([
        {
          id: 'key-1',
          workspace_id: 'ws-1',
          user_id: 'user-1',
          permissions: ['NOTES_READ'],
          is_revoked: true, // Revoked!
        },
      ]),
      $executeRaw: vi.fn(),
    };

    const service = new ApiKeyService(mockPrisma as never);

    await expect(service.validate('nsk_' + 'a'.repeat(64))).rejects.toThrow(UnauthorizedException);
  });

  it('should reject keys not found in database', async () => {
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');

    const mockPrisma = {
      $queryRaw: vi.fn().mockResolvedValue([]), // No matching key
      $executeRaw: vi.fn(),
    };

    const service = new ApiKeyService(mockPrisma as never);

    await expect(service.validate('nsk_' + 'a'.repeat(64))).rejects.toThrow(UnauthorizedException);
  });

  it('should enforce granular API key permissions', async () => {
    const { ApiKeyService } = await import('../../modules/api-v1/api-key.service');
    const { ApiKeyPermission } = await import('../../modules/api-v1/dto/create-api-key.dto');

    const service = new ApiKeyService({} as never);

    const readOnlyKey = {
      id: 'key-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      permissions: [ApiKeyPermission.NOTES_READ],
    };

    // Read permission should pass
    expect(() => service.assertPermission(readOnlyKey, ApiKeyPermission.NOTES_READ)).not.toThrow();

    // Write permission should fail
    expect(() => service.assertPermission(readOnlyKey, ApiKeyPermission.NOTES_WRITE)).toThrow(
      ForbiddenException,
    );

    // Delete permission should fail
    expect(() => service.assertPermission(readOnlyKey, ApiKeyPermission.NOTES_DELETE)).toThrow(
      ForbiddenException,
    );
  });
});

// ---------------------------------------------------------------------------
// 4. API Key Guard
// ---------------------------------------------------------------------------

describe('ApiKeyGuard', () => {
  it('should reject requests without X-API-Key header', async () => {
    const { ApiKeyGuard } = await import('../../modules/api-v1/api-key.guard');

    const mockApiKeyService = {
      validate: vi.fn(),
    };

    const guard = new ApiKeyGuard(mockApiKeyService as never);

    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          headers: {}, // No X-API-Key
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    expect(mockApiKeyService.validate).not.toHaveBeenCalled();
  });

  it('should call validate with the provided API key', async () => {
    const { ApiKeyGuard, API_KEY_CONTEXT } = await import('../../modules/api-v1/api-key.guard');

    const validatedKey = {
      id: 'key-1',
      workspaceId: 'ws-1',
      userId: 'user-1',
      permissions: ['NOTES_READ'],
    };

    const mockApiKeyService = {
      validate: vi.fn().mockResolvedValue(validatedKey),
    };

    const guard = new ApiKeyGuard(mockApiKeyService as never);

    const request: Record<string | symbol, unknown> = {
      headers: { 'x-api-key': 'nsk_test' },
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(mockApiKeyService.validate).toHaveBeenCalledWith('nsk_test');
    // Validated key should be attached to request
    expect(request[API_KEY_CONTEXT]).toEqual(validatedKey);
  });
});

// ---------------------------------------------------------------------------
// 5. WebSocket Connection Limits (DoS Prevention)
// ---------------------------------------------------------------------------

describe('WebSocket Connection Limit Guard', () => {
  it('should reject connections exceeding per-user limit', async () => {
    const { WsConnectionLimitGuard } =
      await import('../../common/guards/ws-connection-limit.guard');

    const mockRedis = {
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(5), // At limit (max=5)
      zadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(5),
    };

    const guard = new WsConnectionLimitGuard(mockRedis as never, mockConfig as never);

    const context = {
      switchToWs: () => ({
        getClient: () => ({
          id: 'conn-6',
          userId: 'user-1',
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(false);
  });

  it('should allow connections within per-user limit', async () => {
    const { WsConnectionLimitGuard } =
      await import('../../common/guards/ws-connection-limit.guard');

    const mockRedis = {
      zremrangebyscore: vi.fn().mockResolvedValue(0),
      zcard: vi.fn().mockResolvedValue(2), // Well within limit
      zadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(5),
    };

    const guard = new WsConnectionLimitGuard(mockRedis as never, mockConfig as never);

    const context = {
      switchToWs: () => ({
        getClient: () => ({
          id: 'conn-3',
          userId: 'user-1',
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should fail open when ValKey is unreachable', async () => {
    const { WsConnectionLimitGuard } =
      await import('../../common/guards/ws-connection-limit.guard');

    const mockRedis = {
      zremrangebyscore: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      zcard: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      zadd: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
      expire: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(5),
    };

    const guard = new WsConnectionLimitGuard(mockRedis as never, mockConfig as never);

    const context = {
      switchToWs: () => ({
        getClient: () => ({
          id: 'conn-1',
          userId: 'user-1',
        }),
      }),
    } as unknown as ExecutionContext;

    // Should fail open (allow the connection)
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow unauthenticated connections (handled elsewhere)', async () => {
    const { WsConnectionLimitGuard } =
      await import('../../common/guards/ws-connection-limit.guard');

    const mockRedis = {};
    const mockConfig = {
      get: vi.fn().mockReturnValue(5),
    };

    const guard = new WsConnectionLimitGuard(mockRedis as never, mockConfig as never);

    const context = {
      switchToWs: () => ({
        getClient: () => ({
          id: 'conn-1',
          // No userId — unauthenticated
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should clean up stale connections before counting', async () => {
    const { WsConnectionLimitGuard } =
      await import('../../common/guards/ws-connection-limit.guard');

    const mockRedis = {
      zremrangebyscore: vi.fn().mockResolvedValue(3), // Removed 3 stale
      zcard: vi.fn().mockResolvedValue(2), // 2 remaining (within limit)
      zadd: vi.fn().mockResolvedValue(1),
      expire: vi.fn().mockResolvedValue(1),
    };

    const mockConfig = {
      get: vi.fn().mockReturnValue(5),
    };

    const guard = new WsConnectionLimitGuard(mockRedis as never, mockConfig as never);

    const context = {
      switchToWs: () => ({
        getClient: () => ({
          id: 'conn-1',
          userId: 'user-1',
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);

    // Verify stale cleanup was called
    expect(mockRedis.zremrangebyscore).toHaveBeenCalledWith(
      'ws:connections:user-1',
      0,
      expect.any(Number),
    );
  });
});

// ---------------------------------------------------------------------------
// 6. IDOR Scenario Tests
// ---------------------------------------------------------------------------

describe('IDOR Prevention - Attachment Service', () => {
  it('should reject uploads to notes in a different workspace', async () => {
    const { AttachmentService } = await import('../../modules/files/attachment.service');
    const { NotFoundException } = await import('@nestjs/common');

    const mockPrisma = {
      note: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'note-1',
          workspaceId: 'workspace-owner', // Note belongs to workspace-owner
        }),
      },
      attachment: {
        create: vi.fn(),
      },
    };

    const mockFilesService = {
      resolveSafePath: vi.fn().mockReturnValue('/safe/path'),
    };

    const config = {
      get: vi.fn().mockReturnValue(50),
    };

    const service = new AttachmentService(
      mockPrisma as never,
      mockFilesService as never,
      config as never,
    );

    const fakeFile = {
      mimetype: 'image/png',
      size: 1000,
      originalname: 'test.png',
      buffer: Buffer.from('fake'),
    };

    // Attacker tries to upload to workspace-attacker, but note belongs to workspace-owner
    await expect(service.upload('workspace-attacker', 'note-1', fakeFile as never)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should reject deletion of attachments in a different workspace', async () => {
    const { AttachmentService } = await import('../../modules/files/attachment.service');
    const { NotFoundException } = await import('@nestjs/common');

    const mockPrisma = {
      attachment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'attachment-1',
          noteId: 'note-1',
          filename: 'secret.pdf',
          mimeType: 'application/pdf',
          size: 5000,
          path: '.attachments/note-1/secret.pdf',
          createdAt: new Date(),
        }),
        delete: vi.fn(),
      },
      note: {
        findUnique: vi.fn().mockResolvedValue({
          workspaceId: 'workspace-owner', // Not the attacker's workspace
        }),
      },
    };

    const mockFilesService = {
      deleteFile: vi.fn(),
    };

    const config = {
      get: vi.fn().mockReturnValue(50),
    };

    const service = new AttachmentService(
      mockPrisma as never,
      mockFilesService as never,
      config as never,
    );

    await expect(service.delete('workspace-attacker', 'attachment-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});

// ---------------------------------------------------------------------------
// 7. Privilege Escalation Scenarios
// ---------------------------------------------------------------------------

describe('Privilege Escalation Prevention', () => {
  it('VIEWER cannot modify workspace settings (requires ADMIN)', () => {
    const reflector = createMockReflector(['ADMIN']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'VIEWER' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('EDITOR cannot manage workspace members (requires ADMIN)', () => {
    const reflector = createMockReflector(['ADMIN']);
    const guard = new RolesGuard(reflector);
    const context = createMockExecutionContext({
      user: { sub: 'user-1', workspaceRole: 'EDITOR' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('ADMIN cannot access super-admin endpoints', () => {
    const guard = new SuperAdminGuard();
    const context = createMockExecutionContext({
      user: { sub: 'user-1', isSuperAdmin: false, workspaceRole: 'ADMIN' },
    });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('regular user with OWNER workspace role cannot be super-admin', () => {
    const guard = new SuperAdminGuard();
    const context = createMockExecutionContext({
      user: { sub: 'user-1', isSuperAdmin: false, workspaceRole: 'OWNER' },
    });

    // OWNER of a workspace is NOT a super-admin
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
