# Database Migration Strategy & Zero-Downtime Upgrade Process

This document describes the Notesaner database migration strategy, tooling, and
operational procedures for safe, zero-downtime schema changes.

## Table of Contents

1. [Overview](#overview)
2. [Migration Lifecycle](#migration-lifecycle)
3. [Tooling](#tooling)
4. [Safe Migration Patterns](#safe-migration-patterns)
5. [Expand-Contract Pattern](#expand-contract-pattern)
6. [CI Pipeline Integration](#ci-pipeline-integration)
7. [Rollback Strategy](#rollback-strategy)
8. [Operational Runbook](#operational-runbook)
9. [Troubleshooting](#troubleshooting)

---

## Overview

Notesaner uses **Prisma Migrate** for schema management with additional safety
layers built on top:

| Component                     | Purpose                                                           |
| ----------------------------- | ----------------------------------------------------------------- |
| `prisma migrate dev`          | Development-time schema changes                                   |
| `prisma migrate deploy`       | Production/staging deployment                                     |
| `scripts/migrate-safe.ts`     | Safe migration runner with health checks, locking, and validation |
| `scripts/check-migrations.ts` | CI check for destructive operations                               |
| `migration-helper.ts`         | Utility library for health checks, locking, snapshots             |
| `migration-utils.ts`          | SQL generation helpers for common migration patterns              |

### Design Principles

1. **Zero downtime** — migrations must not take locks that block application queries
2. **Idempotent** — running the same migration twice must be safe
3. **Observable** — every migration emits logs, captures snapshots, and reports timing
4. **Reversible** — every destructive change has a documented rollback procedure
5. **Coordinated** — distributed lock prevents concurrent migration runs

---

## Migration Lifecycle

### Development Flow

```
1. Edit prisma/schema.prisma
2. Run: pnpm prisma-migrate (creates migration SQL)
3. Review generated migration.sql for destructive operations
4. If destructive: add expand-contract steps or approval marker
5. Commit schema.prisma + migration directory
6. CI runs check-migrations.ts automatically
```

### Deployment Flow

```
1. CI: check-migrations.ts validates all migrations
2. CD: migrate-safe.ts runs with the following steps:
   a. Pre-migration health check (PostgreSQL + ValKey)
   b. Acquire distributed migration lock via ValKey
   c. Capture pre-migration snapshot
   d. Scan for destructive operations
   e. Execute prisma migrate deploy
   f. Capture post-migration snapshot
   g. Run post-migration health check
   h. Release migration lock
```

---

## Tooling

### Safe Migration Runner

```bash
# Normal run (recommended for all environments)
npx ts-node scripts/migrate-safe.ts

# Preview what would happen without applying changes
npx ts-node scripts/migrate-safe.ts --dry-run

# Skip distributed lock (only if you are certain no other instance is migrating)
npx ts-node scripts/migrate-safe.ts --skip-lock

# Suppress destructive operation warnings (requires explicit justification)
npx ts-node scripts/migrate-safe.ts --force
```

**Exit codes:**

| Code | Meaning                                             |
| ---- | --------------------------------------------------- |
| 0    | Success or no pending migrations                    |
| 1    | Pre-flight check failed (DB/ValKey unhealthy)       |
| 2    | Lock acquisition failed (another migration running) |
| 3    | Migration execution failed                          |
| 4    | Post-migration validation failed                    |

### CI Migration Check

```bash
npx ts-node scripts/check-migrations.ts
```

Validates:

- All migration directories contain `migration.sql`
- Migration names follow the `NNNN_description` convention
- Destructive operations are explicitly approved with a comment marker

### Approving Destructive Operations

If a migration intentionally contains destructive operations (e.g., dropping an
unused column), add an approval marker comment to the migration SQL:

```sql
-- APPROVED_DESTRUCTIVE: Removing deprecated `legacy_role` column per ADR-015.
-- Data was migrated to `role` column in migration 0012.
ALTER TABLE "users" DROP COLUMN IF EXISTS "legacy_role";
```

---

## Safe Migration Patterns

### Adding a Column

Safe by default. New columns with `DEFAULT` values do not lock the table in PG 11+.

```sql
ALTER TABLE "notes" ADD COLUMN "priority" INTEGER DEFAULT 0;
```

### Adding a NOT NULL Column

**Two-step approach** to avoid locking:

```sql
-- Step 1: Add nullable column with default
ALTER TABLE "notes" ADD COLUMN "priority" INTEGER DEFAULT 0;

-- Step 2: Backfill existing rows (in batches if table is large)
UPDATE "notes" SET "priority" = 0 WHERE "priority" IS NULL;

-- Step 3: Set NOT NULL constraint
ALTER TABLE "notes" ALTER COLUMN "priority" SET NOT NULL;
```

### Adding an Index

Always use `CREATE INDEX CONCURRENTLY` to avoid table locks:

```sql
-- This does NOT lock the table for writes
CREATE INDEX CONCURRENTLY "idx_notes_priority" ON "notes" ("priority");
```

**Important:** `CONCURRENTLY` cannot run inside a transaction. Prisma `migrate deploy`
does not wrap individual migrations in transactions, so this works out of the box.

### Removing a Column

Use the expand-contract pattern (see next section) for columns still read by
running application instances. For truly unused columns:

```sql
-- APPROVED_DESTRUCTIVE: Column unused since v2.3, no application references.
ALTER TABLE "notes" DROP COLUMN IF EXISTS "deprecated_field";
```

### Renaming a Column

**Never** use `ALTER TABLE ... RENAME COLUMN` in production. This breaks all running
application instances that reference the old name. Use expand-contract instead.

---

## Expand-Contract Pattern

For changes that would break running application instances (renames, type changes),
use the three-phase expand-contract pattern:

### Phase 1: Expand (Migration)

Deploy a migration that adds the new column and sync trigger:

```sql
-- Add new column
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" VARCHAR(100);

-- Backfill from old column
UPDATE "users" SET "display_name" = "name" WHERE "display_name" IS NULL;

-- Sync trigger keeps both columns in sync during transition
CREATE OR REPLACE FUNCTION fn_sync_users_name_to_display_name()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."display_name" IS DISTINCT FROM NEW."name" THEN
    IF NEW."display_name" IS NOT NULL THEN
      NEW."name" := NEW."display_name";
    ELSE
      NEW."display_name" := NEW."name";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_users_name_to_display_name
  BEFORE INSERT OR UPDATE ON "users"
  FOR EACH ROW EXECUTE FUNCTION fn_sync_users_name_to_display_name();
```

### Phase 2: Deploy Application

Update application code to read/write the new column name. Both columns
remain valid during this phase due to the sync trigger.

### Phase 3: Contract (Migration)

After all application instances have been updated:

```sql
-- APPROVED_DESTRUCTIVE: Completing rename name->display_name (ADR-020)
DROP TRIGGER IF EXISTS trg_sync_users_name_to_display_name ON "users";
DROP FUNCTION IF EXISTS fn_sync_users_name_to_display_name();
ALTER TABLE "users" DROP COLUMN IF EXISTS "name";
```

The `migration-utils.ts` file provides `expandColumnRename()` and
`contractColumnRename()` helpers that generate this SQL automatically.

---

## CI Pipeline Integration

### GitHub Actions Integration

Add to your CI workflow:

```yaml
- name: Check database migrations
  run: |
    cd apps/server
    npx ts-node scripts/check-migrations.ts
```

### Pre-merge Checklist (Automated)

The CI check verifies:

| Check                         | Severity         |
| ----------------------------- | ---------------- |
| Migration files exist         | Error            |
| Naming convention followed    | Error            |
| No unapproved destructive ops | Error            |
| Approved destructive ops      | Warning (logged) |

---

## Rollback Strategy

### Prisma Limitations

Prisma Migrate does **not** support automatic rollbacks. The `_prisma_migrations`
table tracks applied migrations, and there is no built-in `migrate rollback` command.

### Manual Rollback Procedure

1. **Identify the failing migration** from the `post-failure` snapshot in
   `prisma/.migration-snapshots/`

2. **For additive changes** (new columns, indexes): write a new "undo" migration

   ```bash
   # Create a rollback migration
   prisma migrate dev --name rollback_0015_feature_x
   ```

3. **For destructive changes**: restore from the pre-migration database backup

   ```bash
   # Trigger a backup before migrating (built into migrate-safe.ts flow)
   # Restore from the latest backup
   pg_restore -d notesaner /var/lib/notesaner/backups/latest.dump
   ```

4. **Fix the `_prisma_migrations` table** if needed:
   ```sql
   -- Mark a failed migration as rolled back
   DELETE FROM _prisma_migrations
   WHERE migration_name = '0015_feature_x';
   ```

### Pre-Migration Backup

The safe migration runner captures snapshots automatically. For database-level
backups, integrate with the Notesaner backup module:

```bash
# Manual backup before migration
curl -X POST http://localhost:4000/api/v1/admin/backup/trigger?type=DATABASE
```

---

## Operational Runbook

### Before Migration

- [ ] Verify CI passed for the migration PR
- [ ] Run `migrate-safe.ts --dry-run` in staging first
- [ ] Check active connection count is nominal
- [ ] Ensure backup is recent (< 1 hour old)
- [ ] Notify team in Slack channel

### During Migration

- [ ] Monitor application logs for errors
- [ ] Watch database connection count (should not spike)
- [ ] Track migration duration against expectations

### After Migration

- [ ] Verify post-migration health check passed
- [ ] Check application functionality (smoke tests)
- [ ] Verify migration snapshot was saved
- [ ] Update the migration log in the team wiki

### Emergency: Migration Stuck

If the migration lock is stuck (process crashed without releasing):

```bash
# Check lock status
redis-cli GET notesaner:migration:lock

# Force-release the lock (ONLY if you are certain no migration is running)
redis-cli DEL notesaner:migration:lock
```

If a migration is stuck mid-execution:

```bash
# Check for active locks in PostgreSQL
SELECT pid, state, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active' AND query LIKE '%ALTER%' OR query LIKE '%CREATE%';

# Cancel a stuck query (graceful)
SELECT pg_cancel_backend(<pid>);

# Terminate a stuck query (forceful — last resort)
SELECT pg_terminate_backend(<pid>);
```

---

## Troubleshooting

### "Migration lock already held"

Another migration process is running. Wait for it to complete or check if it crashed:

```bash
redis-cli GET notesaner:migration:lock
# Shows the holder hostname:PID and timestamp
```

### "Pre-migration health check FAILED"

The database or ValKey is unreachable. Verify:

- PostgreSQL is running: `pg_isready`
- ValKey is running: `redis-cli ping`
- Connection strings in environment variables are correct

### "No new migrations were applied"

The `prisma migrate deploy` command ran but did not apply any migrations.
This can happen if:

- The `_prisma_migrations` table already contains the migration
- The migration was previously applied manually
- Check the Prisma output for details

### Invalid Indexes After Failed CONCURRENTLY

If `CREATE INDEX CONCURRENTLY` fails, it leaves an invalid index:

```sql
-- Find invalid indexes
SELECT indexrelid::regclass AS index_name,
       indrelid::regclass AS table_name
FROM pg_index
WHERE NOT indisvalid;

-- Drop and recreate
DROP INDEX CONCURRENTLY "idx_name";
CREATE INDEX CONCURRENTLY "idx_name" ON "table" ("column");
```
