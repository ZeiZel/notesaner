import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';
import { ValkeyService } from '../valkey/valkey.service';
import { renderToHtml } from '@notesaner/markdown';
import type { PublicVaultQueryDto } from './dto/public-vault-query.dto';
import type { ToggleVaultPublicDto } from './dto/toggle-vault-public.dto';
import { Prisma } from '@prisma/client';

// ─── Cache TTL constants ──────────────────────────────────────────────────────

/** 5 minutes in seconds — TTL for cached public vault/note data. */
const CACHE_TTL = 5 * 60;

// ─── Cache key helpers ────────────────────────────────────────────────────────

function vaultIndexKey(slug: string): string {
  return `pv:index:${slug}`;
}

function vaultNotesKey(slug: string, suffix: string): string {
  return `pv:notes:${slug}:${suffix}`;
}

function noteKey(slug: string, notePath: string): string {
  return `pv:note:${slug}:${notePath}`;
}

// ─── Response shapes ──────────────────────────────────────────────────────────

/**
 * The workspace public vault configuration state.
 */
export interface VaultPublicConfig {
  isPublic: boolean;
  publicSlug: string | null;
}

/**
 * Metadata about a public vault shown at the vault root.
 */
export interface VaultIndexResponse {
  slug: string;
  name: string;
  description: string | null;
  publishedNoteCount: number;
}

/**
 * A single item in the paginated published notes list.
 */
export interface PublishedNoteItem {
  id: string;
  path: string;
  title: string;
  updatedAt: string;
}

/**
 * Paginated response for published notes.
 */
export interface PaginatedPublishedNotes {
  items: PublishedNoteItem[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

/**
 * A fully rendered published note.
 */
export interface PublishedNoteResponse {
  id: string;
  path: string;
  title: string;
  html: string;
  updatedAt: string;
  frontmatter: Record<string, unknown>;
}

// ─── Sort field mapping ───────────────────────────────────────────────────────

const SORT_FIELD_MAP: Record<string, keyof Prisma.NoteOrderByWithRelationInput> = {
  path: 'path',
  title: 'title',
  updatedAt: 'updatedAt',
};

@Injectable()
export class PublicVaultService {
  private readonly logger = new Logger(PublicVaultService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
    private readonly valkeyService: ValkeyService,
  ) {}

  // ─── Vault configuration ──────────────────────────────────────────────────

  /**
   * Validate that the given publicSlug is not in use by another workspace.
   *
   * @throws ConflictException when the slug is taken by a different workspace.
   */
  async validateSlugUniqueness(slug: string, excludeWorkspaceId?: string): Promise<void> {
    const conflict = await this.prisma.workspace.findFirst({
      where: {
        publicSlug: slug,
        ...(excludeWorkspaceId ? { NOT: { id: excludeWorkspaceId } } : {}),
      },
      select: { id: true },
    });

    if (conflict) {
      throw new ConflictException(`Public slug "${slug}" is already in use`);
    }
  }

  /**
   * Toggle the public visibility of a workspace vault.
   *
   * When isPublic=true, publicSlug is required. When isPublic=false the vault
   * is taken offline; the publicSlug is preserved so re-enabling reuses the
   * same URL (unless explicitly overridden).
   *
   * @throws NotFoundException when the workspace does not exist.
   * @throws BadRequestException when isPublic=true without a publicSlug.
   * @throws ConflictException when the new publicSlug is already taken.
   */
  async toggleVaultPublic(
    workspaceId: string,
    dto: ToggleVaultPublicDto,
  ): Promise<VaultPublicConfig> {
    if (dto.isPublic && !dto.publicSlug) {
      throw new BadRequestException('publicSlug is required when isPublic is true');
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, publicSlug: true },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Validate slug uniqueness when a new slug is being set
    if (dto.publicSlug && dto.publicSlug !== workspace.publicSlug) {
      await this.validateSlugUniqueness(dto.publicSlug, workspaceId);
    }

    const updated = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        isPublic: dto.isPublic,
        ...(dto.publicSlug !== undefined && { publicSlug: dto.publicSlug }),
      },
      select: { isPublic: true, publicSlug: true },
    });

    // Invalidate cache for both old and new slugs
    const slugsToInvalidate = [workspace.publicSlug, updated.publicSlug].filter(
      (s): s is string => s !== null && s !== undefined,
    );
    await Promise.all(slugsToInvalidate.map((s) => this.invalidateCacheForSlug(s)));

    this.logger.log(`Workspace ${workspaceId} public toggle: isPublic=${dto.isPublic}`);

    return {
      isPublic: updated.isPublic,
      publicSlug: updated.publicSlug,
    };
  }

  // ─── Public vault reads (no auth required) ────────────────────────────────

  /**
   * Find a workspace by its publicSlug. Returns the workspace or throws.
   *
   * @throws NotFoundException when no public workspace matches the slug.
   */
  async findVaultBySlug(publicSlug: string) {
    const workspace = await this.prisma.workspace.findFirst({
      where: { publicSlug, isPublic: true },
      select: {
        id: true,
        name: true,
        slug: true,
        publicSlug: true,
        description: true,
        storagePath: true,
        isPublic: true,
        settings: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Public vault not found');
    }

    return workspace;
  }

  /**
   * Return the public vault index: name, description, and published note count.
   * Result is cached in ValKey for CACHE_TTL seconds.
   */
  async getVaultIndex(publicSlug: string): Promise<VaultIndexResponse> {
    const cacheKey = vaultIndexKey(publicSlug);
    const cached = await this.valkeyService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as VaultIndexResponse;
    }

    const workspace = await this.findVaultBySlug(publicSlug);

    const publishedNoteCount = await this.prisma.note.count({
      where: { workspaceId: workspace.id, isPublished: true, isTrashed: false },
    });

    const result: VaultIndexResponse = {
      slug: workspace.publicSlug ?? publicSlug,
      name: workspace.name,
      description: workspace.description,
      publishedNoteCount,
    };

    await this.valkeyService.set(cacheKey, JSON.stringify(result), CACHE_TTL);

    return result;
  }

  /**
   * Return a paginated list of published notes for a public vault.
   *
   * Pagination uses cursor-based strategy — the cursor is the `id` of the last
   * item on the previous page, which is stable across concurrent inserts.
   *
   * @param publicSlug — the vault's public slug
   * @param query — pagination/sort/filter params
   */
  async getPublishedNotes(
    publicSlug: string,
    query: PublicVaultQueryDto,
  ): Promise<PaginatedPublishedNotes> {
    const limit = query.limit ?? 20;
    const sortField = query.sortBy ?? 'path';
    const sortDir = query.sortDir ?? 'asc';

    // Build a cache-key suffix from the query params to cache page results
    const querySuffix = [query.cursor ?? '', limit, sortField, sortDir, query.folder ?? ''].join(
      ':',
    );
    const cacheKey = vaultNotesKey(publicSlug, querySuffix);
    const cached = await this.valkeyService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PaginatedPublishedNotes;
    }

    const workspace = await this.findVaultBySlug(publicSlug);

    // Count total published notes (for informational purposes; not affected by cursor)
    const total = await this.prisma.note.count({
      where: {
        workspaceId: workspace.id,
        isPublished: true,
        isTrashed: false,
        ...(query.folder ? { path: { startsWith: `${query.folder}/` } } : {}),
      },
    });

    const orderBy: Prisma.NoteOrderByWithRelationInput = {
      [SORT_FIELD_MAP[sortField] ?? 'path']: sortDir,
    };

    // Fetch one extra item to determine whether there is a next page
    const notes = await this.prisma.note.findMany({
      take: limit + 1,
      skip: query.cursor ? 1 : 0,
      cursor: query.cursor ? { id: query.cursor } : undefined,
      where: {
        workspaceId: workspace.id,
        isPublished: true,
        isTrashed: false,
        ...(query.folder ? { path: { startsWith: `${query.folder}/` } } : {}),
      },
      select: {
        id: true,
        path: true,
        title: true,
        updatedAt: true,
      },
      orderBy,
    });

    const hasMore = notes.length > limit;
    const items = hasMore ? notes.slice(0, limit) : notes;
    const nextCursor = hasMore ? items[items.length - 1].id : null;

    const result: PaginatedPublishedNotes = {
      items: items.map((n) => ({
        id: n.id,
        path: n.path,
        title: n.title,
        updatedAt: n.updatedAt.toISOString(),
      })),
      nextCursor,
      hasMore,
      total,
    };

    await this.valkeyService.set(cacheKey, JSON.stringify(result), CACHE_TTL);

    return result;
  }

  /**
   * Fetch and render a single published note as HTML.
   *
   * Notes that are unpublished or trashed are not accessible.
   * The notePath may omit the `.md` extension — it will be inferred.
   *
   * @throws NotFoundException when the vault does not exist or the note is not published.
   */
  async getPublishedNote(publicSlug: string, notePath: string): Promise<PublishedNoteResponse> {
    // Normalise path — ensure .md extension for lookup
    const lookupPath = notePath.endsWith('.md') ? notePath : `${notePath}.md`;

    const cacheKey = noteKey(publicSlug, lookupPath);
    const cached = await this.valkeyService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PublishedNoteResponse;
    }

    const workspace = await this.findVaultBySlug(publicSlug);

    const note = await this.prisma.note.findFirst({
      where: {
        workspaceId: workspace.id,
        path: lookupPath,
        isPublished: true,
        isTrashed: false,
      },
    });

    if (!note) {
      throw new NotFoundException('Published note not found');
    }

    const markdownContent = await this.filesService.readFile(workspace.id, note.path);

    const html = await renderToHtml(markdownContent, {
      wikiLinks: true,
      wikiLinkBase: `/p/${publicSlug}/`,
    });

    const result: PublishedNoteResponse = {
      id: note.id,
      path: note.path,
      title: note.title,
      html,
      updatedAt: note.updatedAt.toISOString(),
      frontmatter: (note.frontmatter ?? {}) as Record<string, unknown>,
    };

    await this.valkeyService.set(cacheKey, JSON.stringify(result), CACHE_TTL);

    return result;
  }

  // ─── Cache management ─────────────────────────────────────────────────────

  /**
   * Invalidate all cached entries for a workspace identified by workspaceId.
   * Used when note publish state changes.
   */
  async invalidateCacheForWorkspace(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { publicSlug: true },
    });

    if (workspace?.publicSlug) {
      await this.invalidateCacheForSlug(workspace.publicSlug);
    }
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async invalidateCacheForSlug(publicSlug: string): Promise<void> {
    const staticKeys = [vaultIndexKey(publicSlug)];

    // Scan for paginated note list keys and individual note keys
    const patterns = [vaultNotesKey(publicSlug, '*'), noteKey(publicSlug, '*')];

    const keysToDelete = [...staticKeys];

    try {
      const client = this.valkeyService.getClient();

      for (const pattern of patterns) {
        let cursor = '0';
        do {
          const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
          cursor = nextCursor;
          if (keys.length > 0) {
            keysToDelete.push(...keys);
          }
        } while (cursor !== '0');
      }
    } catch (err) {
      this.logger.warn(`Cache scan failed for slug "${publicSlug}": ${err}`);
    }

    if (keysToDelete.length > 0) {
      await this.valkeyService.del(...keysToDelete);
    }

    this.logger.debug(`Invalidated ${keysToDelete.length} cache key(s) for slug "${publicSlug}"`);
  }
}
