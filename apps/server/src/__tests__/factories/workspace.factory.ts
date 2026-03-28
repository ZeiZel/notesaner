/**
 * Workspace factory for generating test fixtures.
 *
 * Usage:
 *   createWorkspace().build()                                // random workspace
 *   createWorkspace().public().build()                       // public vault
 *   createWorkspace().withName('My Vault').build()            // specific name
 *   createWorkspace().withSettings({ theme: 'dark' }).build() // custom settings
 *   createWorkspace().many(3)                                 // array of 3
 */

import { faker } from '@faker-js/faker';
import type { Prisma } from '@prisma/client';
import { FactoryBuilder, generateId, nextSequence } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceFixture {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  storagePath: string;
  isPublic: boolean;
  publicSlug: string | null;
  settings: Prisma.InputJsonValue;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Builder ────────────────────────────────────────────────────────────────

class WorkspaceBuilder extends FactoryBuilder<WorkspaceFixture> {
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withSlug(slug: string): this {
    this.data.slug = slug;
    return this;
  }

  withDescription(description: string | null): this {
    this.data.description = description;
    return this;
  }

  withStoragePath(path: string): this {
    this.data.storagePath = path;
    return this;
  }

  withSettings(settings: Prisma.InputJsonValue): this {
    this.data.settings = settings;
    return this;
  }

  /** Make workspace publicly accessible */
  public(): this {
    this.data.isPublic = true;
    this.data.publicSlug = this.data.slug;
    return this;
  }

  /** Make workspace private (default) */
  private(): this {
    this.data.isPublic = false;
    this.data.publicSlug = null;
    return this;
  }

  protected clone(): this {
    const seq = nextSequence();
    const slug = faker.helpers.slugify(`workspace-${seq}-${faker.word.adjective()}`).toLowerCase();
    return new WorkspaceBuilder({
      ...this.data,
      id: generateId(),
      slug,
      storagePath: `/var/lib/notesaner/workspaces/${slug}`,
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createWorkspace(overrides?: Partial<WorkspaceFixture>): WorkspaceBuilder {
  const seq = nextSequence();
  const slug = faker.helpers.slugify(`workspace-${seq}-${faker.word.adjective()}`).toLowerCase();
  const now = new Date();

  const defaults: WorkspaceFixture = {
    id: generateId(),
    name: faker.company.name() + ' Vault',
    slug,
    description: faker.lorem.sentence(),
    storagePath: `/var/lib/notesaner/workspaces/${slug}`,
    isPublic: false,
    publicSlug: null,
    settings: { defaultEditor: 'markdown' },
    createdAt: now,
    updatedAt: now,
  };

  const builder = new WorkspaceBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
