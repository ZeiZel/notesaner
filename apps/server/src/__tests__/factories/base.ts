/**
 * Base factory builder pattern for generating test fixtures.
 *
 * Every factory returns a builder that supports method chaining:
 *   const user = createUser().withEmail('x@y.com').admin().build();
 *
 * Builders produce plain objects that match Prisma model shapes, suitable
 * for both unit tests (mock data) and integration tests (prisma.create).
 */

import { faker } from '@faker-js/faker';
import * as crypto from 'node:crypto';

// ─── ID Generation ──────────────────────────────────────────────────────────

let sequenceCounter = 0;

/**
 * Generates a deterministic UUID-v4-like string. Using faker.string.uuid()
 * by default, but allows override for reproducible test suites.
 */
export function generateId(): string {
  return faker.string.uuid();
}

/**
 * Returns a monotonically increasing integer, useful for unique suffixes
 * on emails, slugs, etc.
 */
export function nextSequence(): number {
  return ++sequenceCounter;
}

/**
 * Resets the global sequence counter. Call in `beforeEach` if tests rely
 * on deterministic sequence values.
 */
export function resetSequence(): void {
  sequenceCounter = 0;
}

// ─── Hashing Utilities ──────────────────────────────────────────────────────

/**
 * Synchronous SHA-256 hash for content hashes, token hashes, etc.
 */
export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Fake password hash that looks like the scrypt format used in the seed
 * system: `salt:derivedKey`. For unit tests, actual cryptographic
 * correctness is unnecessary.
 */
export function fakePasswordHash(password = 'Test123!'): string {
  const salt = crypto.randomBytes(8).toString('hex');
  return `${salt}:${sha256(password + salt)}`;
}

// ─── Builder Base ───────────────────────────────────────────────────────────

/**
 * Generic builder base class. Subclasses hold a mutable `data` record and
 * expose domain-specific setter methods that return `this` for chaining.
 *
 * Call `.build()` to get a frozen snapshot of the accumulated data, or
 * `.many(n)` to build an array of `n` instances with unique overrides.
 */
export abstract class FactoryBuilder<T extends object> {
  protected data: T;

  constructor(defaults: T) {
    // Shallow clone so each builder instance is independent
    this.data = { ...defaults };
  }

  /**
   * Generic setter: merge partial overrides into the builder state.
   */
  with(overrides: Partial<T>): this {
    Object.assign(this.data, overrides);
    return this;
  }

  /**
   * Return a frozen copy of the current state.
   */
  build(): Readonly<T> {
    return Object.freeze({ ...this.data });
  }

  /**
   * Build `count` instances, invoking the optional `customiser` before
   * each `.build()` so every item can have unique fields.
   *
   * Example:
   *   createUser().many(3, (b, i) => b.withEmail(`user${i}@test.com`))
   */
  many(
    count: number,
    customiser?: (builder: this, index: number) => this,
  ): ReadonlyArray<Readonly<T>> {
    const results: Array<Readonly<T>> = [];
    for (let i = 0; i < count; i++) {
      // Create a fresh builder from the current template
      const clone = this.clone();
      const finalised = customiser ? customiser(clone, i) : clone;
      results.push(finalised.build());
    }
    return results;
  }

  /**
   * Subclasses must implement cloning so `.many()` works correctly.
   */
  protected abstract clone(): this;
}
