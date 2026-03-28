import { type Prisma } from '@prisma/client';
import * as crypto from 'node:crypto';

// ─── Password Hashing ────────────────────────────────────────────────────────
// Using Node.js built-in scrypt for seed passwords so we avoid importing
// the application's auth utils (which may depend on NestJS DI context).

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

// ─── Deterministic IDs ───────────────────────────────────────────────────────
// Stable UUIDs allow idempotent upserts across repeated seed runs.

export const USER_IDS = {
  admin: '00000000-0000-4000-a000-000000000001',
  alice: '00000000-0000-4000-a000-000000000002',
  bob: '00000000-0000-4000-a000-000000000003',
  guest: '00000000-0000-4000-a000-000000000004',
} as const;

export type SeedUserId = (typeof USER_IDS)[keyof typeof USER_IDS];

// ─── Fixture Builder ─────────────────────────────────────────────────────────

export interface SeedUser {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isSuperAdmin: boolean;
  avatarUrl: string | null;
}

/**
 * Builds the deterministic seed users.
 *
 * We hash passwords lazily so the function stays async-safe.
 * All users in dev use the password `Notesaner123!` for convenience.
 *
 * For staging, passwords are randomised and printed to stdout so they
 * can be captured from CI logs (or overridden by env).
 */
export async function buildUsers(env: 'development' | 'staging'): Promise<SeedUser[]> {
  const devPassword = 'Notesaner123!';

  const passwordFor = async (label: string): Promise<string> => {
    if (env === 'development') {
      return hashPassword(devPassword);
    }
    // Staging: generate a random password and log it
    const random = crypto.randomBytes(16).toString('base64url');
    console.log(`  [staging] ${label} password: ${random}`);
    return hashPassword(random);
  };

  return [
    {
      id: USER_IDS.admin,
      email: 'admin@notesaner.local',
      displayName: 'Admin User',
      passwordHash: await passwordFor('admin'),
      isActive: true,
      isEmailVerified: true,
      isSuperAdmin: true,
      avatarUrl: null,
    },
    {
      id: USER_IDS.alice,
      email: 'alice@notesaner.local',
      displayName: 'Alice Developer',
      passwordHash: await passwordFor('alice'),
      isActive: true,
      isEmailVerified: true,
      isSuperAdmin: false,
      avatarUrl: null,
    },
    {
      id: USER_IDS.bob,
      email: 'bob@notesaner.local',
      displayName: 'Bob Editor',
      passwordHash: await passwordFor('bob'),
      isActive: true,
      isEmailVerified: true,
      isSuperAdmin: false,
      avatarUrl: null,
    },
    {
      id: USER_IDS.guest,
      email: 'guest@notesaner.local',
      displayName: 'Guest Viewer',
      passwordHash: await passwordFor('guest'),
      isActive: true,
      isEmailVerified: false,
      isSuperAdmin: false,
      avatarUrl: null,
    },
  ];
}

/**
 * Returns Prisma upsert args for each seed user.
 */
export async function getUserUpserts(
  env: 'development' | 'staging',
): Promise<Prisma.UserUpsertArgs[]> {
  const users = await buildUsers(env);

  return users.map((u) => ({
    where: { id: u.id },
    update: {
      email: u.email,
      displayName: u.displayName,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      isSuperAdmin: u.isSuperAdmin,
      avatarUrl: u.avatarUrl,
    },
    create: {
      id: u.id,
      email: u.email,
      displayName: u.displayName,
      passwordHash: u.passwordHash,
      isActive: u.isActive,
      isEmailVerified: u.isEmailVerified,
      isSuperAdmin: u.isSuperAdmin,
      avatarUrl: u.avatarUrl,
    },
  }));
}
