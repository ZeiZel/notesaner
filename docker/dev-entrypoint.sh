#!/usr/bin/env sh
# =============================================================================
# Notesaner — Dev Container Entrypoint
#
# Runs inside the dev container on startup:
#   1. Install/refresh pnpm dependencies (handles lockfile changes)
#   2. Generate Prisma client (ensures schema matches)
#   3. Execute the CMD (pnpm nx serve <project>)
# =============================================================================

set -eu

log() {
  echo "[dev-entrypoint] [$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1"
}

log "=== Notesaner Dev Container ==="
log "Node $(node --version) | pnpm $(pnpm --version)"
log "Working directory: $(pwd)"

# Step 1: Install dependencies
# --frozen-lockfile is too strict for dev (lockfile may drift);
# use --prefer-offline to speed up subsequent installs.
log "Installing dependencies..."
pnpm install --prefer-offline

# Step 2: Generate Prisma client (Prisma 7+ uses prisma.config.ts)
if [ -f apps/server/prisma/schema.prisma ]; then
  log "Generating Prisma client..."
  cd apps/server && pnpm prisma generate && cd /app
fi

# Step 3: Run the passed command
log "Starting: $*"
exec "$@"
