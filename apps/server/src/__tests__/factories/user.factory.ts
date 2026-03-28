/**
 * User factory for generating test fixtures.
 *
 * Usage:
 *   createUser().build()                          // random user
 *   createUser().admin().verified().build()        // super admin
 *   createUser().withEmail('x@y.com').build()      // specific email
 *   createUser().inactive().build()                // deactivated user
 *   createUser().ssoOnly().build()                 // no password hash
 *   createUser().many(5)                           // array of 5 users
 */

import { faker } from '@faker-js/faker';
import { FactoryBuilder, generateId, nextSequence, fakePasswordHash } from './base';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UserFixture {
  id: string;
  email: string;
  passwordHash: string | null;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isEmailVerified: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Builder ────────────────────────────────────────────────────────────────

class UserBuilder extends FactoryBuilder<UserFixture> {
  // ── Convenience setters ─────────────────────────────────────────────────

  withId(id: string): this {
    this.data.id = id;
    return this;
  }

  withEmail(email: string): this {
    this.data.email = email;
    return this;
  }

  withDisplayName(name: string): this {
    this.data.displayName = name;
    return this;
  }

  withPassword(password: string): this {
    this.data.passwordHash = fakePasswordHash(password);
    return this;
  }

  withAvatar(url: string): this {
    this.data.avatarUrl = url;
    return this;
  }

  /** Mark user as super admin + verified */
  admin(): this {
    this.data.isSuperAdmin = true;
    this.data.isEmailVerified = true;
    return this;
  }

  /** Mark email as verified */
  verified(): this {
    this.data.isEmailVerified = true;
    return this;
  }

  /** Mark email as unverified */
  unverified(): this {
    this.data.isEmailVerified = false;
    return this;
  }

  /** Deactivate user */
  inactive(): this {
    this.data.isActive = false;
    return this;
  }

  /** SSO-only user (no local password) */
  ssoOnly(): this {
    this.data.passwordHash = null;
    return this;
  }

  withCreatedAt(date: Date): this {
    this.data.createdAt = date;
    return this;
  }

  protected clone(): this {
    const seq = nextSequence();
    return new UserBuilder({
      ...this.data,
      id: generateId(),
      email: faker.internet.email({ firstName: `user${seq}` }).toLowerCase(),
    }) as this;
  }
}

// ─── Factory Function ───────────────────────────────────────────────────────

/**
 * Creates a new UserBuilder pre-populated with realistic faker data.
 *
 * @param overrides - Partial fields to set immediately
 */
export function createUser(overrides?: Partial<UserFixture>): UserBuilder {
  const seq = nextSequence();
  const now = new Date();

  const defaults: UserFixture = {
    id: generateId(),
    email: faker.internet.email({ firstName: `user${seq}` }).toLowerCase(),
    passwordHash: fakePasswordHash(),
    displayName: faker.person.fullName(),
    avatarUrl: null,
    isActive: true,
    isEmailVerified: true,
    isSuperAdmin: false,
    createdAt: now,
    updatedAt: now,
  };

  const builder = new UserBuilder(defaults);
  if (overrides) {
    builder.with(overrides);
  }
  return builder;
}
