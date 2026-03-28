/**
 * WorkspaceMember factory for generating test fixtures.
 *
 * Usage:
 *   createWorkspaceMember().build()                             // random member
 *   createWorkspaceMember().inWorkspace('ws-id').build()         // specific workspace
 *   createWorkspaceMember().forUser('user-id').build()           // specific user
 *   createWorkspaceMember().owner().build()                      // OWNER role
 *   createWorkspaceMember().editor().build()                     // EDITOR role
 *   createWorkspaceMember().viewer().build()                     // VIEWER role
 *   createWorkspaceMember().many(5)                              // array of 5
 */

import { WorkspaceRole } from '@prisma/client';
import { FactoryBuilder, generateId, nextSequence } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WorkspaceMemberFixture {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
}

// ─── Builder ────────────────────────────────────────────────────────────────

class WorkspaceMemberBuilder extends FactoryBuilder<WorkspaceMemberFixture> {
  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  inWorkspace(workspaceId: string): this {
    this.data.workspaceId = workspaceId;
    return this;
  }

  forUser(userId: string): this {
    this.data.userId = userId;
    return this;
  }

  withRole(role: WorkspaceRole): this {
    this.data.role = role;
    return this;
  }

  owner(): this {
    this.data.role = WorkspaceRole.OWNER;
    return this;
  }

  admin(): this {
    this.data.role = WorkspaceRole.ADMIN;
    return this;
  }

  editor(): this {
    this.data.role = WorkspaceRole.EDITOR;
    return this;
  }

  viewer(): this {
    this.data.role = WorkspaceRole.VIEWER;
    return this;
  }

  withJoinedAt(date: Date): this {
    this.data.joinedAt = date;
    return this;
  }

  protected clone(): this {
    return new WorkspaceMemberBuilder({
      ...this.data,
      id: generateId(),
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

export function createWorkspaceMember(
  overrides?: Partial<WorkspaceMemberFixture>,
): WorkspaceMemberBuilder {
  nextSequence();

  const defaults: WorkspaceMemberFixture = {
    id: generateId(),
    workspaceId: generateId(),
    userId: generateId(),
    role: WorkspaceRole.EDITOR,
    joinedAt: new Date(),
  };

  const builder = new WorkspaceMemberBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
