# =============================================================================
# Notesaner — Development Dockerfile
#
# Used by docker compose --profile dev to run web + server in containers
# with hot-reload via volume-mounted source code.
#
# Source code is NOT copied — it is bind-mounted from the host at runtime.
# node_modules lives in a named volume to avoid platform binary conflicts.
# =============================================================================

FROM node:22-alpine

# Install system dependencies needed by native modules (prisma, sharp, etc.)
RUN apk add --no-cache libc6-compat openssl

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# The entrypoint:
#   1. Installs/refreshes dependencies (in case lockfile changed)
#   2. Generates Prisma client
#   3. Runs the dev command passed as CMD
COPY docker/dev-entrypoint.sh /usr/local/bin/dev-entrypoint.sh
RUN chmod +x /usr/local/bin/dev-entrypoint.sh

ENTRYPOINT ["dev-entrypoint.sh"]
