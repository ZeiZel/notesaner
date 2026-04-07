# =============================================================================
# Notesaner — Web Dockerfile (consumes pre-built dist/)
#
# Expects NX build output:
#   pnpm nx build web --configuration=production
#   => dist/apps/web/ contains Next.js standalone output (server.js + node_modules)
#   => apps/web/.next/static/ contains static assets (not copied to dist/ by NX)
#   => apps/web/public/ contains public assets
#
# Build from repo root:
#   docker build -f docker/web.Dockerfile -t notesaner/web .
# =============================================================================

# ── Runner ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy Next.js standalone build from NX output (server.js + node_modules)
COPY dist/apps/web ./

# Copy static assets — Next.js standalone doesn't bundle .next/static; NX
# leaves them at apps/web/.next/static rather than copying to dist/.
COPY apps/web/.next/static ./apps/web/.next/static
COPY apps/web/public ./apps/web/public

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
