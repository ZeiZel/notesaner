#!/usr/bin/env bash
# =============================================================================
# Notesaner — Migration Rollback Script
# =============================================================================
#
# Assists with rolling back a failed or unwanted database migration.
#
# Prisma does NOT support automatic rollbacks. This script provides guided
# procedures for the two rollback strategies:
#
#   1. FORWARD ROLLBACK: Create a new "undo" migration that reverses the changes
#   2. DATABASE RESTORE: Restore from a pre-migration backup
#
# Usage:
#   ./scripts/rollback.sh --list                              # List applied migrations
#   ./scripts/rollback.sh --status                            # Show migration status
#   ./scripts/rollback.sh --mark-rolled-back <migration_name> # Remove migration record
#   ./scripts/rollback.sh --restore-from-backup <backup_path> # Restore from pg_dump
#   ./scripts/rollback.sh --show-snapshot <snapshot_file>     # Display a migration snapshot
#   ./scripts/rollback.sh --cleanup-invalid-indexes           # Remove invalid indexes
#
# Environment variables:
#   DATABASE_URL          (required) PostgreSQL connection string
#   PGPASSWORD            (optional) PostgreSQL password for pg_restore
#
# WARNING: These operations are destructive. Always verify you have a valid
# backup before proceeding.
#
# Exit codes:
#   0 — success
#   1 — invalid arguments or missing prerequisites
#   2 — rollback operation failed
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PRISMA_SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-${SERVER_DIR}/prisma/schema.prisma}"
SNAPSHOTS_DIR="${SERVER_DIR}/prisma/.migration-snapshots"

# ─── Logging ─────────────────────────────────────────────────────────────────

log() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
}

log_error() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: $1" >&2
}

log_warn() {
  echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] WARN: $1" >&2
}

# ─── Pre-flight ──────────────────────────────────────────────────────────────

preflight() {
  if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL environment variable is required"
    exit 1
  fi
}

# ─── Parse DATABASE_URL ─────────────────────────────────────────────────────

parse_db_url() {
  # Parse: postgresql://user:pass@host:port/dbname?params
  DB_USER=$(echo "$DATABASE_URL" | sed -n 's|.*://\([^:]*\):.*|\1|p')
  DB_PASS=$(echo "$DATABASE_URL" | sed -n 's|.*://[^:]*:\([^@]*\)@.*|\1|p')
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')
  DB_NAME=$(echo "$DATABASE_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')
}

# ─── Commands ────────────────────────────────────────────────────────────────

cmd_list() {
  log "=== Applied Migrations ==="

  parse_db_url
  export PGPASSWORD="$DB_PASS"

  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    SELECT
      migration_name,
      started_at,
      finished_at,
      CASE
        WHEN finished_at IS NOT NULL THEN 'applied'
        WHEN rolled_back_at IS NOT NULL THEN 'rolled_back'
        ELSE 'failed'
      END AS status,
      EXTRACT(EPOCH FROM (COALESCE(finished_at, NOW()) - started_at))::INTEGER AS duration_sec
    FROM _prisma_migrations
    ORDER BY started_at DESC
    LIMIT 20;
  " 2>/dev/null || {
    log_warn "Could not query _prisma_migrations directly. Falling back to prisma migrate status."
    (cd "$SERVER_DIR" && npx prisma migrate status --schema="$PRISMA_SCHEMA_PATH" 2>&1)
  }
}

cmd_status() {
  log "=== Migration Status ==="
  (cd "$SERVER_DIR" && npx prisma migrate status --schema="$PRISMA_SCHEMA_PATH" 2>&1)

  # Show snapshots if any exist
  if [ -d "$SNAPSHOTS_DIR" ] && [ "$(ls -A "$SNAPSHOTS_DIR" 2>/dev/null)" ]; then
    echo ""
    log "=== Available Snapshots ==="
    ls -lt "$SNAPSHOTS_DIR" | head -20
  fi
}

cmd_mark_rolled_back() {
  local migration_name="$1"

  if [ -z "$migration_name" ]; then
    log_error "Migration name is required. Usage: --mark-rolled-back <migration_name>"
    exit 1
  fi

  log "=== Mark Migration as Rolled Back ==="
  log "Migration: ${migration_name}"
  log ""
  log_warn "This will DELETE the migration record from _prisma_migrations."
  log_warn "The database schema will NOT be reverted automatically."
  log_warn "You must manually reverse the SQL changes before running this."
  log ""

  # Confirm
  read -r -p "Are you sure you want to proceed? Type the migration name to confirm: " confirm
  if [ "$confirm" != "$migration_name" ]; then
    log "Aborted. Migration name did not match."
    exit 1
  fi

  parse_db_url
  export PGPASSWORD="$DB_PASS"

  # Record rollback timestamp before deletion
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
    DELETE FROM _prisma_migrations
    WHERE migration_name = '${migration_name}';
  " 2>&1

  local result=$?
  if [ $result -eq 0 ]; then
    log "Migration record '${migration_name}' removed from _prisma_migrations."
    log ""
    log "Next steps:"
    log "  1. Verify the database schema is in the expected state"
    log "  2. Run 'prisma migrate status' to check consistency"
    log "  3. If needed, create a new migration to reconcile schema"
  else
    log_error "Failed to remove migration record."
    exit 2
  fi
}

cmd_restore_from_backup() {
  local backup_path="$1"

  if [ -z "$backup_path" ]; then
    log_error "Backup file path is required. Usage: --restore-from-backup <path>"
    exit 1
  fi

  if [ ! -f "$backup_path" ]; then
    log_error "Backup file not found: ${backup_path}"
    exit 1
  fi

  log "=== Database Restore from Backup ==="
  log "Backup file: ${backup_path}"
  log "File size:   $(du -h "$backup_path" | cut -f1)"
  log ""
  log_warn "THIS WILL REPLACE THE ENTIRE DATABASE with the backup contents."
  log_warn "All data written since the backup was taken will be LOST."
  log_warn "All active connections will be terminated."
  log ""

  parse_db_url
  export PGPASSWORD="$DB_PASS"

  # Confirm
  read -r -p "Type 'RESTORE' to confirm database restoration: " confirm
  if [ "$confirm" != "RESTORE" ]; then
    log "Aborted."
    exit 1
  fi

  log "Step 1: Terminating active connections..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = '${DB_NAME}'
      AND pid <> pg_backend_pid();
  " 2>&1 || true

  log "Step 2: Dropping and recreating database..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "
    DROP DATABASE IF EXISTS \"${DB_NAME}\";
    CREATE DATABASE \"${DB_NAME}\" OWNER \"${DB_USER}\";
  " 2>&1

  log "Step 3: Restoring from backup..."
  local restore_start
  restore_start=$(date +%s)

  # Detect backup format and restore accordingly
  if file "$backup_path" | grep -q "PostgreSQL custom database dump"; then
    pg_restore -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
      --no-owner --no-privileges --verbose "$backup_path" 2>&1
  elif file "$backup_path" | grep -q "gzip"; then
    gunzip -c "$backup_path" | psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" 2>&1
  else
    # Assume plain SQL
    psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" < "$backup_path" 2>&1
  fi

  local restore_end duration
  restore_end=$(date +%s)
  duration=$((restore_end - restore_start))

  local result=$?
  if [ $result -eq 0 ]; then
    log "Database restored successfully in ${duration}s."
    log ""
    log "Next steps:"
    log "  1. Run 'prisma migrate status' to verify migration state"
    log "  2. Run 'prisma migrate deploy' if there are pending migrations"
    log "  3. Re-run init-db.sh if extensions need to be re-enabled"
    log "  4. Restart application containers"
  else
    log_error "Database restore failed (exit code: ${result})."
    log_error "The database may be in an inconsistent state."
    exit 2
  fi
}

cmd_show_snapshot() {
  local snapshot_file="$1"

  if [ -z "$snapshot_file" ]; then
    # List available snapshots
    if [ -d "$SNAPSHOTS_DIR" ] && [ "$(ls -A "$SNAPSHOTS_DIR" 2>/dev/null)" ]; then
      log "=== Available Snapshots ==="
      ls -lt "$SNAPSHOTS_DIR"
      log ""
      log "Usage: --show-snapshot <snapshot_file>"
    else
      log "No snapshots found in ${SNAPSHOTS_DIR}"
    fi
    return
  fi

  # Try direct path first, then look in snapshots dir
  local filepath="$snapshot_file"
  if [ ! -f "$filepath" ]; then
    filepath="${SNAPSHOTS_DIR}/${snapshot_file}"
  fi

  if [ ! -f "$filepath" ]; then
    log_error "Snapshot file not found: ${snapshot_file}"
    exit 1
  fi

  log "=== Migration Snapshot ==="
  log "File: ${filepath}"
  log ""

  # Pretty-print JSON if jq is available
  if command -v jq &>/dev/null; then
    jq '.' "$filepath"
  else
    cat "$filepath"
  fi
}

cmd_cleanup_invalid_indexes() {
  log "=== Cleanup Invalid Indexes ==="
  log "Checking for invalid indexes left by failed CONCURRENTLY operations..."

  parse_db_url
  export PGPASSWORD="$DB_PASS"

  local invalid_indexes
  invalid_indexes=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "
    SELECT indexrelid::regclass AS index_name,
           indrelid::regclass AS table_name
    FROM pg_index
    WHERE NOT indisvalid;
  " 2>&1)

  if [ -z "$(echo "$invalid_indexes" | tr -d '[:space:]')" ]; then
    log "  No invalid indexes found."
    return
  fi

  log "  Found invalid indexes:"
  echo "$invalid_indexes"
  log ""

  read -r -p "Drop all invalid indexes? [y/N]: " confirm
  if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
    log "Aborted."
    return
  fi

  # Extract index names and drop them
  echo "$invalid_indexes" | while IFS='|' read -r index_name _table_name; do
    index_name=$(echo "$index_name" | tr -d '[:space:]')
    if [ -n "$index_name" ]; then
      log "  Dropping invalid index: ${index_name}"
      psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "
        DROP INDEX CONCURRENTLY IF EXISTS ${index_name};
      " 2>&1 || log_warn "Failed to drop ${index_name}"
    fi
  done

  log "  Invalid index cleanup complete."
}

# ─── Usage ───────────────────────────────────────────────────────────────────

usage() {
  cat <<USAGE
Notesaner Migration Rollback Script

Usage:
  rollback.sh --list                               List recent migrations
  rollback.sh --status                             Show migration status + snapshots
  rollback.sh --mark-rolled-back <migration_name>  Remove a migration record
  rollback.sh --restore-from-backup <backup_path>  Restore DB from pg_dump file
  rollback.sh --show-snapshot [snapshot_file]       View a migration snapshot
  rollback.sh --cleanup-invalid-indexes            Remove invalid indexes

Environment:
  DATABASE_URL    PostgreSQL connection string (required)

IMPORTANT: These operations can be destructive. Always have a backup.
USAGE
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  if [ $# -eq 0 ]; then
    usage
    exit 0
  fi

  preflight

  case "$1" in
    --list)
      cmd_list
      ;;
    --status)
      cmd_status
      ;;
    --mark-rolled-back)
      cmd_mark_rolled_back "${2:-}"
      ;;
    --restore-from-backup)
      cmd_restore_from_backup "${2:-}"
      ;;
    --show-snapshot)
      cmd_show_snapshot "${2:-}"
      ;;
    --cleanup-invalid-indexes)
      cmd_cleanup_invalid_indexes
      ;;
    --help|-h)
      usage
      ;;
    *)
      log_error "Unknown command: $1"
      usage
      exit 1
      ;;
  esac
}

main "$@"
