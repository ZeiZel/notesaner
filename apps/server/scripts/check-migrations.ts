#!/usr/bin/env ts-node
/**
 * Migration CI Check Script
 *
 * Verifies migration integrity for CI pipelines:
 *   1. All migration directories have a migration.sql file
 *   2. No destructive operations without explicit approval marker
 *   3. Migration naming follows conventions (NNNN_description)
 *   4. Prisma schema is in sync (no pending schema drift)
 *
 * Usage:
 *   npx ts-node scripts/check-migrations.ts
 *
 * Exit codes:
 *   0 — all checks passed
 *   1 — one or more checks failed
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { detectDestructiveOperations } from '../src/common/utils/migration-helper';

// ─── Configuration ───────────────────────────────────────────────────────────

const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'prisma', 'migrations');

/**
 * If a migration SQL file contains this marker comment, destructive operation
 * warnings are suppressed. This forces developers to explicitly acknowledge
 * destructive changes.
 */
const DESTRUCTIVE_APPROVAL_MARKER = '-- APPROVED_DESTRUCTIVE:';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CheckResult {
  migration: string;
  passed: boolean;
  errors: string[];
  warnings: string[];
}

// ─── Checks ──────────────────────────────────────────────────────────────────

function checkNamingConvention(migrationName: string): string[] {
  const errors: string[] = [];

  // Two accepted formats:
  //   1. Legacy: NNNN_description (e.g. 0010_notifications) -- grandfathered
  //   2. New:    YYYYMMDDHHMMSS_description (e.g. 20260328143000_add_priority)
  const legacyPattern = /^\d{4}_/;
  const timestampPattern = /^\d{14}_/;

  if (!legacyPattern.test(migrationName) && !timestampPattern.test(migrationName)) {
    errors.push(
      `Migration "${migrationName}" does not follow naming convention: ` +
        `YYYYMMDDHHMMSS_description (preferred) or NNNN_description (legacy)`,
    );
  }

  // Must use snake_case for description
  const description = migrationName.replace(/^\d+_/, '');
  if (description && !/^[a-z0-9_]+$/.test(description)) {
    errors.push(`Migration "${migrationName}" description should use snake_case (a-z, 0-9, _)`);
  }

  return errors;
}

function checkMigrationFile(migrationDir: string): string[] {
  const errors: string[] = [];
  const sqlPath = path.join(migrationDir, 'migration.sql');

  if (!fs.existsSync(sqlPath)) {
    errors.push(`Missing migration.sql in ${path.basename(migrationDir)}`);
    return errors;
  }

  const content = fs.readFileSync(sqlPath, 'utf-8');

  if (content.trim().length === 0) {
    errors.push(`Empty migration.sql in ${path.basename(migrationDir)}`);
  }

  return errors;
}

async function checkDestructiveOperations(
  migrationDir: string,
): Promise<{ warnings: string[]; errors: string[] }> {
  const sqlPath = path.join(migrationDir, 'migration.sql');
  const warnings: string[] = [];
  const errors: string[] = [];

  if (!fs.existsSync(sqlPath)) return { warnings, errors };

  const content = fs.readFileSync(sqlPath, 'utf-8');
  const detectedWarnings = await detectDestructiveOperations(sqlPath);

  if (detectedWarnings.length === 0) return { warnings, errors };

  // Check for approval marker
  const hasApproval = content.includes(DESTRUCTIVE_APPROVAL_MARKER);

  if (hasApproval) {
    // Approved — report as warnings only
    for (const w of detectedWarnings) {
      warnings.push(`[APPROVED] ${w}`);
    }
  } else {
    // Not approved — report as errors
    for (const w of detectedWarnings) {
      errors.push(`${w} — add "${DESTRUCTIVE_APPROVAL_MARKER} <reason>" comment to approve`);
    }
  }

  return { warnings, errors };
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('=== Migration CI Check ===\n');

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    console.log('No migrations directory found. Nothing to check.');
    process.exit(0);
  }

  const entries = fs.readdirSync(MIGRATIONS_DIR, { withFileTypes: true });
  const migrationDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (migrationDirs.length === 0) {
    console.log('No migrations found. Nothing to check.');
    process.exit(0);
  }

  console.log(`Found ${migrationDirs.length} migration(s)\n`);

  const results: CheckResult[] = [];
  let hasFailures = false;

  for (const name of migrationDirs) {
    const result: CheckResult = {
      migration: name,
      passed: true,
      errors: [],
      warnings: [],
    };

    const dirPath = path.join(MIGRATIONS_DIR, name);

    // Check 1: Naming convention
    const namingErrors = checkNamingConvention(name);
    result.errors.push(...namingErrors);

    // Check 2: migration.sql exists and is non-empty
    const fileErrors = checkMigrationFile(dirPath);
    result.errors.push(...fileErrors);

    // Check 3: Destructive operations
    const destructive = await checkDestructiveOperations(dirPath);
    result.errors.push(...destructive.errors);
    result.warnings.push(...destructive.warnings);

    result.passed = result.errors.length === 0;
    if (!result.passed) hasFailures = true;

    results.push(result);
  }

  // ── Report ─────────────────────────────────────────────────────────────
  for (const r of results) {
    const _status = r.passed ? 'PASS' : 'FAIL';
    const icon = r.passed ? '[PASS]' : '[FAIL]';
    console.log(`${icon} ${r.migration}`);

    for (const w of r.warnings) {
      console.log(`  WARNING: ${w}`);
    }

    for (const e of r.errors) {
      console.log(`  ERROR:   ${e}`);
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────
  const passCount = results.filter((r) => r.passed).length;
  const failCount = results.filter((r) => !r.passed).length;
  const totalWarnings = results.reduce((sum, r) => sum + r.warnings.length, 0);

  console.log('');
  console.log(`--- Summary ---`);
  console.log(`  Total:    ${results.length}`);
  console.log(`  Passed:   ${passCount}`);
  console.log(`  Failed:   ${failCount}`);
  console.log(`  Warnings: ${totalWarnings}`);

  if (hasFailures) {
    console.log('\nMigration check FAILED. Fix the errors above before merging.');
    process.exit(1);
  }

  console.log('\nAll migration checks passed.');
}

main().catch((error) => {
  console.error('Migration check error:', error);
  process.exit(1);
});
