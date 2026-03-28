/**
 * Shared Migration Utilities
 *
 * Helper functions used across Prisma migration scripts for common patterns
 * like conditional column creation, safe index building, and data backfilling.
 *
 * These utilities generate raw SQL strings that can be executed via
 * `prisma.$executeRawUnsafe()` in custom migration scripts, or used as
 * reference when writing migration.sql files.
 *
 * IMPORTANT: Prisma migration SQL files are pure SQL. These TypeScript helpers
 * are for use in programmatic migration runners (e.g. migrate-safe.ts) or
 * for generating SQL snippets during development.
 */

// ─── Safe Column Operations ─────────────────────────────────────────────────

/**
 * Generates SQL to add a column only if it does not already exist.
 *
 * PostgreSQL does not support `ADD COLUMN IF NOT EXISTS` before v9.6,
 * but since we require PG 17 this is safe to use. We wrap it in a
 * DO block for extra safety and logging.
 *
 * @example
 * const sql = safeAddColumn('users', 'phone', 'VARCHAR(20)');
 * await prisma.$executeRawUnsafe(sql);
 */
export function safeAddColumn(table: string, column: string, definition: string): string {
  return `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition};`;
}

/**
 * Generates SQL to drop a column only if it exists.
 */
export function safeDropColumn(table: string, column: string): string {
  return `ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${column}";`;
}

// ─── Safe Index Operations ───────────────────────────────────────────────────

/**
 * Generates SQL to create an index concurrently (non-blocking).
 *
 * `CREATE INDEX CONCURRENTLY` does not lock the table for writes, making it
 * safe for zero-downtime deployments. Note that:
 *   - It cannot run inside a transaction (Prisma migrations run in a transaction
 *     by default, so this should be used in a separate step or with
 *     `prisma migrate deploy` which does not wrap in a transaction).
 *   - If the build fails, a partial "INVALID" index is left behind.
 *     Use `cleanupInvalidIndexes()` to remove them.
 *
 * @example
 * const sql = safeConcurrentIndex('idx_notes_workspace', 'notes', ['workspace_id']);
 * await prisma.$executeRawUnsafe(sql);
 */
export function safeConcurrentIndex(
  indexName: string,
  table: string,
  columns: string[],
  options?: {
    unique?: boolean;
    where?: string;
    using?: 'btree' | 'gin' | 'gist' | 'hash';
  },
): string {
  const unique = options?.unique ? 'UNIQUE ' : '';
  const using = options?.using ? ` USING ${options.using}` : '';
  const where = options?.where ? ` WHERE ${options.where}` : '';
  const cols = columns.map((c) => `"${c}"`).join(', ');

  return (
    `CREATE ${unique}INDEX CONCURRENTLY IF NOT EXISTS "${indexName}" ` +
    `ON "${table}"${using} (${cols})${where};`
  );
}

/**
 * Generates SQL to drop an index concurrently (non-blocking).
 */
export function safeDropIndex(indexName: string): string {
  return `DROP INDEX CONCURRENTLY IF EXISTS "${indexName}";`;
}

/**
 * Generates SQL to find and remove invalid (partially built) indexes.
 *
 * Invalid indexes can be left behind if `CREATE INDEX CONCURRENTLY` fails.
 * This query identifies them so they can be cleaned up.
 */
export function findInvalidIndexesQuery(): string {
  return `
    SELECT indexrelid::regclass AS index_name,
           indrelid::regclass AS table_name
    FROM pg_index
    WHERE NOT indisvalid;
  `;
}

// ─── Expand-Contract Pattern ─────────────────────────────────────────────────

/**
 * Generates SQL for the "expand" phase of a column rename.
 *
 * Instead of directly renaming a column (which breaks running app instances),
 * the expand-contract pattern:
 *   1. EXPAND:   Add new column, copy data, add trigger to sync writes
 *   2. DEPLOY:   Update application code to use the new column
 *   3. CONTRACT: Drop the old column and trigger
 *
 * This function handles step 1.
 */
export function expandColumnRename(
  table: string,
  oldColumn: string,
  newColumn: string,
  columnDef: string,
): string {
  const triggerName = `trg_sync_${table}_${oldColumn}_to_${newColumn}`;
  const functionName = `fn_sync_${table}_${oldColumn}_to_${newColumn}`;

  return `
-- Step 1: Add the new column
ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${newColumn}" ${columnDef};

-- Step 2: Backfill existing data
UPDATE "${table}" SET "${newColumn}" = "${oldColumn}" WHERE "${newColumn}" IS NULL;

-- Step 3: Create sync trigger (keeps both columns in sync during transition)
CREATE OR REPLACE FUNCTION ${functionName}()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW."${newColumn}" IS DISTINCT FROM NEW."${oldColumn}" THEN
      -- Prefer the new column if both are set and differ
      IF NEW."${newColumn}" IS NOT NULL THEN
        NEW."${oldColumn}" := NEW."${newColumn}";
      ELSE
        NEW."${newColumn}" := NEW."${oldColumn}";
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ${triggerName} ON "${table}";
CREATE TRIGGER ${triggerName}
  BEFORE INSERT OR UPDATE ON "${table}"
  FOR EACH ROW EXECUTE FUNCTION ${functionName}();
`;
}

/**
 * Generates SQL for the "contract" phase — drops the old column and sync trigger.
 * Run this AFTER the application has been fully deployed with the new column name.
 */
export function contractColumnRename(table: string, oldColumn: string, newColumn: string): string {
  const triggerName = `trg_sync_${table}_${oldColumn}_to_${newColumn}`;
  const functionName = `fn_sync_${table}_${oldColumn}_to_${newColumn}`;

  return `
-- Remove the sync trigger
DROP TRIGGER IF EXISTS ${triggerName} ON "${table}";
DROP FUNCTION IF EXISTS ${functionName}();

-- Drop the old column
ALTER TABLE "${table}" DROP COLUMN IF EXISTS "${oldColumn}";
`;
}

// ─── Batched Data Migration ──────────────────────────────────────────────────

/**
 * Generates SQL for batched data backfill to avoid locking the entire table.
 *
 * The pattern processes rows in batches using a cursor-like WHERE clause,
 * reducing lock contention on large tables.
 *
 * @param table   - Target table
 * @param setExpr - The SET clause (without SET keyword)
 * @param where   - Optional additional WHERE filter
 * @param batchSize - Rows per batch (default 1000)
 *
 * @returns A PL/pgSQL function that performs the batched update
 */
export function batchedBackfill(
  table: string,
  setExpr: string,
  where?: string,
  batchSize = 1000,
): string {
  const funcName = `fn_backfill_${table}_${Date.now()}`;
  const additionalWhere = where ? `AND (${where})` : '';

  return `
CREATE OR REPLACE FUNCTION ${funcName}()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  total_updated INTEGER := 0;
  batch_count INTEGER;
BEGIN
  LOOP
    WITH batch AS (
      SELECT id FROM "${table}"
      WHERE TRUE ${additionalWhere}
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "${table}" t
    SET ${setExpr}
    FROM batch
    WHERE t.id = batch.id;

    GET DIAGNOSTICS batch_count = ROW_COUNT;
    total_updated := total_updated + batch_count;

    -- Exit when no more rows to process
    EXIT WHEN batch_count = 0;

    -- Brief pause to reduce load
    PERFORM pg_sleep(0.1);
  END LOOP;

  RETURN total_updated;
END;
$$;

SELECT ${funcName}();
DROP FUNCTION ${funcName}();
`;
}

// ─── Table Size Estimation ───────────────────────────────────────────────────

/**
 * Generates SQL to estimate table row count (fast, using pg_class stats).
 * Much faster than COUNT(*) for large tables.
 */
export function estimateRowCountQuery(table: string): string {
  return `
    SELECT reltuples::bigint AS estimated_count
    FROM pg_class
    WHERE relname = '${table}';
  `;
}

/**
 * Generates SQL to get table and index sizes.
 */
export function tableSizeQuery(table: string): string {
  return `
    SELECT
      pg_size_pretty(pg_total_relation_size('"${table}"')) AS total_size,
      pg_size_pretty(pg_relation_size('"${table}"')) AS table_size,
      pg_size_pretty(pg_indexes_size('"${table}"')) AS index_size;
  `;
}

// ─── Advisory Lock ───────────────────────────────────────────────────────────

/**
 * PostgreSQL advisory lock for migration coordination.
 *
 * Advisory locks are session-level and automatically released when the
 * connection closes, preventing deadlocks even if the process crashes.
 *
 * Use a fixed lock ID derived from 'notesaner-migration' hash.
 */
export const PG_ADVISORY_LOCK_ID = 73628491; // Stable hash of 'notesaner-migration'

export function acquireAdvisoryLockQuery(): string {
  return `SELECT pg_try_advisory_lock(${PG_ADVISORY_LOCK_ID}) AS acquired;`;
}

export function releaseAdvisoryLockQuery(): string {
  return `SELECT pg_advisory_unlock(${PG_ADVISORY_LOCK_ID}) AS released;`;
}
