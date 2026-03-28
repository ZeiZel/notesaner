# Notesaner

A self-hosted, web-first note-taking platform with real-time collaboration, a plugin system, and Markdown as the source of truth. Think Obsidian, but multi-user and browser-native.

---

## Screenshots

> Coming soon. Placeholder for screenshots of the editor, graph view, and workspace dashboard.

---

## Features

### Core

- **Markdown-first** -- notes are stored as `.md` files on the filesystem; the file is always the source of truth
- **Real-time collaboration** -- Yjs CRDT over WebSocket for conflict-free multi-user editing
- **Rich editor** -- TipTap-based block editor with Markdown shortcuts, slash commands, and live preview
- **Full-text search** -- PostgreSQL-backed FTS with trigram support
- **Workspaces** -- isolated vaults with role-based access (Owner, Admin, Editor, Viewer)
- **Bi-directional links** -- `[[wiki-links]]`, `![[embeds]]`, `[markdown](links)`, and `[[note#^block]]` references
- **Graph view** -- interactive knowledge graph showing note connections
- **Version history** -- full content snapshots with diffs for every note
- **Note sharing** -- share individual notes via link (optionally password-protected) or with specific users
- **Comments** -- threaded, per-selection comments with resolved/unresolved state
- **Tags** -- workspace-scoped tags with color coding
- **Attachments** -- file uploads attached to notes
- **API keys** -- scoped programmatic access (READ / WRITE / ADMIN)

### Authentication

- Local email/password with TOTP 2FA
- SAML SSO (Keycloak, Authentik, Azure AD)
- OIDC SSO (Authentik, Google Workspace, Okta)
- Account lockout protection and rate limiting

### Plugin System

- GitHub-based plugin registry
- Sandboxed execution via iframes with `postMessage` API
- Per-workspace plugin installation and settings
- **Built-in plugins**: AI assistant, backlinks panel, calendar, daily notes, database views, Excalidraw drawings, focus mode, graph view, kanban boards, Mermaid diagrams, PDF export, presentation slides, spaced repetition, templates, web clipper

### Operations

- Built-in automated backup system (PostgreSQL + filesystem) with local and S3 storage
- Configurable retention policies (daily / weekly / monthly)
- Backup encryption (AES-256) and integrity verification
- OpenTelemetry distributed tracing
- Prometheus metrics with Grafana dashboards
- Structured JSON logging with Loki integration
- Docker Compose production deployment with Nginx reverse proxy

---

## Tech Stack

| Layer          | Technology                                                                                     |
| -------------- | ---------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 15 (App Router), React 19, TipTap, Ant Design, Tailwind CSS 4, Zustand, TanStack Query |
| Backend        | NestJS 11, Prisma 6, PostgreSQL 17, ValKey 8 (Redis-compatible)                                |
| Real-time sync | Yjs CRDT via WebSocket                                                                         |
| Monorepo       | NX 22, pnpm 10                                                                                 |
| Testing        | Vitest, Playwright                                                                             |
| Observability  | OpenTelemetry, Prometheus, Grafana, Loki                                                       |
| CI/CD          | GitHub Actions, Docker                                                                         |
| Language       | TypeScript (strict mode)                                                                       |

---

## Quick Start with Docker Compose

The fastest way to run Notesaner in production. See the [Self-Hosting Guide](#self-hosting-guide) below for full details.

```bash
# 1. Clone the repository
git clone https://github.com/notesaner/notesaner.git
cd notesaner

# 2. Create and configure your environment file
cp docker/.env.example docker/.env
# Edit docker/.env -- fill in REQUIRED values (passwords, JWT secret, domain)

# 3. Place TLS certificates (Let's Encrypt, etc.)
#    into docker/nginx/certs/ as fullchain.pem and privkey.pem

# 4. Start all services
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d

# 5. Run database migrations
docker compose -f docker/docker-compose.prod.yml exec server \
  npx prisma migrate deploy --schema=./prisma/schema.prisma
```

Your instance will be available at `https://<your-domain>`.

---

## Development Setup

### Prerequisites

| Requirement             | Version                                |
| ----------------------- | -------------------------------------- |
| Node.js                 | >= 22.0.0                              |
| pnpm                    | >= 10.0.0                              |
| PostgreSQL              | 17                                     |
| ValKey (or Redis)       | 8                                      |
| Docker & Docker Compose | Latest (for running Postgres + ValKey) |

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/notesaner/notesaner.git
cd notesaner

# 2. Install dependencies
pnpm install

# 3. Start PostgreSQL and ValKey via Docker
pnpm docker:up
# This starts postgres:17-alpine on :5432 and valkey/valkey:8-alpine on :6379

# 4. Configure the backend environment
cp apps/server/.env.example apps/server/.env
# The defaults connect to the Docker services above.
# Set JWT_SECRET to a random string (at least 32 chars).

# 5. Configure the root environment (frontend variables)
cp .env.example .env

# 6. Generate Prisma client and run migrations
pnpm db:generate
pnpm db:migrate

# 7. Start both frontend and backend dev servers
pnpm dev
# Or start them individually:
#   pnpm dev:web      -- Next.js on http://localhost:3000
#   pnpm dev:server   -- NestJS on http://localhost:4000
```

### Optional: Monitoring Stack

```bash
# Start Prometheus, Grafana, and Loki alongside the dev services
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Prometheus:  http://localhost:9090
# Grafana:     http://localhost:3001  (admin / admin)
# Loki:        http://localhost:3100
```

---

## Project Structure

```
notesaner/
├── apps/
│   ├── web/                    # Next.js 15 frontend (App Router)
│   │   ├── app/                # Next.js routing layer
│   │   ├── src/                # Feature-Sliced Design layers
│   │   │   ├── app/            #   Application-wide setup
│   │   │   ├── pages/          #   Page compositions
│   │   │   ├── widgets/        #   Self-contained UI blocks
│   │   │   ├── features/       #   User interactions
│   │   │   ├── entities/       #   Business entities
│   │   │   └── shared/         #   Shared UI, lib, config
│   │   └── playwright/         # E2E tests
│   └── server/                 # NestJS 11 backend
│       ├── src/                # Modules, services, controllers
│       │   └── config/         # Validated env configuration
│       └── prisma/             # Schema, migrations, seed
├── libs/
│   ├── contracts/              # Shared TypeScript types, DTOs, API contracts
│   ├── constants/              # Enums and constants
│   ├── utils/                  # Shared utility functions
│   ├── editor-core/            # TipTap editor configuration
│   ├── sync-engine/            # Yjs CRDT synchronization logic
│   ├── markdown/               # Markdown parser and renderer
│   ├── plugin-sdk/             # Plugin development SDK
│   └── query-factory/          # TanStack Query wrapper factory
├── packages/
│   ├── ui/                     # Shared UI component library (Storybook)
│   ├── plugin-ai/              # AI assistant plugin
│   ├── plugin-backlinks/       # Backlinks panel plugin
│   ├── plugin-calendar/        # Calendar plugin
│   ├── plugin-daily-notes/     # Daily notes plugin
│   ├── plugin-database/        # Database views plugin
│   ├── plugin-excalidraw/      # Excalidraw drawing plugin
│   ├── plugin-focus-mode/      # Focus/zen mode plugin
│   ├── plugin-graph/           # Knowledge graph plugin
│   ├── plugin-kanban/          # Kanban board plugin
│   ├── plugin-mermaid/         # Mermaid diagram plugin
│   ├── plugin-pdf-export/      # PDF export plugin
│   ├── plugin-slides/          # Presentation slides plugin
│   ├── plugin-spaced-repetition/ # Spaced repetition plugin
│   ├── plugin-templates/       # Note templates plugin
│   └── plugin-web-clipper/     # Web clipper plugin
├── docker/
│   ├── Dockerfile.server       # Multi-stage NestJS production build
│   ├── Dockerfile.web          # Multi-stage Next.js production build
│   ├── docker-compose.prod.yml # Full production stack
│   ├── nginx/                  # Nginx reverse proxy config
│   └── .env.example            # Production environment template
├── docker-compose.yml          # Dev services (Postgres + ValKey)
├── docker-compose.monitoring.yml # Prometheus + Grafana + Loki
├── .github/workflows/
│   ├── ci.yml                  # Lint, test, build on every push/PR
│   └── release.yml             # Build and push Docker images
├── nx.json                     # NX workspace configuration
├── package.json                # Root package scripts
└── pnpm-workspace.yaml         # pnpm workspace definition
```

---

## Available Commands

### Development

```bash
pnpm dev                        # Start both web and server dev servers
pnpm dev:web                    # Start Next.js frontend (port 3000)
pnpm dev:server                 # Start NestJS backend (port 4000)
```

### Build & Test

```bash
pnpm nx build <project>         # Build a specific project
pnpm nx test <project>          # Run unit tests for a project
pnpm nx lint <project>          # Lint a project
pnpm nx affected -t test        # Test only projects affected by changes
pnpm test                       # Run all unit tests via Vitest
pnpm lint                       # Lint all projects
pnpm type-check                 # Type-check all projects
```

### Database

```bash
pnpm db:generate                # Generate Prisma client
pnpm db:migrate                 # Run database migrations (dev)
pnpm db:push                    # Push schema changes without migrations
pnpm db:studio                  # Open Prisma Studio (database GUI)
```

### Docker

```bash
pnpm docker:up                  # Start dev services (Postgres + ValKey)
pnpm docker:down                # Stop dev services
```

### Other

```bash
pnpm format                     # Format all files with Prettier
pnpm format:check               # Check formatting without writing
pnpm storybook                  # Start Storybook for UI components
pnpm nx graph                   # Visualize the NX dependency graph
```

---

## Self-Hosting Guide

### System Requirements

| Resource       | Minimum                       | Recommended                |
| -------------- | ----------------------------- | -------------------------- |
| CPU            | 2 cores                       | 4 cores                    |
| RAM            | 2 GB                          | 4 GB                       |
| Disk           | 10 GB + note storage          | 40 GB SSD + note storage   |
| OS             | Any Linux with Docker support | Ubuntu 22.04+ / Debian 12+ |
| Docker         | 24.0+                         | Latest stable              |
| Docker Compose | v2.20+                        | Latest stable              |

### Installation

#### 1. Prepare the Server

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in for group changes to take effect

# Create the application directory
sudo mkdir -p /opt/notesaner
cd /opt/notesaner

# Clone or download the repository
git clone https://github.com/notesaner/notesaner.git .
```

#### 2. Configure Environment Variables

```bash
cp docker/.env.example docker/.env
chmod 600 docker/.env   # Restrict access -- this file contains secrets
```

Edit `docker/.env` and fill in all required values. See the [Environment Variables Reference](#environment-variables-reference) below.

#### 3. Set Up TLS Certificates

Option A: Let's Encrypt with certbot

```bash
sudo apt install certbot
sudo certbot certonly --standalone -d notesaner.example.com

# Copy certificates to the nginx certs volume location
sudo mkdir -p /opt/notesaner/docker/nginx/certs
sudo cp /etc/letsencrypt/live/notesaner.example.com/fullchain.pem \
        /opt/notesaner/docker/nginx/certs/fullchain.pem
sudo cp /etc/letsencrypt/live/notesaner.example.com/privkey.pem \
        /opt/notesaner/docker/nginx/certs/privkey.pem
```

Option B: Use your own certificates

```bash
mkdir -p /opt/notesaner/docker/nginx/certs
cp /path/to/your/fullchain.pem /opt/notesaner/docker/nginx/certs/fullchain.pem
cp /path/to/your/privkey.pem   /opt/notesaner/docker/nginx/certs/privkey.pem
```

#### 4. Start the Application

```bash
cd /opt/notesaner

# Pull and start all services
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d

# Run database migrations
docker compose -f docker/docker-compose.prod.yml exec server \
  npx prisma migrate deploy --schema=./prisma/schema.prisma

# Verify all containers are healthy
docker compose -f docker/docker-compose.prod.yml ps
```

#### 5. Create the First Admin User

```bash
# Enable registration temporarily (if ALLOW_REGISTRATION=false in .env)
# Then register through the web UI at https://your-domain.com

# After creating your account, disable public registration:
# Set ALLOW_REGISTRATION=false in docker/.env
docker compose -f docker/docker-compose.prod.yml up -d server
```

### Environment Variables Reference

#### Required Variables

| Variable              | Description                                  | Example                                   |
| --------------------- | -------------------------------------------- | ----------------------------------------- |
| `DOMAIN`              | Public domain for the application            | `notesaner.example.com`                   |
| `POSTGRES_USER`       | PostgreSQL username                          | `notesaner`                               |
| `POSTGRES_PASSWORD`   | PostgreSQL password (>= 32 chars)            | (generate with `openssl rand -base64 32`) |
| `POSTGRES_DB`         | PostgreSQL database name                     | `notesaner`                               |
| `VALKEY_PASSWORD`     | ValKey authentication password (>= 32 chars) | (generate with `openssl rand -base64 32`) |
| `VALKEY_CONFIG_TOKEN` | Token to rename dangerous ValKey commands    | (generate with `openssl rand -hex 16`)    |
| `JWT_SECRET`          | JWT signing secret (>= 64 chars)             | (generate with `openssl rand -base64 64`) |
| `FRONTEND_URL`        | Public frontend URL                          | `https://notesaner.example.com`           |
| `NEXT_PUBLIC_API_URL` | Public API URL                               | `https://notesaner.example.com/api`       |
| `NEXT_PUBLIC_WS_URL`  | Public WebSocket URL                         | `wss://notesaner.example.com/ws`          |

#### Optional Variables

| Variable                     | Default     | Description                                                           |
| ---------------------------- | ----------- | --------------------------------------------------------------------- |
| `REGISTRY`                   | `ghcr.io`   | Container image registry                                              |
| `IMAGE_ORG`                  | `notesaner` | Container image organization                                          |
| `IMAGE_TAG`                  | `latest`    | Container image tag                                                   |
| `HTTP_PORT`                  | `80`        | Host port for HTTP                                                    |
| `HTTPS_PORT`                 | `443`       | Host port for HTTPS                                                   |
| `ALLOW_REGISTRATION`         | `false`     | Allow new user sign-ups                                               |
| `REQUIRE_EMAIL_VERIFICATION` | `true`      | Require email verification before login                               |
| `JWT_ACCESS_TOKEN_TTL`       | `900`       | Access token lifetime in seconds (15 min)                             |
| `JWT_REFRESH_TOKEN_TTL`      | `2592000`   | Refresh token lifetime in seconds (30 days)                           |
| `LOG_LEVEL`                  | `info`      | Server log level (`trace`, `debug`, `info`, `warn`, `error`, `fatal`) |
| `VALKEY_MAX_MEMORY`          | `256mb`     | ValKey max memory before LRU eviction                                 |
| `GITHUB_TOKEN`               | (empty)     | GitHub PAT for plugin registry (read:packages scope)                  |

#### SAML SSO (Optional)

| Variable                | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `SAML_ENTITY_ID`        | Application Entity ID (must match IdP config)       |
| `SAML_SSO_URL`          | IdP Single Sign-On URL                              |
| `SAML_CERTIFICATE_PATH` | Path to IdP public certificate inside the container |

#### OIDC SSO (Optional)

| Variable             | Description              |
| -------------------- | ------------------------ |
| `OIDC_ISSUER`        | OIDC provider issuer URL |
| `OIDC_CLIENT_ID`     | OIDC client ID           |
| `OIDC_CLIENT_SECRET` | OIDC client secret       |

#### Backup Configuration (Optional)

| Variable                      | Default                      | Description                               |
| ----------------------------- | ---------------------------- | ----------------------------------------- |
| `BACKUP_ENABLED`              | `false`                      | Enable automated backups                  |
| `BACKUP_LOCAL_PATH`           | `/var/lib/notesaner/backups` | Local backup storage path                 |
| `BACKUP_ENCRYPTION_KEY`       | (empty)                      | 64-char hex string for AES-256 encryption |
| `BACKUP_ALERT_EMAIL`          | (empty)                      | Email for backup failure alerts           |
| `BACKUP_PG_DUMP_PATH`         | `pg_dump`                    | Path to pg_dump binary                    |
| `BACKUP_RETENTION_DAILY`      | `7`                          | Number of daily backups to keep           |
| `BACKUP_RETENTION_WEEKLY`     | `4`                          | Number of weekly backups to keep          |
| `BACKUP_RETENTION_MONTHLY`    | `3`                          | Number of monthly backups to keep         |
| `BACKUP_S3_ENDPOINT`          | (empty)                      | S3-compatible endpoint URL                |
| `BACKUP_S3_REGION`            | `us-east-1`                  | S3 region                                 |
| `BACKUP_S3_BUCKET`            | (empty)                      | S3 bucket name                            |
| `BACKUP_S3_ACCESS_KEY_ID`     | (empty)                      | S3 access key                             |
| `BACKUP_S3_SECRET_ACCESS_KEY` | (empty)                      | S3 secret key                             |
| `BACKUP_S3_PREFIX`            | `backups`                    | S3 key prefix for backup files            |

#### Rate Limiting (Optional)

| Variable                        | Default | Description                          |
| ------------------------------- | ------- | ------------------------------------ |
| `RATE_LIMIT_GLOBAL`             | `100`   | Max requests per window (global)     |
| `RATE_LIMIT_GLOBAL_TTL`         | `60`    | Window duration in seconds           |
| `RATE_LIMIT_AUTH`               | `5`     | Max auth requests per window         |
| `RATE_LIMIT_AUTH_TTL`           | `60`    | Auth window duration in seconds      |
| `RATE_LIMIT_SEARCH`             | `30`    | Max search requests per window       |
| `RATE_LIMIT_UPLOAD`             | `10`    | Max upload requests per window       |
| `RATE_LIMIT_WS_MAX_CONNECTIONS` | `5`     | Max WebSocket connections per user   |
| `ACCOUNT_LOCKOUT_MAX_ATTEMPTS`  | `10`    | Failed login attempts before lockout |
| `ACCOUNT_LOCKOUT_DURATION`      | `1800`  | Lockout duration in seconds (30 min) |

#### Security Headers (Optional)

| Variable                | Default    | Description                           |
| ----------------------- | ---------- | ------------------------------------- |
| `SECURITY_CSP`          | (empty)    | Custom Content-Security-Policy header |
| `SECURITY_HSTS_MAX_AGE` | `31536000` | HSTS max-age in seconds (1 year)      |
| `SECURITY_CSRF_ENABLED` | `true`     | Enable CSRF protection                |

#### Observability (Optional)

| Variable                      | Default                 | Description                  |
| ----------------------------- | ----------------------- | ---------------------------- |
| `OTEL_ENABLED`                | `true`                  | Enable OpenTelemetry tracing |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP exporter endpoint       |
| `OTEL_SERVICE_NAME`           | `notesaner-server`      | Service name in traces       |

### Reverse Proxy Setup

The production Docker Compose stack includes a pre-configured Nginx reverse proxy with:

- HTTP to HTTPS redirect (301)
- TLS 1.2 / 1.3 only with strong cipher suites
- OCSP stapling
- HTTP/2 support
- Gzip compression
- Security headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP, Referrer-Policy, Permissions-Policy)
- WebSocket proxy for real-time collaboration (`/ws`)
- API proxy (`/api/*`) with rate limiting (10 req/s per IP, burst 30)
- Frontend proxy with rate limiting (30 req/s per IP, burst 60)
- Long-lived cache for hashed Next.js static assets
- 50 MB client upload limit

The configuration is at `docker/nginx/nginx.conf`. Routing overview:

```
[Internet] --> nginx:443 (TLS termination)
            --> /api/*   --> server:4000 (NestJS backend)
            --> /ws/*    --> server:4000 (WebSocket, Yjs CRDT)
            --> /*       --> web:3000    (Next.js frontend)
```

#### Using Your Own Reverse Proxy

If you prefer to use your own reverse proxy (Traefik, Caddy, HAProxy, etc.), remove the `nginx` service from `docker/docker-compose.prod.yml` and expose the `web` and `server` containers on the `frontend-net` / `backend-net` networks as needed. Key requirements:

- Proxy `/api/*` and `/ws/*` to the `server` container on port `4000`
- Proxy everything else to the `web` container on port `3000`
- Enable WebSocket upgrade for `/ws` paths (`Upgrade` and `Connection` headers)
- Set `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` headers

### SMTP Configuration

Notesaner sends transactional emails for email verification, password resets, and backup failure alerts. Configure your SMTP provider by setting the appropriate environment variables in `docker/.env`. SMTP support is planned -- check the latest environment variable reference in `apps/server/src/config/validation.ts` for current options.

### Backup Guide

Notesaner has two categories of data that must be backed up:

1. **PostgreSQL database** -- user accounts, workspace metadata, note metadata, tags, links, comments, plugin settings
2. **Filesystem** -- the actual Markdown note files (mounted as the `notes_data` volume)

#### Built-in Backup System

Enable the automated backup system by setting these environment variables:

```bash
BACKUP_ENABLED=true
BACKUP_LOCAL_PATH=/var/lib/notesaner/backups

# Optional: encrypt backups (generate a 256-bit hex key)
BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)

# Optional: off-site backup to S3-compatible storage (MinIO, AWS S3, Backblaze B2)
BACKUP_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
BACKUP_S3_BUCKET=notesaner-backups
BACKUP_S3_ACCESS_KEY_ID=your-access-key
BACKUP_S3_SECRET_ACCESS_KEY=your-secret-key
```

The built-in system supports configurable retention policies:

| Category | Default Count | Description                       |
| -------- | ------------- | --------------------------------- |
| Daily    | 7             | One backup per day, keep last 7   |
| Weekly   | 4             | One backup per week, keep last 4  |
| Monthly  | 3             | One backup per month, keep last 3 |

#### Manual Backup

If you prefer to manage backups externally:

```bash
# PostgreSQL dump
docker compose -f docker/docker-compose.prod.yml exec postgres \
  pg_dump -U notesaner -d notesaner --format=custom \
  > backup-$(date +%Y%m%d-%H%M%S).dump

# Filesystem backup (note files)
docker run --rm \
  -v notesaner-prod_notes_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/notes-$(date +%Y%m%d-%H%M%S).tar.gz -C /data .
```

#### Restore

```bash
# Restore PostgreSQL
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_restore -U notesaner -d notesaner --clean --if-exists \
  < backup-20260328-120000.dump

# Restore filesystem
docker run --rm \
  -v notesaner-prod_notes_data:/data \
  -v $(pwd)/backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/notes-20260328-120000.tar.gz -C /data"
```

### Upgrade Guide

#### Standard Upgrade (Zero-Downtime)

```bash
cd /opt/notesaner

# 1. Pull the latest images
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env pull

# 2. Restart services (rolling update)
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env \
  up -d --no-deps --build web server

# 3. Run any new database migrations
docker compose -f docker/docker-compose.prod.yml exec server \
  npx prisma migrate deploy --schema=./prisma/schema.prisma

# 4. Verify health
docker compose -f docker/docker-compose.prod.yml ps
```

#### Pre-Upgrade Checklist

1. **Back up the database and filesystem** before every upgrade
2. Read the release notes for breaking changes
3. Compare your `docker/.env` with the latest `docker/.env.example` for new required variables
4. If using safe migrations: `docker compose exec server npm run migrate:safe:dry-run`

#### Rollback

If something goes wrong after an upgrade:

```bash
# Roll back to a specific image tag
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env \
  up -d --no-deps server=ghcr.io/notesaner/server:<previous-tag> \
                   web=ghcr.io/notesaner/web:<previous-tag>

# Restore the database from your backup if migrations were applied
docker compose -f docker/docker-compose.prod.yml exec -T postgres \
  pg_restore -U notesaner -d notesaner --clean --if-exists < your-backup.dump
```

---

## Contributing

Contributions are welcome. Please follow these guidelines:

1. **Fork** the repository and create your branch from `main`
2. **Install** dependencies with `pnpm install`
3. **Follow** the coding standards:
   - TypeScript strict mode
   - Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, etc.)
   - English in code, comments, and commit messages
   - Zod for runtime validation at system boundaries
   - Feature-Sliced Design on the frontend
4. **Write tests** for new features and bug fixes
5. **Run checks** before submitting:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   ```
6. **Open a pull request** with a clear description of your changes

---

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPL-3.0)](https://www.gnu.org/licenses/agpl-3.0.html).
