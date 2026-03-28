/**
 * Tag factory for generating test fixtures.
 *
 * Usage:
 *   createTag().build()                               // random tag
 *   createTag().withName('project').build()             // specific name
 *   createTag().inWorkspace('ws-id').build()            // specific workspace
 *   createTag().withColor('#ef4444').build()            // custom color
 *   createTag().withNoteCount(5).build()                // denormalized count
 *   createTag().many(4)                                 // array of 4 tags
 */

import { faker } from '@faker-js/faker';
import { FactoryBuilder, generateId, nextSequence } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TagFixture {
  id: string;
  workspaceId: string;
  name: string;
  color: string | null;
  noteCount: number;
}

// ─── Preset Tag Names ───────────────────────────────────────────────────────

const TAG_PRESETS = {
  project: { name: 'project', color: '#3b82f6' },
  idea: { name: 'idea', color: '#f59e0b' },
  todo: { name: 'todo', color: '#ef4444' },
  reference: { name: 'reference', color: '#8b5cf6' },
  daily: { name: 'daily', color: '#10b981' },
  research: { name: 'research', color: '#06b6d4' },
  archived: { name: 'archived', color: '#6b7280' },
  published: { name: 'published', color: '#22c55e' },
} as const;

export type PresetTagName = keyof typeof TAG_PRESETS;

// ─── Builder ────────────────────────────────────────────────────────────────

class TagBuilder extends FactoryBuilder<TagFixture> {
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  inWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  withName(name: string): this {
    this.data.name = name;
    return this;
  }

  withColor(color: string | null): this {
    this.data.color = color;
    return this;
  }

  withNoteCount(count: number): this {
    this.data.noteCount = count;
    return this;
  }

  /**
   * Apply a preset tag configuration (name + color).
   *
   * Example: createTag().preset('project').build()
   */
  preset(tagName: PresetTagName): this {
    const preset = TAG_PRESETS[tagName];
    this.data.name = preset.name;
    this.data.color = preset.color;
    return this;
  }

  protected clone(): this {
    const seq = nextSequence();
    return new TagBuilder({
      ...this.data,
      id: generateId(),
      name: faker.helpers.slugify(faker.word.noun()).toLowerCase() + `-${seq}`,
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createTag(overrides?: Partial<TagFixture>): TagBuilder {
  const seq = nextSequence();

  const defaults: TagFixture = {
    id: generateId(),
    workspaceId: generateId(),
    name: faker.helpers.slugify(faker.word.noun()).toLowerCase() + `-${seq}`,
    color: faker.color.rgb(),
    noteCount: 0,
  };

  const builder = new TagBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}

/**
 * Convenience: create the four canonical seed tags in a single call.
 *
 * @param workspaceId - Workspace to attach all tags to
 * @returns Object with `project`, `idea`, `todo`, `reference` tag fixtures
 */
export function createSeedTags(workspaceId: string): Record<PresetTagName, Readonly<TagFixture>> {
  const presetNames: PresetTagName[] = ['project', 'idea', 'todo', 'reference'];

  const result: Partial<Record<PresetTagName, Readonly<TagFixture>>> = {};
  for (const name of presetNames) {
    result[name] = createTag().inWorkspace(workspaceId).preset(name).build();
  }

  return result as Record<PresetTagName, Readonly<TagFixture>>;
}
