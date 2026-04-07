import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import {
  CreateAuthProviderDto,
  CreateAuthProviderSchema,
  ListAuthProvidersQuerySchema,
  ToggleAuthProviderDto,
  ToggleAuthProviderSchema,
  UpdateAuthProviderDto,
  UpdateAuthProviderSchema,
} from './dto/auth-provider.dto';

/** Minimal shape of an AuthProvider record returned to callers */
export interface AuthProviderRecord {
  id: string;
  workspaceId: string | null;
  type: string;
  name: string;
  config: unknown;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Service for admin-level management of authentication providers (SAML/OIDC).
 *
 * Providers can be global (workspaceId=null) or scoped to a specific workspace.
 * Super-admins can manage all providers; workspace OWNERs may be granted access
 * to workspace-scoped providers via a separate controller in the future.
 */
@Injectable()
export class AdminAuthProvidersService {
  private readonly logger = new Logger(AdminAuthProvidersService.name);

  /**
   * Injecting PrismaClient directly because a shared PrismaModule/PrismaService
   * does not yet exist in this scaffold. This follows the stub-service pattern
   * used throughout the codebase. Replace with `PrismaService` injection once
   * the shared Prisma module is introduced.
   */
  private readonly prisma = new PrismaClient();

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  async listProviders(rawQuery: unknown): Promise<AuthProviderRecord[]> {
    const query = this.parseOrThrow(ListAuthProvidersQuerySchema, rawQuery);

    return this.prisma.authProvider.findMany({
      where: {
        ...(query.workspaceId !== undefined && { workspaceId: query.workspaceId }),
        ...(query.type !== undefined && { type: query.type as 'SAML' | 'OIDC' | 'LOCAL' }),
        ...(query.isEnabled !== undefined && { isEnabled: query.isEnabled }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ---------------------------------------------------------------------------
  // GET ONE
  // ---------------------------------------------------------------------------

  async getProvider(id: string): Promise<AuthProviderRecord> {
    const provider = await this.prisma.authProvider.findUnique({ where: { id } });

    if (!provider) {
      throw new NotFoundException(`Auth provider with id "${id}" not found`);
    }

    return provider;
  }

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  async createProvider(rawDto: unknown): Promise<AuthProviderRecord> {
    const dto = this.parseOrThrow(CreateAuthProviderSchema, rawDto) as CreateAuthProviderDto;

    this.logger.log(`Creating auth provider type=${dto.type} name="${dto.name}"`);

    return this.prisma.authProvider.create({
      data: {
        type: dto.type,
        name: dto.name,
        config: dto.config as unknown as Prisma.InputJsonValue,
        isEnabled: dto.isEnabled ?? true,
        workspaceId: dto.workspaceId ?? null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  async updateProvider(id: string, rawDto: unknown): Promise<AuthProviderRecord> {
    const dto = this.parseOrThrow(UpdateAuthProviderSchema, rawDto) as UpdateAuthProviderDto;

    // Verify the provider exists before updating
    await this.getProvider(id);

    this.logger.log(`Updating auth provider id="${id}"`);

    return this.prisma.authProvider.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.isEnabled !== undefined && { isEnabled: dto.isEnabled }),
        ...(dto.config !== undefined && { config: dto.config as unknown as Prisma.InputJsonValue }),
      },
    });
  }

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  async deleteProvider(id: string): Promise<void> {
    // Verify the provider exists before deleting
    await this.getProvider(id);

    this.logger.log(`Deleting auth provider id="${id}"`);

    await this.prisma.authProvider.delete({ where: { id } });
  }

  // ---------------------------------------------------------------------------
  // TOGGLE
  // ---------------------------------------------------------------------------

  async toggleProvider(id: string, rawDto: unknown): Promise<AuthProviderRecord> {
    const dto = this.parseOrThrow(ToggleAuthProviderSchema, rawDto) as ToggleAuthProviderDto;

    // Verify the provider exists before toggling
    await this.getProvider(id);

    this.logger.log(`Toggling auth provider id="${id}" isEnabled=${dto.isEnabled}`);

    return this.prisma.authProvider.update({
      where: { id },
      data: { isEnabled: dto.isEnabled },
    });
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /**
   * Parses `input` against a Zod schema and throws a NestJS `BadRequestException`
   * with a human-readable validation message on failure.
   *
   * Compatible with Zod v4 (uses PropertyKey[] for path, .issues for error list).
   */
  private parseOrThrow<T>(
    schema: {
      safeParse: (v: unknown) => {
        success: boolean;
        data?: T;
        error?: {
          issues?: Array<{ path: PropertyKey[]; message: string }>;
          errors?: Array<{ path: PropertyKey[]; message: string }>;
        };
      };
    },
    input: unknown,
  ): T {
    const result = schema.safeParse(input);

    if (!result.success) {
      // Zod v4 uses .issues, Zod v3 uses .errors (which is an alias for .issues)
      const issueList = result.error?.issues ?? result.error?.errors ?? [];
      const messages = issueList.map((e) => `${String(e.path.join('.')) || 'body'}: ${e.message}`);
      throw new BadRequestException(messages.join('; '));
    }

    return result.data as T;
  }
}
