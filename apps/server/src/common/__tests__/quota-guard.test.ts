import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExecutionContext, HttpStatus } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { QuotaGuard, InsufficientStorageException } from '../guards/quota.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WORKSPACE_ID = 'ws-quota-guard-test';

function makeStorageQuotaService() {
  return {
    checkStorageQuota: vi.fn().mockResolvedValue(true),
    checkNoteQuota: vi.fn().mockResolvedValue(true),
    checkFileSizeLimit: vi.fn().mockResolvedValue(true),
    isStorageWarning: vi.fn().mockResolvedValue(false),
  };
}

function makeReflector(checks?: string[]) {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(checks),
  } as unknown as Reflector;
}

function makeExecutionContext(
  overrides: {
    workspaceId?: string;
    file?: { size: number };
  } = {},
): ExecutionContext {
  const response = {
    setHeader: vi.fn(),
  };
  const request = {
    params: { workspaceId: overrides.workspaceId ?? WORKSPACE_ID },
    file: overrides.file,
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

function makeGuard(
  reflector?: Reflector,
  storageService?: ReturnType<typeof makeStorageQuotaService>,
) {
  const reflectorInstance = reflector ?? makeReflector(undefined);
  const serviceInstance = storageService ?? makeStorageQuotaService();
  return {
    guard: new QuotaGuard(reflectorInstance, serviceInstance as never),
    reflector: reflectorInstance,
    storageService: serviceInstance,
  };
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('QuotaGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows request when no @QuotaCheck decorator is present', async () => {
    const { guard } = makeGuard(makeReflector(undefined));
    const ctx = makeExecutionContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows request when @QuotaCheck has empty array', async () => {
    const { guard } = makeGuard(makeReflector([]));
    const ctx = makeExecutionContext();
    expect(await guard.canActivate(ctx)).toBe(true);
  });

  it('allows request when workspace has no workspaceId param', async () => {
    const { guard } = makeGuard(makeReflector(['storage']));
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ params: {} }),
        getResponse: () => ({ setHeader: vi.fn() }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;

    expect(await guard.canActivate(ctx)).toBe(true);
  });

  // ─── Storage check ────────────────────────────────────────────────────────

  describe('storage check', () => {
    it('allows request when under storage quota', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkStorageQuota.mockResolvedValue(true);

      const { guard } = makeGuard(makeReflector(['storage']), storageService);
      const ctx = makeExecutionContext();

      expect(await guard.canActivate(ctx)).toBe(true);
      expect(storageService.checkStorageQuota).toHaveBeenCalledWith(WORKSPACE_ID, 0n);
    });

    it('blocks request when storage quota exceeded', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkStorageQuota.mockResolvedValue(false);

      const { guard } = makeGuard(makeReflector(['storage']), storageService);
      const ctx = makeExecutionContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(InsufficientStorageException);
    });

    it('accounts for file size in storage check', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkStorageQuota.mockResolvedValue(true);

      const { guard } = makeGuard(makeReflector(['storage']), storageService);
      const ctx = makeExecutionContext({ file: { size: 5_000_000 } });

      await guard.canActivate(ctx);
      expect(storageService.checkStorageQuota).toHaveBeenCalledWith(
        WORKSPACE_ID,
        BigInt(5_000_000),
      );
    });
  });

  // ─── Note check ───────────────────────────────────────────────────────────

  describe('note check', () => {
    it('allows request when under note limit', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkNoteQuota.mockResolvedValue(true);

      const { guard } = makeGuard(makeReflector(['note']), storageService);
      const ctx = makeExecutionContext();

      expect(await guard.canActivate(ctx)).toBe(true);
    });

    it('blocks request when note limit exceeded', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkNoteQuota.mockResolvedValue(false);

      const { guard } = makeGuard(makeReflector(['note']), storageService);
      const ctx = makeExecutionContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(InsufficientStorageException);
    });
  });

  // ─── File-size check ──────────────────────────────────────────────────────

  describe('file-size check', () => {
    it('allows request when file size is within limit', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkFileSizeLimit.mockResolvedValue(true);

      const { guard } = makeGuard(makeReflector(['file-size']), storageService);
      const ctx = makeExecutionContext({ file: { size: 10_000_000 } });

      expect(await guard.canActivate(ctx)).toBe(true);
      expect(storageService.checkFileSizeLimit).toHaveBeenCalledWith(
        WORKSPACE_ID,
        BigInt(10_000_000),
      );
    });

    it('blocks request when file exceeds size limit', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkFileSizeLimit.mockResolvedValue(false);

      const { guard } = makeGuard(makeReflector(['file-size']), storageService);
      const ctx = makeExecutionContext({ file: { size: 100_000_000 } });

      await expect(guard.canActivate(ctx)).rejects.toThrow(InsufficientStorageException);
    });

    it('skips file-size check when no file is attached', async () => {
      const storageService = makeStorageQuotaService();

      const { guard } = makeGuard(makeReflector(['file-size']), storageService);
      const ctx = makeExecutionContext();

      expect(await guard.canActivate(ctx)).toBe(true);
      expect(storageService.checkFileSizeLimit).not.toHaveBeenCalled();
    });
  });

  // ─── Multiple checks ─────────────────────────────────────────────────────

  describe('multiple checks', () => {
    it('runs all checks when multiple are specified', async () => {
      const storageService = makeStorageQuotaService();
      const { guard } = makeGuard(makeReflector(['storage', 'note']), storageService);
      const ctx = makeExecutionContext();

      await guard.canActivate(ctx);

      expect(storageService.checkStorageQuota).toHaveBeenCalled();
      expect(storageService.checkNoteQuota).toHaveBeenCalled();
    });

    it('fails fast on first quota violation', async () => {
      const storageService = makeStorageQuotaService();
      storageService.checkStorageQuota.mockResolvedValue(false);

      const { guard } = makeGuard(makeReflector(['storage', 'note']), storageService);
      const ctx = makeExecutionContext();

      await expect(guard.canActivate(ctx)).rejects.toThrow(InsufficientStorageException);
      // Note quota should not be checked since storage already failed
      expect(storageService.checkNoteQuota).not.toHaveBeenCalled();
    });
  });

  // ─── Warning header ──────────────────────────────────────────────────────

  describe('warning header', () => {
    it('sets X-Quota-Warning header when storage is at warning level', async () => {
      const storageService = makeStorageQuotaService();
      storageService.isStorageWarning.mockResolvedValue(true);

      const { guard } = makeGuard(makeReflector(['storage']), storageService);
      const ctx = makeExecutionContext();
      const response = ctx.switchToHttp().getResponse();

      await guard.canActivate(ctx);

      expect(response.setHeader).toHaveBeenCalledWith(
        'X-Quota-Warning',
        'Storage usage is approaching the limit',
      );
    });

    it('does not set X-Quota-Warning when under threshold', async () => {
      const storageService = makeStorageQuotaService();
      storageService.isStorageWarning.mockResolvedValue(false);

      const { guard } = makeGuard(makeReflector(['storage']), storageService);
      const ctx = makeExecutionContext();
      const response = ctx.switchToHttp().getResponse();

      await guard.canActivate(ctx);

      expect(response.setHeader).not.toHaveBeenCalled();
    });
  });

  // ─── InsufficientStorageException ─────────────────────────────────────────

  describe('InsufficientStorageException', () => {
    it('returns HTTP 507 status', () => {
      const exception = new InsufficientStorageException('quota exceeded');
      expect(exception.getStatus()).toBe(HttpStatus.INSUFFICIENT_STORAGE);
    });

    it('includes the error message in the response body', () => {
      const exception = new InsufficientStorageException('quota exceeded');
      const response = exception.getResponse() as Record<string, unknown>;
      expect(response['message']).toBe('quota exceeded');
      expect(response['statusCode']).toBe(507);
      expect(response['error']).toBe('Insufficient Storage');
    });
  });
});
