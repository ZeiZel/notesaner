#!/usr/bin/env bash
# =============================================================================
# Notesaner — Production Migration Script
# =============================================================================
#
# A shell wrapper around the TypeScript migrate-safe.ts runner, designed for
# use in Docker entrypoints, CI pipelines, and manual deployment workflows.
#
# Features:
#   - Pre-migration database backup trigger (calls backup API)
#   - Migration dry-run (preview SQL before applying)
#   - prisma migrate deploy for production
#   - Exit code propagation for CI/CD
#   - Structured logging with timestamps
#
# Usage:
#   ./scripts/migrate.sh                     # Full migration with backup
#   ./scripts/migrate.sh --dry-run           # Preview only
#   ./scripts/migrate.sh --skip-backup       # Skip pre-migration backup
#   ./scripts/migrate.sh --skip-lock         # Skip distributed lock
#   ./scripts/migrate.sh --force             # Skip destructive op warnings
#   ./scripts/migrate.sh --deploy-only       # Run prisma migrate deploy directly
#
# Environment variables:
#   DATABASE_URL          (required) PostgreSQL connection string
#   BACKUP_API_URL        (optional) URL to trigger backup, default: http://localhost:4000/api/v1/admin/backup/trigger
#   BACKUP_API_TOKEN      (optional) Bearer token for backup API
#   MIGRATION_TIMEOUT     (optional) Max seconds for migration, default: 300
#   PRISMA_SCHEMA_PATH    (optional) Path to schema.prisma, default: ./prisma/schema.prisma
#
# Exit codes:
#   0 — success
#   1 — pre-flight check failed
#   2 — backup trigger failed (non-fatal in --skip-backup mode)
#   3 — migration execution failed
#   4 — post-migration validation failed
# =============================================================================

set -euo pipefail

# ─── Configuration ───────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

BACKUP_API_URL="${BACKUP_API_URL:-http://localhost:4000/api/v1/admin/backup/trigger}"
BACKUP_API_TOKEN="${BACKUP_API_TOKEN:-}"
MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-300}"
PRISMA_SCHEMA_PATH="${PRISMA_SCHEMA_PATH:-${SERVER_DIR}/prisma/schema.prisma}"

# ─── CLI Flags ───────────────────────────────────────────────────────────────

DRY_RUN=false
SKIP_BACKUP=false
SKIP_LOCK=false
FORCE=false
DEPLOY_ONLY=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)     DRY_RUN=true ;;
    --skip-backup) SKIP_BACKUP=true ;;
    --skip-lock)   SKIP_LOCK=true ;;
    --force)       FORCE=true ;;
    --deploy-only) DEPLOY_ONLY=true ;;
    --help|-h)
      echo "Usage: migrate.sh [--dry-run] [--skip-backup] [--skip-lock] [--force] [--deploy-only]"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: migrate.sh [--dry-run] [--skip-backup] [--skip-lock] [--force] [--deploy-only]"
      exit 1
      ;;
  esac
done

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

# ─── Pre-flight Checks ──────────────────────────────────────────────────────

preflight() {
  log "=== Notesaner Migration Script ==="
  log "Mode: $([ "$DRY_RUN" = true ] && echo 'DRY RUN' || echo 'LIVE')"
  log "Working directory: ${SERVER_DIR}"

  # Check DATABASE_URL
  if [ -z "${DATABASE_URL:-}" ]; then
    log_error "DATABASE_URL environment variable is required"
    exit 1
  fi

  # Check Prisma schema exists
  if [ ! -f "$PRISMA_SCHEMA_PATH" ]; then
    log_error "Prisma schema not found at: ${PRISMA_SCHEMA_PATH}"
    exit 1
  fi

  # Check npx/prisma availability
  if ! command -v npx &>/dev/null; then
    log_error "npx not found in PATH"
    exit 1
  fi

  log "Pre-flight checks passed"
}

# ─── Database Connectivity Check ─────────────────────────────────────────────

check_db_connectivity() {
  log "Checking database connectivity..."

  # Extract host and port from DATABASE_URL for pg_isready (if available)
  if command -v pg_isready &>/dev/null; then
    # Parse: postgresql://user:pass@host:port/dbname
    local db_host db_port
    db_host=$(echo "$DATABASE_URL" | sed -n 's|.*@\([^:]*\):.*|\1|p')
    db_port=$(echo "$DATABASE_URL" | sed -n 's|.*:\([0-9]*\)/.*|\1|p')

    if [ -n "$db_host" ] && [ -n "$db_port" ]; then
      if pg_isready -h "$db_host" -p "$db_port" -t 5 &>/dev/null; then
        log "  Database is reachable at ${db_host}:${db_port}"
      else
        log_error "Database is not reachable at ${db_host}:${db_port}"
        exit 1
      fi
    fi
  else
    log "  pg_isready not available, skipping connectivity check"
  fi
}

# ─── Check Pending Migrations ────────────────────────────────────────────────

check_pending() {
  log "Checking for pending migrations..."

  local output
  output=$(cd "$SERVER_DIR" && npx prisma migrate status --schema="$PRISMA_SCHEMA_PATH" 2>&1) || true

  if echo "$output" | grep -q "Database schema is up to date"; then
    log "  No pending migrations. Database is up to date."
    return 1  # Signal: nothing to do
  fi

  # Print the status for visibility
  echo "$output" | while IFS= read -r line; do
    log "  $line"
  done

  return 0  # Signal: there are pending migrations
}

# ─── Preview Migration SQL (Dry Run) ────────────────────────────────────────

preview_migration_sql() {
  log "Previewing migration SQL (dry run)..."

  # Use prisma migrate diff to show what would change
  local diff_output
  diff_output=$(cd "$SERVER_DIR" && npx prisma migrate diff \
    --from-migrations ./prisma/migrations \
    --to-schema-datamodel "$PRISMA_SCHEMA_PATH" \
    --script 2>&1) || true

  if [ -z "$diff_output" ] || echo "$diff_output" | grep -q "No difference"; then
    log "  No schema drift detected."
  else
    log "  SQL that would be generated for pending schema changes:"
    echo "---"
    echo "$diff_output"
    echo "---"
  fi
}

# ─── Trigger Pre-Migration Backup ───────────────────────────────────────────

trigger_backup() {
  if [ "$SKIP_BACKUP" = true ]; then
    log "Skipping pre-migration backup (--skip-backup)"
    return 0
  fi

  log "Triggering pre-migration database backup..."

  local http_code
  local auth_header=""

  if [ -n "$BACKUP_API_TOKEN" ]; then
    auth_header="-H \"Authorization: Bearer ${BACKUP_API_TOKEN}\""
  fi

  # Attempt to trigger backup via the Notesaner backup API
  http_code=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    ${auth_header:+"$auth_header"} \
    -d '{"type": "DATABASE", "triggeredBy": "migration-script"}' \
    --connect-timeout 10 \
    --max-time 60 \
    "$BACKUP_API_URL" 2>/dev/null) || http_code="000"

  case "$http_code" in
    200|201|202)
      log "  Backup triggered successfully (HTTP ${http_code})"
      ;;
    000)
      log_warn "Backup API unreachable at ${BACKUP_API_URL}. Proceeding without backup."
      log_warn "Ensure you have a recent backup before migrating in production."
      ;;
    *)
      log_warn "Backup API returned HTTP ${http_code}. Proceeding without backup."
      log_warn "Ensure you have a recent backup before migrating in production."
      ;;
  esac
}

# ─── Run Migration (deploy-only mode) ───────────────────────────────────────

run_prisma_deploy() {
  log "Running prisma migrate deploy..."

  local start_time
  start_time=$(date +%s)

  if timeout "$MIGRATION_TIMEOUT" npx prisma migrate deploy --schema="$PRISMA_SCHEMA_PATH" 2>&1; then
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    log "  prisma migrate deploy completed in ${duration}s"
  else
    local exit_code=$?
    log_error "prisma migrate deploy failed (exit code: ${exit_code})"

    if [ "$exit_code" -eq 124 ]; then
      log_error "Migration timed out after ${MIGRATION_TIMEOUT}s"
    fi

    exit 3
  fi
}

# ─── Run Migration (safe mode via TypeScript runner) ─────────────────────────

run_safe_migration() {
  log "Running safe migration via migrate-safe.ts..."

  local ts_args=()
  [ "$DRY_RUN" = true ] && ts_args+=("--dry-run")
  [ "$SKIP_LOCK" = true ] && ts_args+=("--skip-lock")
  [ "$FORCE" = true ] && ts_args+=("--force")

  local start_time
  start_time=$(date +%s)

  if (cd "$SERVER_DIR" && timeout "$MIGRATION_TIMEOUT" npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/migrate-safe.ts "${ts_args[@]}" 2>&1); then
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    log "  Safe migration completed in ${duration}s"
  else
    local exit_code=$?
    log_error "Safe migration failed (exit code: ${exit_code})"

    if [ "$exit_code" -eq 124 ]; then
      log_error "Migration timed out after ${MIGRATION_TIMEOUT}s"
    fi

    exit "$exit_code"
  fi
}

# ─── Detect Schema Drift ────────────────────────────────────────────────────

detect_drift() {
  log "Checking for schema drift..."

  if (cd "$SERVER_DIR" && npx prisma migrate diff \
    --from-migrations ./prisma/migrations \
    --to-schema-datamodel "$PRISMA_SCHEMA_PATH" \
    --exit-code 2>&1); then
    log "  No schema drift detected."
  else
    local exit_code=$?
    if [ "$exit_code" -eq 2 ]; then
      log_warn "Schema drift detected! The schema.prisma does not match the migration history."
      log_warn "Run 'pnpm prisma-migrate' to create a new migration."
    fi
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

main() {
  preflight
  check_db_connectivity

  # Check if there are pending migrations
  if ! check_pending; then
    log "=== No migrations to apply ==="
    exit 0
  fi

  # Dry run mode: preview SQL and exit
  if [ "$DRY_RUN" = true ]; then
    preview_migration_sql

    # Also run the TypeScript dry-run for snapshot info
    run_safe_migration
    exit 0
  fi

  # Trigger pre-migration backup
  trigger_backup

  # Run migration
  if [ "$DEPLOY_ONLY" = true ]; then
    run_prisma_deploy
  else
    run_safe_migration
  fi

  # Post-migration drift check
  detect_drift

  log "=== Migration completed successfully ==="
}

main
