import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { StorageQuotaService } from '../../modules/workspaces/storage-quota.service';

/**
 * Quota check types that can be applied to endpoints.
 */
export type QuotaCheckType = 'storage' | 'note' | 'file-size';

/**
 * Metadata key for the @QuotaCheck() decorator.
 */
export const QUOTA_CHECK_KEY = 'quota_check';

/**
 * Decorator to mark endpoints that require quota validation before processing.
 *
 * @param checks - Array of quota check types to enforce
 *
 * @example
 * // Enforce storage and note count quotas
 * @QuotaCheck(['storage', 'note'])
 * @Post('notes')
 * async createNote() { ... }
 *
 * @example
 * // Enforce storage and file-size quotas on upload
 * @QuotaCheck(['storage', 'file-size'])
 * @Post('attachments')
 * async uploadFile() { ... }
 */
export function QuotaCheck(checks: QuotaCheckType[]): MethodDecorator & ClassDecorator {
  return SetMetadata(QUOTA_CHECK_KEY, checks);
}

/**
 * HTTP 507 Insufficient Storage error.
 * Thrown when a workspace exceeds its storage quota.
 */
export class InsufficientStorageException extends HttpException {
  constructor(message: string) {
    super(
      {
        statusCode: HttpStatus.INSUFFICIENT_STORAGE,
        error: 'Insufficient Storage',
        message,
      },
      HttpStatus.INSUFFICIENT_STORAGE,
    );
  }
}

/**
 * Guard that enforces workspace storage quotas on decorated endpoints.
 *
 * Expects the workspaceId to be available as a route parameter (`:workspaceId`).
 *
 * For file uploads, the guard reads the file size from the request body
 * (`req.file.size` for single file, populated by Multer).
 *
 * When the quota is exceeded, throws 507 Insufficient Storage.
 * When approaching the warning threshold (>=80%), sets `X-Quota-Warning` header.
 */
@Injectable()
export class QuotaGuard implements CanActivate {
  private readonly logger = new Logger(QuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly storageQuotaService: StorageQuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const checks = this.reflector.getAllAndOverride<QuotaCheckType[] | undefined>(QUOTA_CHECK_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @QuotaCheck decorator — allow request
    if (!checks || checks.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      params?: Record<string, string>;
      file?: { size: number };
    }>();
    const response = context.switchToHttp().getResponse();

    const workspaceId = request.params?.['workspaceId'];
    if (!workspaceId) {
      this.logger.warn('QuotaGuard applied to route without workspaceId param — skipping check');
      return true;
    }

    // Run all requested quota checks
    for (const check of checks) {
      switch (check) {
        case 'storage': {
          const fileSizeBytes = request.file ? BigInt(request.file.size) : 0n;
          const withinQuota = await this.storageQuotaService.checkStorageQuota(
            workspaceId,
            fileSizeBytes,
          );
          if (!withinQuota) {
            throw new InsufficientStorageException(
              'Workspace storage quota exceeded. Delete some files or contact an administrator to increase your quota.',
            );
          }
          break;
        }

        case 'note': {
          const withinQuota = await this.storageQuotaService.checkNoteQuota(workspaceId);
          if (!withinQuota) {
            throw new InsufficientStorageException(
              'Workspace note count limit exceeded. Delete some notes or contact an administrator to increase your quota.',
            );
          }
          break;
        }

        case 'file-size': {
          const fileSize = request.file?.size;
          if (fileSize) {
            const withinLimit = await this.storageQuotaService.checkFileSizeLimit(
              workspaceId,
              BigInt(fileSize),
            );
            if (!withinLimit) {
              throw new InsufficientStorageException(
                'File size exceeds the maximum allowed for this workspace.',
              );
            }
          }
          break;
        }
      }
    }

    // Set warning header if approaching quota
    try {
      const isWarning = await this.storageQuotaService.isStorageWarning(workspaceId);
      if (isWarning) {
        response.setHeader('X-Quota-Warning', 'Storage usage is approaching the limit');
      }
    } catch (err) {
      // Warning header is best-effort — don't block the request
      this.logger.warn(
        `Failed to check storage warning for workspace ${workspaceId}: ${String(err)}`,
      );
    }

    return true;
  }
}
