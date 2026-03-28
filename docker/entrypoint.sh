#!/usr/bin/env sh
# =============================================================================
# Notesaner — Docker Entrypoint for Server Container
# =============================================================================
#
# Runs database migrations before starting the NestJS application server.
# This ensures zero-downtime deployments: the new container fully migrates
# the database before accepting traffic (via the health check).
#
# Sequence:
#   1. Wait for PostgreSQL to be ready (with timeout)
#   2. Run prisma migrate deploy (applies pending migrations)
#   3. Generate Prisma client (ensures client matches schema)
#   4. Start the NestJS application
#
# Environment variables:
#   DATABASE_URL              (required) PostgreSQL connection string
#   SKIP_MIGRATIONS           (optional) Set to "true" to skip migrations
#   MIGRATION_TIMEOUT         (optional) Max seconds to wait for migration, default: 120
#   DB_READY_TIMEOUT          (optional) Max seconds to wait for DB, default: 60
#   DB_READY_INTERVAL         (optional) Seconds between DB ready checks, default: 2
#
# The entrypoint uses Prisma's built-in advisory lock mechanism to prevent
# concurrent migration runs when multiple server containers start simultaneously.
# =============================================================================

set -eu

# ─── Logging ─────────────────────────────────────────────────────────────────

log() {
  echo "[entrypoint] [$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
}

log_error() {
  echo "[entrypoint] [$(date -u '+%Y-%m-%dT%H:%M:%SZ')] ERROR: $1" >&2
}

# ─── Configuration ───────────────────────────────────────────────────────────

MIGRATION_TIMEOUT="${MIGRATION_TIMEOUT:-120}"
DB_READY_TIMEOUT="${DB_READY_TIMEOUT:-60}"
DB_READY_INTERVAL="${DB_READY_INTERVAL:-2}"
SKIP_MIGRATIONS="${SKIP_MIGRATIONS:-false}"
PRISMA_SCHEMA_PATH="./prisma/schema.prisma"

# ─── Wait for Database ──────────────────────────────────────────────────────

wait_for_db() {
  log "Waiting for PostgreSQL to be ready..."

  local elapsed=0

  while [ "$elapsed" -lt "$DB_READY_TIMEOUT" ]; do
    # Use Prisma to check connectivity (works without pg_isready)
    if echo "SELECT 1;" | npx prisma db execute --schema="$PRISMA_SCHEMA_PATH" --stdin > /dev/null 2>&1; then
      log "PostgreSQL is ready (waited ${elapsed}s)"
      return 0
    fi

    sleep "$DB_READY_INTERVAL"
    elapsed=$((elapsed + DB_READY_INTERVAL))
  done

  log_error "PostgreSQL not ready after ${DB_READY_TIMEOUT}s. Aborting."
  exit 1
}

# ─── Run Migrations ─────────────────────────────────────────────────────────

run_migrations() {
  if [ "$SKIP_MIGRATIONS" = "true" ]; then
    log "Skipping migrations (SKIP_MIGRATIONS=true)"
    return 0
  fi

  log "Running database migrations..."

  # prisma migrate deploy:
  #   - Applies all pending migrations from prisma/migrations/
  #   - Uses PostgreSQL advisory locks to prevent concurrent runs
  #   - Does NOT generate Prisma Client (we do that in the build step)
  #   - Safe for production: only applies committed migration files
  #   - Does NOT create new migrations or modify schema.prisma

  local start_time
  start_time=$(date +%s)

  if timeout "$MIGRATION_TIMEOUT" npx prisma migrate deploy --schema="$PRISMA_SCHEMA_PATH" 2>&1; then
    local end_time duration
    end_time=$(date +%s)
    duration=$((end_time - start_time))
    log "Migrations completed successfully in ${duration}s"
  else
    local exit_code=$?

    if [ "$exit_code" -eq 124 ]; then
      log_error "Migration timed out after ${MIGRATION_TIMEOUT}s"
    else
      log_error "Migration failed with exit code ${exit_code}"
    fi

    log_error "The application will NOT start. Fix the migration issue and redeploy."
    exit 1
  fi
}

# ─── Main ────────────────────────────────────────────────────────────────────

log "=== Notesaner Server Entrypoint ==="
log "NODE_ENV: ${NODE_ENV:-development}"

# Verify DATABASE_URL is set
if [ -z "${DATABASE_URL:-}" ]; then
  log_error "DATABASE_URL environment variable is not set"
  exit 1
fi

# Step 1: Wait for PostgreSQL
wait_for_db

# Step 2: Run migrations
run_migrations

# Step 3: Start the application
log "Starting NestJS application..."
exec "$@"
