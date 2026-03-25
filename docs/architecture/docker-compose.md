# Docker Configuration

## docker-compose.yml (Development)

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notesaner
      POSTGRES_PASSWORD: notesaner_dev
      POSTGRES_DB: notesaner
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./apps/server/prisma/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notesaner"]
      interval: 5s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:8-alpine
    ports:
      - "6379:6379"
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  valkey_data:
```

## docker-compose.prod.yml (Production)

```yaml
services:
  web:
    build:
      context: .
      dockerfile: docker/Dockerfile.web
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://server:4000
    depends_on:
      server:
        condition: service_healthy

  server:
    build:
      context: .
      dockerfile: docker/Dockerfile.server
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://notesaner:${DB_PASSWORD}@postgres:5432/notesaner
      - VALKEY_URL=valkey://valkey:6379
      - JWT_SECRET=${JWT_SECRET}
      - NOTES_STORAGE_PATH=/data/notes
    volumes:
      - notes_data:/data/notes
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notesaner
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: notesaner
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U notesaner"]
      interval: 5s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:8-alpine
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ["CMD", "valkey-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  notes_data:
  postgres_data:
  valkey_data:
```

## Dockerfile.web

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json ./apps/web/
COPY libs/*/package.json ./libs/*/
COPY packages/*/package.json ./packages/*/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm nx build web --configuration=production

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]
```

## Dockerfile.server

```dockerfile
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate

FROM base AS deps
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/server/package.json ./apps/server/
COPY libs/*/package.json ./libs/*/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm nx build server --configuration=production
RUN pnpm prisma generate --schema=apps/server/prisma/schema.prisma

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nestjs
COPY --from=builder /app/dist/apps/server ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/server/prisma ./prisma
USER nestjs
EXPOSE 4000
CMD ["node", "main.js"]
```
