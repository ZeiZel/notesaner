# ============================================================
# Notesaner Web — Next.js (standalone) multi-stage Dockerfile
# ============================================================
# Build context: repository root (not apps/web/)
# Usage: docker build -f apps/web/Dockerfile .
# ============================================================

# ── Base ──────────────────────────────────────────────────────
FROM node:22-alpine AS base

RUN corepack enable && corepack prepare pnpm@10.12.4 --activate
RUN apk add --no-cache libc6-compat

# Disable husky git hooks in CI/Docker
ENV HUSKY=0

WORKDIR /app

# ── Builder ──────────────────────────────────────────────────
# Single stage: install deps + build in one stage to avoid
# pnpm symlink issues when copying node_modules between stages.
FROM base AS builder

WORKDIR /app

# Copy full source first (respects .dockerignore)
COPY . .

# Install all dependencies
RUN pnpm install --frozen-lockfile

# Build Next.js in standalone mode
# - NEXT_BUNDLER=webpack: avoid Turbopack middleware bug in Next.js 16
# - next build runs via NX executor
# - TS/ESLint checks are disabled in next.config.ts (run separately in CI)
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV NEXT_BUNDLER=webpack

RUN pnpm nx build web

# ── Runner ───────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (includes node_modules needed at runtime)
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# Next.js standalone server entry point
CMD ["node", "apps/web/server.js"]
