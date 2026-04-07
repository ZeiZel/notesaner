# ============================================================
# Notesaner Server — NestJS 11 multi-stage Dockerfile
# ============================================================
# Build context: repository root (not apps/server/)
# Usage: docker build -f apps/server/Dockerfile .
# ============================================================

# ── Base ──────────────────────────────────────────────────────
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
RUN apk add --no-cache libc6-compat openssl

# Disable husky git hooks in CI/Docker
ENV HUSKY=0

WORKDIR /app

# ── Dependencies ─────────────────────────────────────────────
FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# Copy all package.json files to preserve pnpm workspace structure
COPY apps/web/package.json apps/web/package.json
COPY apps/server/package.json apps/server/package.json
COPY libs/contracts/package.json libs/contracts/package.json
COPY libs/constants/package.json libs/constants/package.json
COPY libs/utils/package.json libs/utils/package.json
COPY libs/editor-core/package.json libs/editor-core/package.json
COPY libs/sync-engine/package.json libs/sync-engine/package.json
COPY libs/markdown/package.json libs/markdown/package.json
COPY libs/plugin-sdk/package.json libs/plugin-sdk/package.json
COPY libs/query-factory/package.json libs/query-factory/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/component-sdk/package.json packages/component-sdk/package.json
COPY packages/plugin-ai/package.json packages/plugin-ai/package.json
COPY packages/plugin-backlinks/package.json packages/plugin-backlinks/package.json
COPY packages/plugin-calendar/package.json packages/plugin-calendar/package.json
COPY packages/plugin-daily-notes/package.json packages/plugin-daily-notes/package.json
COPY packages/plugin-database/package.json packages/plugin-database/package.json
COPY packages/plugin-excalidraw/package.json packages/plugin-excalidraw/package.json
COPY packages/plugin-focus-mode/package.json packages/plugin-focus-mode/package.json
COPY packages/plugin-graph/package.json packages/plugin-graph/package.json
COPY packages/plugin-kanban/package.json packages/plugin-kanban/package.json
COPY packages/plugin-mermaid/package.json packages/plugin-mermaid/package.json
COPY packages/plugin-pdf-export/package.json packages/plugin-pdf-export/package.json
COPY packages/plugin-slides/package.json packages/plugin-slides/package.json
COPY packages/plugin-spaced-repetition/package.json packages/plugin-spaced-repetition/package.json
COPY packages/plugin-templates/package.json packages/plugin-templates/package.json
COPY packages/plugin-web-clipper/package.json packages/plugin-web-clipper/package.json

RUN pnpm install --frozen-lockfile

# ── Builder ──────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules

# Copy full source (respects .dockerignore)
COPY . .

# Generate Prisma client via NX target
RUN pnpm nx run server:prisma-generate

# Build NestJS server using SWC (transpile-only, no type checking)
# Type checking runs separately in CI via `pnpm type-check`
RUN cd apps/server && pnpm nest build --config nest-cli.docker.json

# ── Runner ───────────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk add --no-cache openssl

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

# Copy node_modules from builder (includes generated Prisma client)
# Note: using builder's node_modules rather than a separate prod-deps stage
# because pnpm's .pnpm store with generated Prisma client is complex to extract.
# The additional image size is acceptable for development/staging builds.
COPY --from=builder /app/node_modules ./node_modules

# Copy compiled server
COPY --from=builder /app/apps/server/dist ./dist

# Copy Prisma schema and migrations for runtime migrate deploy
COPY --from=builder /app/apps/server/prisma ./prisma

# Create storage directory for notes
RUN mkdir -p /var/lib/notesaner/workspaces && chown -R nestjs:nestjs /var/lib/notesaner

USER nestjs

EXPOSE 4000

# Run Prisma migrations then start the server
# Use direct binary path instead of npx for explicit dependency resolution
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
