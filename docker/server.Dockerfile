# =============================================================================
# Notesaner — Server Dockerfile (consumes pre-built dist/)
#
# Expects artifacts to already exist on the host:
#   dist/apps/server/   — compiled NestJS output (from pnpm nx build server)
#
# Build from repo root:
#   pnpm nx build server --configuration=production
#   docker build -f docker/server.Dockerfile -t notesaner/server .
# =============================================================================

# ── Production node_modules only ─────────────────────────────────────────────
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# Copy lockfiles and workspace manifests for production install
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY libs/contracts/package.json ./libs/contracts/
COPY libs/constants/package.json ./libs/constants/
COPY libs/utils/package.json ./libs/utils/
COPY libs/sync-engine/package.json ./libs/sync-engine/
COPY libs/markdown/package.json ./libs/markdown/
COPY libs/plugin-sdk/package.json ./libs/plugin-sdk/

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# ── Prisma generate (needs schema + node_modules) ────────────────────────────
FROM deps AS prisma
COPY apps/server/prisma ./apps/server/prisma
RUN pnpm prisma generate --schema=apps/server/prisma/schema.prisma

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

# Copy pre-built server artifacts from host dist/
COPY dist/apps/server ./

# Copy production node_modules
COPY --from=prisma /app/node_modules ./node_modules

# Copy prisma schema (needed for migrate deploy at runtime)
COPY --from=prisma /app/apps/server/prisma ./prisma

# Copy entrypoint script
COPY docker/entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh && \
    mkdir -p /data/notes && chown nestjs:nodejs /data/notes

USER nestjs
EXPOSE 4000

# Entrypoint runs prisma migrate deploy before starting the app.
# Prisma uses advisory locks to prevent concurrent migration runs.
ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["node", "main.js"]
