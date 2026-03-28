# Database Migration Strategy & Zero-Downtime Upgrade Process

Complete reference for Notesaner database migrations: strategy, tooling,
CI integration, Docker deployment, rollback procedures, and operational runbooks.

## Table of Contents

1. [Overview](#overview)
2. [Migration Lifecycle](#migration-lifecycle)
3. [Naming Convention](#naming-convention)
4. [Tooling Reference](#tooling-reference)
5. [Safe Migration Patterns](#safe-migration-patterns)
6. [Expand-Contract Pattern](#expand-contract-pattern)
7. [CI Pipeline Integration](#ci-pipeline-integration)
8. [Docker Deployment](#docker-deployment)
9. [Backwards-Compatible Migration Strategy](#backwards-compatible-migration-strategy)
10. [Pre-Migration Backup](#pre-migration-backup)
11. [Rollback Strategy](#rollback-strategy)
12. [Seed Data Management](#seed-data-management)
13. [Migration Lock Mechanism](#migration-lock-mechanism)
14. [Operational Runbook](#operational-runbook)
15. [Troubleshooting](#troubleshooting)

---

## Overview

Notesaner uses **Prisma Migrate** for schema management with additional safety
layers for zero-downtime production deployments.

| Component                     | Path                                               | Purpose                                     |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------- |
| `prisma migrate dev`          | (CLI)                                              | Development-time schema changes             |
| `prisma migrate deploy`       | (CLI)                                              | Production/staging deployment (never `dev`) |
| `scripts/migrate.sh`          | `apps/server/scripts/migrate.sh`                   | Shell wrapper: backup + migrate + validate  |
| `scripts/migrate-safe.ts`     | `apps/server/scripts/migrate-safe.ts`              | TypeScript runner: health checks + locking  |
| `scripts/rollback.sh`         | `apps/server/scripts/rollback.sh`                  | Guided rollback procedures                  |
| `scripts/check-migrations.ts` | `apps/server/scripts/check-migrations.ts`          | CI: naming, destructive ops, file integrity |
| `migration-helper.ts`         | `apps/server/src/common/utils/migration-helper.ts` | Library: health, locking, snapshots         |
| `migration-utils.ts`          | `apps/server/prisma/migrations/migration-utils.ts` | SQL generators: expand-contract, backfill   |
| `entrypoint.sh`               | `docker/entrypoint.sh`                             | Docker: auto-migrate on container start     |
| `migration-check.yml`         | `.github/workflows/migration-check.yml`            | CI: drift detection + test DB validation    |

### Design Principles

1. **Zero downtime** -- migrations must not take locks that block application queries
2. **Production safety** -- always use `prisma migrate deploy`, never `prisma migrate dev`
3. **Idempotent** -- running the same migration twice must be safe
4. **Observable** -- every migration emits logs, captures snapshots, and reports timing
5. **Reversible** -- every destructive change has a documented rollback procedure
6. **Coordinated** -- distributed lock prevents concurrent migration runs
7. **Backwards-compatible** -- old application code works with new schema during deployment

---

## Migration Lifecycle

### Development Flow

```
1. Edit prisma/schema.prisma
2. Run: pnpm prisma-migrate (creates migration SQL in YYYYMMDDHHMMSS_name format)
3. Review generated migration.sql for destructive operations
4. If destructive: add expand-contract steps or approval marker
5. Commit schema.prisma + migration directory
6. CI runs migration-check.yml automatically:
   a. Static checks (naming, destructive ops, file integrity)
   b. Schema drift detection (prisma migrate diff --exit-code)
   c. Full migration test against fresh PostgreSQL 17
```

### Deployment Flow

```
1. Docker container starts with entrypoint.sh:
   a. Wait for PostgreSQL to be ready
   b. Run prisma migrate deploy (with built-in advisory lock)
   c. Start NestJS application

2. For non-Docker deployments, use migrate.sh:
   a. Pre-migration health check (PostgreSQL + ValKey)
   b. Trigger pre-migration backup via backup API
   c. Acquire distributed migration lock via ValKey
   d. Capture pre-migration snapshot
   e. Scan for destructive operations
   f. Execute prisma migrate deploy
   g. Capture post-migration snapshot
   h. Run post-migration health check
   i. Release migration lock
```

---

## Naming Convention

Migration directories **MUST** follow this pattern:

```
YYYYMMDDHHMMSS_descriptive_name
```

Examples:

```
20260328143000_add_user_preferences
20260401091500_add_note_tags_index
20260415120000_typed_links
```

For Prisma-generated migrations, the `--name` flag determines the suffix:

```bash
# Creates: prisma/migrations/20260328143000_add_priority_column/migration.sql
pnpm prisma migrate dev --name add_priority_column
```

Rules:

- Timestamp prefix is auto-generated by Prisma
- Description uses `snake_case` (lowercase, underscores only)
- Description should be concise but meaningful
- CI (`check-migrations.ts`) validates naming automatically

**Legacy format**: Existing migrations use `NNNN_description` (e.g., `0010_notifications`).
These are grandfathered in. All new migrations use the timestamp format.

---

## Tooling Reference

### migrate.sh (Production Shell Wrapper)

The primary migration tool for production and staging environments.

```bash
# Full migration with pre-migration backup
./scripts/migrate.sh

# Preview what would change (no modifications)
./scripts/migrate.sh --dry-run

# Skip backup trigger (e.g., in CI or when backup is handled externally)
./scripts/migrate.sh --skip-backup

# Skip distributed lock (only if certain no other migration is running)
./scripts/migrate.sh --skip-lock

# Suppress destructive operation warnings (requires explicit justification)
./scripts/migrate.sh --force

# Run prisma migrate deploy directly (skips TypeScript runner)
./scripts/migrate.sh --deploy-only
```

**Environment variables:**

| Variable             | Required | Default                                             | Description                  |
| -------------------- | -------- | --------------------------------------------------- | ---------------------------- |
| `DATABASE_URL`       | Yes      | --                                                  | PostgreSQL connection string |
| `BACKUP_API_URL`     | No       | `http://localhost:4000/api/v1/admin/backup/trigger` | Backup API endpoint          |
| `BACKUP_API_TOKEN`   | No       | --                                                  | Bearer token for backup API  |
| `MIGRATION_TIMEOUT`  | No       | `300`                                               | Max seconds for migration    |
| `PRISMA_SCHEMA_PATH` | No       | `./prisma/schema.prisma`                            | Path to Prisma schema        |

### migrate-safe.ts (TypeScript Runner)

Lower-level migration runner with health checks and distributed locking.

```bash
# Normal run
npx ts-node scripts/migrate-safe.ts

# Preview only (captures snapshot, does not apply)
npx ts-node scripts/migrate-safe.ts --dry-run

# Skip ValKey lock
npx ts-node scripts/migrate-safe.ts --skip-lock

# Suppress destructive operation warnings
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

### rollback.sh (Rollback Assistant)

Guided procedures for rolling back migrations.

```bash
# List recent migrations and their status
./scripts/rollback.sh --list

# Show migration status + available snapshots
./scripts/rollback.sh --status

# Remove a migration record (after manually reversing SQL)
./scripts/rollback.sh --mark-rolled-back 20260328143000_add_priority

# Restore database from a pg_dump backup file
./scripts/rollback.sh --restore-from-backup /path/to/backup.dump

# View a pre/post-migration snapshot
./scripts/rollback.sh --show-snapshot pre-migration-2026-03-28.json

# Find and remove invalid indexes from failed CONCURRENTLY
./scripts/rollback.sh --cleanup-invalid-indexes
```

### check-migrations.ts (CI Check)

Validates migration files without a database.

```bash
npx ts-node scripts/check-migrations.ts
```

Validates:

- All migration directories contain `migration.sql`
- Migration names follow naming convention
- Destructive operations are explicitly approved with `-- APPROVED_DESTRUCTIVE:` marker

### Migration Dry-Run (Preview SQL)

To preview the SQL that would be generated for pending schema changes:

```bash
# Via migrate.sh
./scripts/migrate.sh --dry-run

# Via Prisma directly (shows SQL diff between migrations and schema)
npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --script
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
use the three-phase expand-contract pattern. This ensures backwards compatibility
during the deployment window.

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
remain valid during this phase due to the sync trigger. Old and new application
instances coexist safely.

### Phase 3: Contract (Migration)

After **all** application instances have been updated to use the new column:

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

### migration-check.yml Workflow

Located at `.github/workflows/migration-check.yml`, this workflow runs automatically
on PRs that touch Prisma schema or migration files.

**Jobs:**

| Job              | What it does                                                       |
| ---------------- | ------------------------------------------------------------------ |
| `static-check`   | Naming convention, destructive ops, file integrity, schema drift   |
| `migration-test` | Applies all migrations to a fresh PostgreSQL 17 and verifies state |

**Schema drift detection** uses `prisma migrate diff --exit-code`:

- Exit code `0`: schema.prisma matches migration history (no drift)
- Exit code `2`: schema.prisma has changes not captured in a migration

This prevents merging PRs where someone edited `schema.prisma` without
creating a corresponding migration file.

### Adding to Existing CI

The migration check workflow is independent from the main CI pipeline. If you
want to also run migration checks in the main CI workflow, add:

```yaml
- name: Check database migrations
  working-directory: apps/server
  run: npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/check-migrations.ts
```

### Approving Destructive Operations

If a migration intentionally contains destructive operations (e.g., dropping an
unused column), add an approval marker comment to the migration SQL:

```sql
-- APPROVED_DESTRUCTIVE: Removing deprecated `legacy_role` column per ADR-015.
-- Data was migrated to `role` column in migration 0012.
ALTER TABLE "users" DROP COLUMN IF EXISTS "legacy_role";
```

---

## Docker Deployment

### Entrypoint (Zero-Downtime Migrations)

The Docker entrypoint (`docker/entrypoint.sh`) automatically runs migrations
before starting the NestJS application:

```
Container starts
  -> Wait for PostgreSQL to be ready
  -> Run prisma migrate deploy
  -> Start node main.js
```

Prisma's built-in **PostgreSQL advisory lock** prevents concurrent migration runs
when multiple server containers start simultaneously. Only one container runs
migrations; the others wait for the lock to be released.

### Dockerfile Integration

The server Dockerfile (`docker/Dockerfile.server`) uses the entrypoint:

```dockerfile
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "main.js"]
```

### Environment Variables

| Variable            | Default | Description                                 |
| ------------------- | ------- | ------------------------------------------- |
| `SKIP_MIGRATIONS`   | `false` | Set to `true` to skip auto-migration        |
| `MIGRATION_TIMEOUT` | `120`   | Max seconds for migration to complete       |
| `DB_READY_TIMEOUT`  | `60`    | Max seconds to wait for PostgreSQL          |
| `DB_READY_INTERVAL` | `2`     | Seconds between PostgreSQL readiness checks |

### Rolling Update Strategy

```bash
# Pull new images
docker compose -f docker/docker-compose.prod.yml pull

# Update only the server (runs migrations via entrypoint)
docker compose -f docker/docker-compose.prod.yml up -d --no-deps server

# After server is healthy, update frontend
docker compose -f docker/docker-compose.prod.yml up -d --no-deps web
```

The health check ensures the new container does not receive traffic until
migrations are complete and the NestJS app passes its `/health` endpoint.

---

## Backwards-Compatible Migration Strategy

All schema changes MUST be backwards-compatible with the currently running
application version. This is critical for zero-downtime deployments where
old and new code coexist briefly.

### Rules

1. **Additive changes only**: Add columns, tables, indexes. Never remove or
   rename in the same deployment as a code change.

2. **New columns must be nullable or have defaults**: The old application code
   does not know about the new column and will not provide a value.

3. **Never remove a column that old code reads**: Use the expand-contract
   pattern to phase out columns over two deployments.

4. **Never rename a column**: Same as removal from old code's perspective.
   Use expand-contract.

5. **Enum additions are safe**: Adding a new value to a PostgreSQL enum is
   backwards-compatible. Removing or renaming values is not.

### Two-Deployment Pattern

For any breaking schema change, use two separate deployments:

| Deployment | Schema Change                         | Code Change                          |
| ---------- | ------------------------------------- | ------------------------------------ |
| Deploy 1   | EXPAND: add new column + sync trigger | Update code to write to both columns |
| Deploy 2   | CONTRACT: drop old column + trigger   | Remove references to old column      |

---

## Pre-Migration Backup

### Automatic (via migrate.sh)

The `migrate.sh` script triggers a backup via the Notesaner backup API before
applying migrations:

```bash
# Default: calls POST http://localhost:4000/api/v1/admin/backup/trigger
./scripts/migrate.sh

# With authentication
BACKUP_API_TOKEN="your-admin-token" ./scripts/migrate.sh

# Custom backup API URL (e.g., external backup service)
BACKUP_API_URL="https://backup.internal/api/trigger" ./scripts/migrate.sh
```

### Manual Backup

```bash
# Via Notesaner API
curl -X POST http://localhost:4000/api/v1/admin/backup/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"type": "DATABASE", "triggeredBy": "manual-pre-migration"}'

# Via pg_dump directly
pg_dump -Fc -h localhost -U notesaner -d notesaner \
  -f "/backups/pre-migration-$(date +%Y%m%d%H%M%S).dump"
```

### Backup Verification

Before trusting a backup for rollback, verify it:

```bash
# List contents without restoring
pg_restore --list /backups/pre-migration.dump | head -50

# Restore to a test database
createdb notesaner_restore_test
pg_restore -d notesaner_restore_test /backups/pre-migration.dump
```

---

## Rollback Strategy

### Overview

Prisma does NOT support automatic rollbacks. The `_prisma_migrations` table
tracks applied migrations, and there is no built-in `migrate rollback` command.

Three rollback strategies, in order of preference:

| Strategy                 | When to Use                               | Data Loss Risk        |
| ------------------------ | ----------------------------------------- | --------------------- |
| Forward rollback         | Additive changes (new columns, indexes)   | None                  |
| Migration record removal | Failed migration that did not change data | None                  |
| Database restore         | Destructive changes with data loss        | Yes (to backup point) |

### Strategy 1: Forward Rollback

Create a new migration that undoes the changes:

```bash
# Create a rollback migration
pnpm prisma migrate dev --name rollback_20260328_add_priority

# The migration SQL should reverse the original change:
# ALTER TABLE "notes" DROP COLUMN IF EXISTS "priority";
```

### Strategy 2: Remove Migration Record

If a migration failed partway through or needs to be re-run:

```bash
./scripts/rollback.sh --mark-rolled-back 20260328143000_add_priority
```

This removes the record from `_prisma_migrations` so the migration can be
re-applied on the next `prisma migrate deploy`.

### Strategy 3: Database Restore

For catastrophic failures or destructive migrations that went wrong:

```bash
./scripts/rollback.sh --restore-from-backup /backups/pre-migration.dump
```

This script:

1. Terminates active connections
2. Drops and recreates the database
3. Restores from the backup file
4. Provides next-step guidance

### Post-Rollback Checklist

- [ ] Verify `prisma migrate status` shows expected state
- [ ] Run `prisma migrate deploy` if there are migrations that should be applied
- [ ] Restart all application containers
- [ ] Run smoke tests
- [ ] Notify the team

---

## Seed Data Management

Seed data is **completely separated** from schema migrations.

| Concern           | Location                              | Runs When                             |
| ----------------- | ------------------------------------- | ------------------------------------- |
| Schema migrations | `prisma/migrations/*/migration.sql`   | Every deployment via `migrate deploy` |
| Seed data         | `prisma/seed.ts` + `prisma/fixtures/` | Manual or opt-in via `prisma db seed` |

### Seed Safety Guards

- **Production**: seed script refuses to run (`process.exit(1)`)
- **Staging**: generates random passwords (printed to stdout)
- **Development**: uses fixed credentials for convenience
- **SEED_DATA env var**: must be explicitly `"true"` when set

### Running Seeds

```bash
# Development (default)
pnpm prisma-seed

# Staging
NODE_ENV=staging pnpm prisma-seed

# CI (opt-in)
SEED_DATA=true pnpm prisma-seed
```

Seed data is idempotent (uses upserts) and safe to run multiple times.

---

## Migration Lock Mechanism

Two layers of locking prevent concurrent migration runs:

### Layer 1: Prisma Advisory Lock (PostgreSQL)

`prisma migrate deploy` automatically acquires a PostgreSQL advisory lock
before applying migrations. This is built into Prisma and requires no
configuration. It prevents multiple `migrate deploy` invocations from
racing against each other.

This is the lock used by the Docker entrypoint (`entrypoint.sh`).

### Layer 2: ValKey Distributed Lock

The TypeScript migration runner (`migrate-safe.ts`) acquires an additional
distributed lock via ValKey (Redis-compatible) for higher-level coordination:

- **Key**: `notesaner:migration:lock`
- **TTL**: 600 seconds (10 minutes)
- **Mechanism**: `SET NX EX` (atomic set-if-not-exists with expiry)
- **Release**: Lua script with compare-and-delete (only the lock holder can release)

This lock is used by the `migrate-safe.ts` runner and `migrate.sh` wrapper.
The Docker entrypoint does NOT use this lock (it relies on Prisma's advisory lock).

### Emergency Lock Release

```bash
# Check lock status
redis-cli GET notesaner:migration:lock

# Force-release (ONLY if certain no migration is running)
redis-cli DEL notesaner:migration:lock
```

---

## Operational Runbook

### Before Migration

- [ ] CI migration check passed for the PR
- [ ] Run `./scripts/migrate.sh --dry-run` in staging
- [ ] Verify backup is recent (< 1 hour old)
- [ ] Check active connection count is nominal
- [ ] Notify team

### During Migration

- [ ] Monitor application logs for errors
- [ ] Watch database connection count (should not spike)
- [ ] Track migration duration against expectations

### After Migration

- [ ] Verify post-migration health check passed
- [ ] Run smoke tests against the updated application
- [ ] Verify migration snapshot saved in `prisma/.migration-snapshots/`
- [ ] Check `prisma migrate status` shows no drift
- [ ] Update migration log

### Emergency: Migration Stuck

If the migration lock is stuck (process crashed without releasing):

```bash
# Check ValKey lock
redis-cli GET notesaner:migration:lock

# Force-release (ONLY if certain no migration is running)
redis-cli DEL notesaner:migration:lock
```

If a migration is stuck mid-execution:

```sql
-- Check for active locks in PostgreSQL
SELECT pid, state, query, now() - query_start AS duration
FROM pg_stat_activity
WHERE state = 'active'
  AND (query LIKE '%ALTER%' OR query LIKE '%CREATE%');

-- Cancel a stuck query (graceful)
SELECT pg_cancel_backend(<pid>);

-- Terminate a stuck query (forceful, last resort)
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

### "Schema drift detected" in CI

The `schema.prisma` file has changes that are not captured in a migration:

```bash
# Create the missing migration
pnpm prisma migrate dev --name describe_the_change
```

### "No new migrations were applied"

The `prisma migrate deploy` command ran but did not apply any migrations:

- The `_prisma_migrations` table already contains the migration
- The migration was previously applied manually
- Check Prisma output for details

### Invalid Indexes After Failed CONCURRENTLY

If `CREATE INDEX CONCURRENTLY` fails, it leaves an invalid index:

```bash
# Find and clean up via rollback script
./scripts/rollback.sh --cleanup-invalid-indexes

# Or manually:
SELECT indexrelid::regclass AS index_name,
       indrelid::regclass AS table_name
FROM pg_index
WHERE NOT indisvalid;

DROP INDEX CONCURRENTLY "idx_name";
CREATE INDEX CONCURRENTLY "idx_name" ON "table" ("column");
```

### Docker Container Fails to Start

If the server container fails during migration:

```bash
# Check container logs
docker logs notesaner-prod-server-1

# Skip migrations and start manually to debug
docker run -e SKIP_MIGRATIONS=true -e DATABASE_URL=... notesaner/server

# Run migrations manually inside the container
docker exec -it notesaner-prod-server-1 npx prisma migrate status
docker exec -it notesaner-prod-server-1 npx prisma migrate deploy
```
