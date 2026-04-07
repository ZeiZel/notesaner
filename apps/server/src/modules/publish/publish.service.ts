import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicVaultService } from './public-vault.service';
import { ValkeyService } from '../valkey/valkey.service';

/**
 * PublishService -- manages individual note publish state and rendering.
 *
 * Responsibilities:
 *   - Toggle note published state (PATCH /workspaces/:id/notes/:noteId/publish)
 *   - Render note content to HTML for public consumption
 *   - Generate vault navigation from folder structure
 *   - Invalidate cache on publish state changes
 *   - Render vault index page data
 *   - Provide graph data for published notes (link graph)
 */
@Injectable()
export class PublishService {
  private readonly logger = new Logger(PublishService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicVaultService: PublicVaultService,
    private readonly valkeyService: ValkeyService,
  ) {}

  // ─── Note publish toggle ────────────────────────────────────────────────────

  /**
   * Toggle the published state of a note.
   * When published, the note becomes accessible via the public vault URL.
   *
   * @param workspaceId - The workspace UUID
   * @param noteId - The note UUID
   * @returns The updated note with isPublished state
   * @throws NotFoundException if the note is not found in the workspace
   */
  async publishNote(workspaceId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId, isTrashed: false },
      select: { id: true, isPublished: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isPublished: true },
    });

    // Invalidate the public vault cache so the new note appears
    await this.publicVaultService.invalidateCacheForWorkspace(workspaceId);

    this.logger.log(`Published note ${noteId} in workspace ${workspaceId}`);
  }

  /**
   * Unpublish a note, removing it from public access.
   *
   * @param workspaceId - The workspace UUID
   * @param noteId - The note UUID
   * @throws NotFoundException if the note is not found in the workspace
   */
  async unpublishNote(workspaceId: string, noteId: string): Promise<void> {
    const note = await this.prisma.note.findFirst({
      where: { id: noteId, workspaceId },
      select: { id: true, isPublished: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    await this.prisma.note.update({
      where: { id: noteId },
      data: { isPublished: false },
    });

    await this.publicVaultService.invalidateCacheForWorkspace(workspaceId);

    this.logger.log(`Unpublished note ${noteId} in workspace ${workspaceId}`);
  }

  // ─── Public vault configuration ─────────────────────────────────────────────

  /**
   * Configure workspace as a public vault.
   * Delegates to PublicVaultService.toggleVaultPublic.
   */
  async setPublicVault(
    workspaceId: string,
    config: { isPublic: boolean; publicSlug?: string; customDomain?: string },
  ) {
    const result = await this.publicVaultService.toggleVaultPublic(workspaceId, {
      isPublic: config.isPublic,
      publicSlug: config.publicSlug,
    });

    // Store custom domain in workspace settings JSON if provided
    if (config.customDomain !== undefined) {
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { settings: true },
      });

      const settings =
        workspace?.settings && typeof workspace.settings === 'object'
          ? (workspace.settings as Record<string, unknown>)
          : {};

      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          settings: { ...settings, customDomain: config.customDomain },
        },
      });
    }

    return result;
  }

  /**
   * Get the public vault configuration for a workspace.
   */
  async getPublicVaultConfig(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        isPublic: true,
        publicSlug: true,
        settings: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    const settings =
      workspace.settings && typeof workspace.settings === 'object'
        ? (workspace.settings as Record<string, unknown>)
        : {};

    return {
      isPublic: workspace.isPublic,
      publicSlug: workspace.publicSlug,
      customDomain: (settings['customDomain'] as string) ?? null,
    };
  }

  // ─── Public navigation ──────────────────────────────────────────────────────

  /**
   * Generate navigation structure from the published notes in a vault.
   * Returns a tree-like array representing the folder hierarchy.
   */
  async getPublicNavigation(publicSlug: string): Promise<unknown[]> {
    const workspace = await this.publicVaultService.findVaultBySlug(publicSlug);

    const notes = await this.prisma.note.findMany({
      where: {
        workspaceId: workspace.id,
        isPublished: true,
        isTrashed: false,
      },
      select: {
        id: true,
        path: true,
        title: true,
      },
      orderBy: { path: 'asc' },
    });

    // Build a tree structure from flat paths
    interface NavNode {
      type: 'folder' | 'note';
      name: string;
      path: string;
      title?: string;
      noteId?: string;
      children?: NavNode[];
    }

    const root: NavNode[] = [];

    for (const note of notes) {
      const parts = note.path.replace(/\.md$/, '').split('/');
      let currentLevel = root;

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;

        if (isLast) {
          // This is the note itself
          currentLevel.push({
            type: 'note',
            name: part,
            path: note.path.replace(/\.md$/, ''),
            title: note.title,
            noteId: note.id,
          });
        } else {
          // This is a folder — find or create it
          let folder = currentLevel.find((n) => n.type === 'folder' && n.name === part);
          if (!folder) {
            folder = {
              type: 'folder',
              name: part,
              path: parts.slice(0, i + 1).join('/'),
              children: [],
            };
            currentLevel.push(folder);
          }
          currentLevel = folder.children ?? [];
        }
      }
    }

    return root;
  }

  // ─── Cache invalidation ─────────────────────────────────────────────────────

  /**
   * Invalidate all cached data for a workspace's public vault.
   */
  async invalidateCache(workspaceId: string): Promise<void> {
    await this.publicVaultService.invalidateCacheForWorkspace(workspaceId);
    this.logger.log(`Invalidated public vault cache for workspace ${workspaceId}`);
  }

  // ─── Note rendering ─────────────────────────────────────────────────────────

  /**
   * Render a published note to HTML.
   * Delegates to PublicVaultService.getPublishedNote for cached rendering.
   */
  async renderNote(publicSlug: string, notePath: string) {
    return this.publicVaultService.getPublishedNote(publicSlug, notePath);
  }

  /**
   * Render the vault index page data.
   * Delegates to PublicVaultService.getVaultIndex.
   */
  async renderVaultIndex(publicSlug: string) {
    return this.publicVaultService.getVaultIndex(publicSlug);
  }

  // ─── Graph data ─────────────────────────────────────────────────────────────

  /**
   * Get the link graph for all published notes in a vault.
   * Returns nodes (notes) and edges (links between them).
   */
  async getGraphData(publicSlug: string) {
    const workspace = await this.publicVaultService.findVaultBySlug(publicSlug);

    const cacheKey = `pv:graph:${publicSlug}`;
    const cached = await this.valkeyService.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const notes = await this.prisma.note.findMany({
      where: {
        workspaceId: workspace.id,
        isPublished: true,
        isTrashed: false,
      },
      select: {
        id: true,
        path: true,
        title: true,
        outgoingLinks: {
          select: {
            targetNoteId: true,
            targetNote: {
              select: { id: true, isPublished: true, isTrashed: true },
            },
          },
        },
      },
    });

    const publishedNoteIds = new Set(notes.map((n) => n.id));

    const nodes = notes.map((n) => ({
      id: n.id,
      path: n.path.replace(/\.md$/, ''),
      title: n.title,
    }));

    const edges: Array<{ source: string; target: string }> = [];
    for (const note of notes) {
      for (const link of note.outgoingLinks) {
        // Only include edges where the target is also published
        if (
          publishedNoteIds.has(link.targetNoteId) &&
          link.targetNote.isPublished &&
          !link.targetNote.isTrashed
        ) {
          edges.push({ source: note.id, target: link.targetNoteId });
        }
      }
    }

    const result = { nodes, edges };

    await this.valkeyService.set(cacheKey, JSON.stringify(result), 5 * 60);

    return result;
  }
}
