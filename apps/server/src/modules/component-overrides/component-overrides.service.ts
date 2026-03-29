import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { getComponentMeta } from '@notesaner/component-sdk';
import type { CreateOverrideDto, UpdateOverrideDto } from './dto';

/** Allowed workspace roles for admin operations. */
const ADMIN_ROLES = new Set(['OWNER', 'ADMIN']);

@Injectable()
export class ComponentOverridesService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Auth helper
  // ---------------------------------------------------------------------------

  private async assertAdminRole(workspaceId: string, userId: string): Promise<void> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
      select: { role: true },
    });
    if (!member || !ADMIN_ROLES.has(member.role)) {
      throw new ForbiddenException('Workspace OWNER or ADMIN role required.');
    }
  }

  // ---------------------------------------------------------------------------
  // CRUD
  // ---------------------------------------------------------------------------

  async list(workspaceId: string, userId: string) {
    await this.assertAdminRole(workspaceId, userId);
    return this.prisma.componentOverride.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getOne(workspaceId: string, componentId: string, userId: string) {
    await this.assertAdminRole(workspaceId, userId);
    const record = await this.prisma.componentOverride.findUnique({
      where: { workspaceId_componentId: { workspaceId, componentId } },
    });
    if (!record) throw new NotFoundException(`No override for component "${componentId}".`);
    return record;
  }

  async create(workspaceId: string, dto: CreateOverrideDto, userId: string) {
    await this.assertAdminRole(workspaceId, userId);

    const meta = getComponentMeta(dto.componentId as Parameters<typeof getComponentMeta>[0]);
    if (!meta) {
      throw new BadRequestException(`Unknown component id: "${dto.componentId}".`);
    }

    const existing = await this.prisma.componentOverride.findUnique({
      where: { workspaceId_componentId: { workspaceId, componentId: dto.componentId } },
    });
    if (existing) {
      throw new BadRequestException(
        `An override for "${dto.componentId}" already exists. Use PATCH to update it.`,
      );
    }

    const record = await this.prisma.componentOverride.create({
      data: {
        workspaceId,
        componentId: dto.componentId,
        sourceCode: dto.sourceCode,
        pinnedBaseVersion: meta.baseVersion,
        status: 'draft',
        createdByUserId: userId,
      },
    });

    await this.prisma.overrideAuditLog.create({
      data: {
        overrideId: record.id,
        workspaceId,
        componentId: dto.componentId,
        action: 'created',
        actorUserId: userId,
        sourceSnapshot: dto.sourceCode,
        newStatus: 'draft',
      },
    });

    return record;
  }

  async update(workspaceId: string, componentId: string, dto: UpdateOverrideDto, userId: string) {
    await this.assertAdminRole(workspaceId, userId);

    const record = await this.prisma.componentOverride.findUnique({
      where: { workspaceId_componentId: { workspaceId, componentId } },
    });
    if (!record) throw new NotFoundException(`No override for component "${componentId}".`);

    const updated = await this.prisma.componentOverride.update({
      where: { id: record.id },
      data: {
        ...(dto.sourceCode !== undefined
          ? { sourceCode: dto.sourceCode, compiledCode: null, status: 'draft', compileError: null }
          : {}),
      },
    });

    await this.prisma.overrideAuditLog.create({
      data: {
        overrideId: record.id,
        workspaceId,
        componentId,
        action: 'updated',
        actorUserId: userId,
        sourceSnapshot: dto.sourceCode ?? record.sourceCode,
        previousStatus: record.status as 'draft' | 'active' | 'error' | 'reverted',
        newStatus: updated.status as 'draft' | 'active' | 'error' | 'reverted',
      },
    });

    return updated;
  }

  async delete(workspaceId: string, componentId: string, userId: string): Promise<void> {
    const record = await this.getOne(workspaceId, componentId, userId);

    await this.prisma.overrideAuditLog.create({
      data: {
        overrideId: record.id,
        workspaceId,
        componentId,
        action: 'deleted',
        actorUserId: userId,
        sourceSnapshot: null,
        previousStatus: record.status,
        newStatus: record.status,
      },
    });

    await this.prisma.componentOverride.delete({ where: { id: record.id } });
  }

  // ---------------------------------------------------------------------------
  // Compile & activate
  // ---------------------------------------------------------------------------

  async compile(workspaceId: string, componentId: string, userId: string) {
    await this.assertAdminRole(workspaceId, userId);

    const record = await this.prisma.componentOverride.findUnique({
      where: { workspaceId_componentId: { workspaceId, componentId } },
    });
    if (!record) throw new NotFoundException(`No override for component "${componentId}".`);

    // Dynamically require esbuild to avoid hard dependency in test environments.

    const esbuild = await import('esbuild').catch(() => null);

    if (!esbuild) {
      throw new BadRequestException('esbuild is not available in this environment.');
    }

    let compiledCode: string;
    let newStatus: 'active' | 'error';
    let compileError: string | null = null;

    try {
      const result = await esbuild.transform(record.sourceCode, {
        loader: 'tsx',
        format: 'iife',
        globalName: `__override_${componentId}`,
        target: 'es2020',
        // JSX runtime: classic for sandbox compatibility
        jsx: 'transform',
        jsxFactory: 'React.createElement',
        jsxFragment: 'React.Fragment',
      });
      compiledCode = result.code;
      newStatus = 'active';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      compiledCode = '';
      newStatus = 'error';
      compileError = msg;
    }

    const updated = await this.prisma.componentOverride.update({
      where: { id: record.id },
      data: {
        compiledCode: newStatus === 'active' ? compiledCode : null,
        status: newStatus,
        compileError: newStatus === 'error' ? compileError : null,
      },
    });

    await this.prisma.overrideAuditLog.create({
      data: {
        overrideId: record.id,
        workspaceId,
        componentId,
        action: newStatus === 'active' ? 'activated' : 'updated',
        actorUserId: userId,
        sourceSnapshot: null,
        previousStatus: record.status as 'draft' | 'active' | 'error' | 'reverted',
        newStatus,
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Revert to base
  // ---------------------------------------------------------------------------

  async revert(workspaceId: string, componentId: string, userId: string) {
    await this.assertAdminRole(workspaceId, userId);

    const record = await this.prisma.componentOverride.findUnique({
      where: { workspaceId_componentId: { workspaceId, componentId } },
    });
    if (!record) throw new NotFoundException(`No override for component "${componentId}".`);

    const updated = await this.prisma.componentOverride.update({
      where: { id: record.id },
      data: { status: 'reverted', compiledCode: null, compileError: null },
    });

    await this.prisma.overrideAuditLog.create({
      data: {
        overrideId: record.id,
        workspaceId,
        componentId,
        action: 'reverted',
        actorUserId: userId,
        sourceSnapshot: null,
        previousStatus: record.status as 'draft' | 'active' | 'error' | 'reverted',
        newStatus: 'reverted',
      },
    });

    return updated;
  }

  // ---------------------------------------------------------------------------
  // Audit log
  // ---------------------------------------------------------------------------

  async getAuditLog(workspaceId: string, componentId: string, userId: string) {
    await this.assertAdminRole(workspaceId, userId);
    return this.prisma.overrideAuditLog.findMany({
      where: { workspaceId, componentId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  // ---------------------------------------------------------------------------
  // Registry (public endpoint — no admin role required)
  // ---------------------------------------------------------------------------

  async getRegistry() {
    const { getComponentRegistry } = await import('@notesaner/component-sdk');
    return getComponentRegistry();
  }
}
