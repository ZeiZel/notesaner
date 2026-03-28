# Self-Hosting Guide

Complete guide for deploying Notesaner on your own infrastructure.

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start](#2-quick-start)
3. [Configuration](#3-configuration)
4. [Database Setup](#4-database-setup)
5. [Authentication](#5-authentication)
6. [Storage](#6-storage)
7. [Reverse Proxy](#7-reverse-proxy)
8. [SSL/TLS](#8-ssltls)
9. [Backup & Restore](#9-backup--restore)
10. [Upgrading](#10-upgrading)
11. [Monitoring](#11-monitoring)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. Prerequisites

### Hardware Requirements

| Component | Minimum   | Recommended |
| --------- | --------- | ----------- |
| CPU       | 2 cores   | 4+ cores    |
| RAM       | 2 GB      | 4+ GB       |
| Disk      | 20 GB SSD | 50+ GB SSD  |
| Network   | 10 Mbps   | 100+ Mbps   |

Storage requirements scale with the number of notes and attachments. Plan for approximately 1 GB per 10,000 markdown notes with attachments.

### Software Requirements

- **Docker** 24.0+ with Docker Compose v2
- **Domain name** with DNS configured (for production use)
- **Ports**: 80 and 443 available (or custom ports behind a reverse proxy)

### Verify Docker Installation

```bash
docker --version
# Docker version 24.0.0 or higher

docker compose version
# Docker Compose version v2.20.0 or higher
```

### Domain Setup

Point your domain to the server's IP address:

```
notesaner.example.com  A  203.0.113.10
```

If you want to use separate subdomains for the frontend and API:

```
notesaner.example.com      A  203.0.113.10
api.notesaner.example.com  A  203.0.113.10
```

---

## 2. Quick Start

The fastest way to get Notesaner running with Docker Compose.

### Step 1: Create a project directory

```bash
mkdir notesaner && cd notesaner
```

### Step 2: Create the environment file

```bash
cat > .env << 'EOF'
# ── Required ────────────────────────────────────────────────────
DATABASE_URL=postgresql://notesaner:CHANGE_ME_DB_PASSWORD@postgres:5432/notesaner
JWT_SECRET=CHANGE_ME_USE_OPENSSL_RAND_BASE64_32
FRONTEND_URL=http://localhost:3000
ALLOWED_ORIGINS=http://localhost:3000

# ── Database ────────────────────────────────────────────────────
DB_PASSWORD=CHANGE_ME_DB_PASSWORD

# ── Optional ────────────────────────────────────────────────────
NODE_ENV=production
PORT=4000
LOG_LEVEL=info
EOF
```

Generate a secure JWT secret:

```bash
openssl rand -base64 32
```

Generate a secure database password:

```bash
openssl rand -base64 24
```

Replace `CHANGE_ME_DB_PASSWORD` (in both `DATABASE_URL` and `DB_PASSWORD`) and `CHANGE_ME_USE_OPENSSL_RAND_BASE64_32` with the generated values.

### Step 3: Create docker-compose.yml

```yaml
services:
  web:
    image: ghcr.io/your-org/notesaner/web:latest
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=http://server:4000
    depends_on:
      server:
        condition: service_healthy
    restart: unless-stopped

  server:
    image: ghcr.io/your-org/notesaner/server:latest
    ports:
      - '4000:4000'
    environment:
      - DATABASE_URL=postgresql://notesaner:${DB_PASSWORD}@postgres:5432/notesaner
      - VALKEY_URL=redis://valkey:6379
      - JWT_SECRET=${JWT_SECRET}
      - FRONTEND_URL=${FRONTEND_URL}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
      - STORAGE_ROOT=/data/workspaces
      - NODE_ENV=production
      - LOG_LEVEL=${LOG_LEVEL:-info}
    volumes:
      - notes_data:/data/workspaces
      - backup_data:/var/lib/notesaner/backups
    depends_on:
      postgres:
        condition: service_healthy
      valkey:
        condition: service_healthy
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:4000/health']
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notesaner
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: notesaner
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U notesaner']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  valkey:
    image: valkey/valkey:8-alpine
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ['CMD', 'valkey-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  notes_data:
  backup_data:
  postgres_data:
  valkey_data:
```

### Step 4: Start the services

```bash
docker compose up -d
```

### Step 5: Run database migrations

```bash
docker compose exec server npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### Step 6: Verify the installation

```bash
# Check all services are running
docker compose ps

# Verify the API health check
curl http://localhost:4000/health
# Expected: {"status":"ok","timestamp":"2026-03-28T12:00:00.000Z"}

# Open the web interface
# Visit http://localhost:3000 in your browser
```

---

## 3. Configuration

All configuration is done through environment variables on the server container. Variables are validated at startup using Zod schemas. The server will refuse to start if required variables are missing or invalid.

### Required Variables

| Variable       | Description                          | Example                                               |
| -------------- | ------------------------------------ | ----------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string         | `postgresql://notesaner:pass@postgres:5432/notesaner` |
| `JWT_SECRET`   | JWT signing key (min. 32 characters) | Output of `openssl rand -base64 32`                   |

### Server

| Variable          | Description                                                           | Default                 |
| ----------------- | --------------------------------------------------------------------- | ----------------------- |
| `NODE_ENV`        | Runtime environment                                                   | `development`           |
| `PORT`            | Server listen port                                                    | `4000`                  |
| `FRONTEND_URL`    | Full URL of the web frontend (used in email links)                    | `http://localhost:3000` |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins                          | `http://localhost:3000` |
| `LOG_LEVEL`       | Logging verbosity: `trace`, `debug`, `info`, `warn`, `error`, `fatal` | `info`                  |

### Database (PostgreSQL)

| Variable       | Description                             | Default |
| -------------- | --------------------------------------- | ------- |
| `DATABASE_URL` | PostgreSQL connection string (required) | --      |

### Cache (ValKey / Redis)

ValKey is a Redis-compatible cache used for sessions, rate limiting, and BullMQ job queues.

| Variable         | Description                            | Default                         |
| ---------------- | -------------------------------------- | ------------------------------- |
| `VALKEY_URL`     | Full connection URL (takes precedence) | Constructed from `REDIS_*` vars |
| `REDIS_HOST`     | ValKey/Redis hostname                  | `localhost`                     |
| `REDIS_PORT`     | ValKey/Redis port                      | `6379`                          |
| `REDIS_PASSWORD` | ValKey/Redis password                  | --                              |
| `REDIS_DB`       | ValKey/Redis database number           | `0`                             |

If `VALKEY_URL` is set, it is used directly. Otherwise the URL is constructed as `redis://{REDIS_HOST}:{REDIS_PORT}/{REDIS_DB}`.

### JWT / Authentication Tokens

| Variable                | Description                                | Default             |
| ----------------------- | ------------------------------------------ | ------------------- |
| `JWT_SECRET`            | Signing key (min. 32 characters, required) | --                  |
| `JWT_ACCESS_TOKEN_TTL`  | Access token lifetime in seconds           | `900` (15 min)      |
| `JWT_REFRESH_TOKEN_TTL` | Refresh token lifetime in seconds          | `2592000` (30 days) |

### Registration & Auth

| Variable                     | Description                                  | Default     |
| ---------------------------- | -------------------------------------------- | ----------- |
| `ALLOW_REGISTRATION`         | Allow new user sign-ups (`true`/`false`)     | `true`      |
| `REQUIRE_EMAIL_VERIFICATION` | Require email verification (`true`/`false`)  | `true`      |
| `TOTP_APP_NAME`              | App name shown in authenticator apps for 2FA | `Notesaner` |

### Storage

| Variable       | Description                                | Default                         |
| -------------- | ------------------------------------------ | ------------------------------- |
| `STORAGE_ROOT` | Filesystem path for workspace note storage | `/var/lib/notesaner/workspaces` |

### Rate Limiting

Rate limits are enforced globally via ValKey-backed throttler storage, ensuring consistent limits across multiple server instances.

| Variable                        | Description                              | Default |
| ------------------------------- | ---------------------------------------- | ------- |
| `RATE_LIMIT_GLOBAL`             | Max requests per window (global)         | `100`   |
| `RATE_LIMIT_GLOBAL_TTL`         | Window duration in seconds (global)      | `60`    |
| `RATE_LIMIT_AUTH`               | Max requests per window (auth endpoints) | `5`     |
| `RATE_LIMIT_AUTH_TTL`           | Window duration in seconds (auth)        | `60`    |
| `RATE_LIMIT_SEARCH`             | Max requests per window (search)         | `30`    |
| `RATE_LIMIT_SEARCH_TTL`         | Window duration in seconds (search)      | `60`    |
| `RATE_LIMIT_UPLOAD`             | Max requests per window (upload)         | `10`    |
| `RATE_LIMIT_UPLOAD_TTL`         | Window duration in seconds (upload)      | `60`    |
| `RATE_LIMIT_WS_MAX_CONNECTIONS` | Max WebSocket connections per user       | `5`     |

### Account Lockout

| Variable                       | Description                          | Default         |
| ------------------------------ | ------------------------------------ | --------------- |
| `ACCOUNT_LOCKOUT_MAX_ATTEMPTS` | Failed login attempts before lockout | `10`            |
| `ACCOUNT_LOCKOUT_DURATION`     | Lockout duration in seconds          | `1800` (30 min) |
| `ACCOUNT_LOCKOUT_WINDOW`       | Attempt counting window in seconds   | `3600` (1 hour) |

### Security Headers

| Variable                      | Description                                  | Default               |
| ----------------------------- | -------------------------------------------- | --------------------- |
| `SECURITY_CSP`                | Custom Content-Security-Policy header value  | `""` (server default) |
| `SECURITY_CSP_REPORT_ONLY`    | Use CSP in report-only mode (`true`/`false`) | `false`               |
| `SECURITY_HSTS_MAX_AGE`       | HSTS max-age in seconds                      | `31536000` (1 year)   |
| `SECURITY_PERMISSIONS_POLICY` | Permissions-Policy header value              | `""`                  |
| `SECURITY_CSRF_ENABLED`       | Enable CSRF protection (`true`/`false`)      | `true`                |
| `SECURITY_CSRF_COOKIE_NAME`   | CSRF cookie name                             | `_csrf`               |
| `SECURITY_CSRF_HEADER_NAME`   | CSRF header name                             | `x-csrf-token`        |

### OpenTelemetry (Tracing)

| Variable                      | Description                                   | Default                 |
| ----------------------------- | --------------------------------------------- | ----------------------- |
| `OTEL_ENABLED`                | Enable OpenTelemetry tracing (`true`/`false`) | `true`                  |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OTLP collector HTTP endpoint                  | `http://localhost:4318` |
| `OTEL_SERVICE_NAME`           | Service name in traces                        | `notesaner-server`      |

### Backup & Disaster Recovery

| Variable                   | Description                                 | Default                      |
| -------------------------- | ------------------------------------------- | ---------------------------- |
| `BACKUP_ENABLED`           | Enable automated backups (`true`/`false`)   | `false`                      |
| `BACKUP_LOCAL_PATH`        | Local directory for backup archives         | `/var/lib/notesaner/backups` |
| `BACKUP_ENCRYPTION_KEY`    | AES-256 encryption key (64-char hex string) | `""` (no encryption)         |
| `BACKUP_ALERT_EMAIL`       | Email address for backup failure alerts     | --                           |
| `BACKUP_PG_DUMP_PATH`      | Path to `pg_dump` binary                    | `pg_dump`                    |
| `BACKUP_RETENTION_DAILY`   | Number of daily backups to retain           | `7`                          |
| `BACKUP_RETENTION_WEEKLY`  | Number of weekly backups to retain          | `4`                          |
| `BACKUP_RETENTION_MONTHLY` | Number of monthly backups to retain         | `3`                          |

### Backup S3-Compatible Storage (Optional)

Omit all S3 variables to use local-only backups.

| Variable                      | Description                    | Default     |
| ----------------------------- | ------------------------------ | ----------- |
| `BACKUP_S3_ENDPOINT`          | S3-compatible endpoint URL     | --          |
| `BACKUP_S3_REGION`            | AWS region or equivalent       | `us-east-1` |
| `BACKUP_S3_BUCKET`            | Bucket name for backup storage | --          |
| `BACKUP_S3_ACCESS_KEY_ID`     | S3 access key                  | --          |
| `BACKUP_S3_SECRET_ACCESS_KEY` | S3 secret key                  | --          |
| `BACKUP_S3_PREFIX`            | Key prefix inside the bucket   | `backups`   |

### GitHub (Plugin Registry)

| Variable       | Description                                             | Default |
| -------------- | ------------------------------------------------------- | ------- |
| `GITHUB_TOKEN` | GitHub personal access token for plugin registry access | --      |

### Frontend (Web Container)

| Variable              | Description                                            | Example                             |
| --------------------- | ------------------------------------------------------ | ----------------------------------- |
| `NEXT_PUBLIC_API_URL` | URL of the API server (from the browser's perspective) | `https://api.notesaner.example.com` |
| `NEXT_PUBLIC_WS_URL`  | WebSocket URL for real-time sync                       | `wss://api.notesaner.example.com`   |

---

## 4. Database Setup

### PostgreSQL with Docker (Recommended)

The Docker Compose setup from the Quick Start section includes PostgreSQL 17. The database is automatically created on first start.

### External PostgreSQL

To use an existing PostgreSQL server instead of the Docker container:

1. Create the database and user:

```sql
CREATE USER notesaner WITH PASSWORD 'your-secure-password';
CREATE DATABASE notesaner OWNER notesaner;
GRANT ALL PRIVILEGES ON DATABASE notesaner TO notesaner;
```

2. Set the connection string in your `.env`:

```bash
DATABASE_URL=postgresql://notesaner:your-secure-password@your-db-host:5432/notesaner
```

3. Remove the `postgres` service from `docker-compose.yml` and remove the `depends_on` reference to it from the `server` service.

### Running Migrations

Migrations must be run after first deployment and after every upgrade:

```bash
docker compose exec server npx prisma migrate deploy --schema=./prisma/schema.prisma
```

### PostgreSQL Tuning

For production deployments, consider adjusting these PostgreSQL parameters based on available RAM:

```ini
# postgresql.conf or pass via Docker environment / command
shared_buffers = 1GB            # 25% of available RAM
effective_cache_size = 3GB      # 75% of available RAM
work_mem = 16MB
maintenance_work_mem = 256MB
wal_buffers = 16MB
max_connections = 200
```

To apply custom settings in Docker Compose, add a `command` to the postgres service:

```yaml
postgres:
  image: postgres:17-alpine
  command:
    - 'postgres'
    - '-c'
    - 'shared_buffers=1GB'
    - '-c'
    - 'effective_cache_size=3GB'
    - '-c'
    - 'work_mem=16MB'
    - '-c'
    - 'maintenance_work_mem=256MB'
  # ... rest of configuration
```

### Connection Pooling

For deployments with many concurrent users, add PgBouncer:

```yaml
pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DATABASE_URL: postgresql://notesaner:${DB_PASSWORD}@postgres:5432/notesaner
    MAX_CLIENT_CONN: 200
    DEFAULT_POOL_SIZE: 20
    POOL_MODE: transaction
  depends_on:
    postgres:
      condition: service_healthy
```

Then point the server `DATABASE_URL` at PgBouncer instead of directly at PostgreSQL.

---

## 5. Authentication

Notesaner supports three authentication methods: local (email/password), SAML, and OIDC. Authentication providers are configured via the admin API at runtime and stored in the database.

### Local Authentication

Local authentication is enabled by default. Users register with email and password. Configure registration behavior with:

```bash
ALLOW_REGISTRATION=true           # Set to false to disable self-registration
REQUIRE_EMAIL_VERIFICATION=true   # Set to false to skip email verification
```

### OIDC (OpenID Connect)

OIDC works with any compliant provider: Keycloak, Authentik, Google, Azure AD, Okta, and others.

#### Keycloak Setup

1. In Keycloak, create a new Client:
   - **Client ID**: `notesaner`
   - **Client Protocol**: `openid-connect`
   - **Access Type**: `confidential`
   - **Valid Redirect URIs**: `https://notesaner.example.com/api/auth/oidc/callback`
   - **Web Origins**: `https://notesaner.example.com`

2. Copy the client secret from the Credentials tab.

3. Register the provider via the admin API:

```bash
curl -X POST https://notesaner.example.com/api/admin/auth-providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OIDC",
    "name": "Keycloak",
    "isEnabled": true,
    "config": {
      "issuer": "https://keycloak.example.com/realms/your-realm",
      "clientId": "notesaner",
      "clientSecret": "your-client-secret",
      "callbackUrl": "https://notesaner.example.com/api/auth/oidc/callback",
      "scopes": ["openid", "email", "profile"]
    }
  }'
```

#### Authentik Setup

1. In Authentik, create a new OAuth2/OpenID Provider:
   - **Name**: `Notesaner`
   - **Authorization flow**: implicit consent (or explicit if desired)
   - **Client ID**: auto-generated (copy this)
   - **Client Secret**: auto-generated (copy this)
   - **Redirect URIs**: `https://notesaner.example.com/api/auth/oidc/callback`
   - **Scopes**: `openid email profile`

2. Create an Application linked to this provider.

3. Register the provider via the admin API:

```bash
curl -X POST https://notesaner.example.com/api/admin/auth-providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "OIDC",
    "name": "Authentik",
    "isEnabled": true,
    "config": {
      "issuer": "https://authentik.example.com/application/o/notesaner/",
      "clientId": "your-client-id",
      "clientSecret": "your-client-secret",
      "callbackUrl": "https://notesaner.example.com/api/auth/oidc/callback",
      "scopes": ["openid", "email", "profile"]
    }
  }'
```

#### Generic OIDC Provider

Any standards-compliant OIDC provider can be used. The required configuration fields are:

| Field          | Required | Description                                                        |
| -------------- | -------- | ------------------------------------------------------------------ |
| `issuer`       | Yes      | OIDC issuer URL (must expose `/.well-known/openid-configuration`)  |
| `clientId`     | Yes      | OAuth2 client ID                                                   |
| `clientSecret` | Yes      | OAuth2 client secret (for confidential clients)                    |
| `callbackUrl`  | No       | Callback URL (defaults to `{FRONTEND_URL}/api/auth/oidc/callback`) |
| `scopes`       | No       | OAuth2 scopes (default: `["openid", "email", "profile"]`)          |
| `emailClaim`   | No       | Claim name for email (default: `email`)                            |
| `nameClaim`    | No       | Claim name for display name (default: `name`)                      |

### SAML

SAML authentication is supported for enterprise identity providers.

#### SAML Provider Configuration

Register a SAML provider via the admin API:

```bash
curl -X POST https://notesaner.example.com/api/admin/auth-providers \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "SAML",
    "name": "Corporate SSO",
    "isEnabled": true,
    "config": {
      "ssoUrl": "https://idp.example.com/saml/sso",
      "entityId": "https://notesaner.example.com",
      "certificate": "-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----",
      "signRequests": false,
      "emailAttribute": "email",
      "nameAttribute": "displayName"
    }
  }'
```

#### SAML Configuration Fields

| Field            | Required | Description                                                |
| ---------------- | -------- | ---------------------------------------------------------- |
| `ssoUrl`         | Yes      | IdP Single Sign-On URL                                     |
| `entityId`       | Yes      | Service Provider entity ID (typically your app's base URL) |
| `certificate`    | Yes      | IdP X.509 certificate in PEM format                        |
| `signRequests`   | No       | Sign SAML authentication requests (default: `false`)       |
| `emailAttribute` | No       | SAML attribute name for email (default: NameID)            |
| `nameAttribute`  | No       | SAML attribute name for display name                       |

### Workspace-Scoped Providers

Authentication providers can optionally be scoped to a specific workspace by passing a `workspaceId` in the creation request. Global providers (no `workspaceId`) are available to all workspaces.

### Disabling Local Authentication

To enforce SSO-only access, set `ALLOW_REGISTRATION=false` and configure your preferred OIDC or SAML provider. Existing local users will still be able to log in unless their accounts are deactivated via the admin API.

---

## 6. Storage

Notesaner stores markdown notes on the filesystem. The file is the source of truth -- metadata (tags, links, search indexes) is mirrored to PostgreSQL.

### Configuration

```bash
STORAGE_ROOT=/data/workspaces
```

Each workspace gets a subdirectory under `STORAGE_ROOT`. The directory structure mirrors the note hierarchy:

```
/data/workspaces/
  workspace-slug-1/
    welcome.md
    journal/
      2026-03-28.md
    projects/
      project-a.md
      project-a/
        attachments/
          diagram.png
  workspace-slug-2/
    ...
```

### Docker Volume

In Docker Compose, mount a named volume or bind mount to persist notes:

```yaml
server:
  volumes:
    # Named volume (recommended)
    - notes_data:/data/workspaces

    # Or bind mount to a specific host directory
    # - /srv/notesaner/workspaces:/data/workspaces
```

### Bind Mount (Direct Filesystem Access)

If you need direct filesystem access to notes (e.g., for git-based version control or external tooling), use a bind mount:

```yaml
server:
  volumes:
    - /srv/notesaner/workspaces:/data/workspaces
```

Ensure the directory exists and has the correct permissions:

```bash
sudo mkdir -p /srv/notesaner/workspaces
sudo chown 1001:1001 /srv/notesaner/workspaces
```

The UID/GID `1001` matches the `nestjs` user inside the server container.

### Network File Systems

NFS or CIFS mounts can be used for shared storage, but note that Yjs real-time sync relies on single-server file access. For multi-server deployments, use a shared filesystem that supports file locking.

---

## 7. Reverse Proxy

A reverse proxy is strongly recommended for production deployments. It handles SSL termination, serves static assets, and proxies WebSocket connections for real-time collaboration.

### Caddy (Recommended)

Caddy is the simplest option because it handles SSL certificates automatically.

#### Caddyfile

```
notesaner.example.com {
    # Frontend
    reverse_proxy /api/* server:4000
    reverse_proxy /health* server:4000
    reverse_proxy /metrics server:4000
    reverse_proxy /* web:3000
}
```

If the API and frontend are on the same domain, WebSocket connections are automatically proxied. For explicit WebSocket support:

```
notesaner.example.com {
    # API and WebSocket
    @api path /api/* /health* /metrics
    reverse_proxy @api server:4000

    # WebSocket (Yjs sync)
    @ws {
        path /ws/*
        header Connection *upgrade*
        header Upgrade websocket
    }
    reverse_proxy @ws server:4000

    # Frontend (everything else)
    reverse_proxy web:3000
}
```

#### Docker Compose Addition

```yaml
caddy:
  image: caddy:2-alpine
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./Caddyfile:/etc/caddy/Caddyfile:ro
    - caddy_data:/data
    - caddy_config:/config
  depends_on:
    - web
    - server
  restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

### Nginx

#### nginx.conf

```nginx
upstream web {
    server web:3000;
}

upstream api {
    server server:4000;
}

server {
    listen 80;
    server_name notesaner.example.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name notesaner.example.com;

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 50m;

    # API routes
    location /api/ {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check (no /api prefix)
    location /health {
        proxy_pass http://api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Prometheus metrics (no /api prefix)
    location /metrics {
        proxy_pass http://api;
        proxy_set_header Host $host;
        # Restrict to internal networks in production
        # allow 10.0.0.0/8;
        # deny all;
    }

    # WebSocket support for Yjs real-time sync
    location /ws/ {
        proxy_pass http://api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Frontend (catch-all)
    location / {
        proxy_pass http://web;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Docker Compose Addition

```yaml
nginx:
  image: nginx:alpine
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    - ./certs:/etc/nginx/certs:ro
  depends_on:
    - web
    - server
  restart: unless-stopped
```

### Traefik

#### docker-compose.yml labels

```yaml
server:
  labels:
    - 'traefik.enable=true'
    - 'traefik.http.routers.api.rule=Host(`notesaner.example.com`) && (PathPrefix(`/api`) || PathPrefix(`/health`) || PathPrefix(`/metrics`) || PathPrefix(`/ws`))'
    - 'traefik.http.routers.api.entrypoints=websecure'
    - 'traefik.http.routers.api.tls.certresolver=letsencrypt'
    - 'traefik.http.services.api.loadbalancer.server.port=4000'

web:
  labels:
    - 'traefik.enable=true'
    - 'traefik.http.routers.web.rule=Host(`notesaner.example.com`)'
    - 'traefik.http.routers.web.entrypoints=websecure'
    - 'traefik.http.routers.web.tls.certresolver=letsencrypt'
    - 'traefik.http.services.web.loadbalancer.server.port=3000'
    - 'traefik.http.routers.web.priority=1'

traefik:
  image: traefik:v3
  command:
    - '--providers.docker=true'
    - '--providers.docker.exposedbydefault=false'
    - '--entrypoints.web.address=:80'
    - '--entrypoints.websecure.address=:443'
    - '--entrypoints.web.http.redirections.entrypoint.to=websecure'
    - '--certificatesresolvers.letsencrypt.acme.email=admin@example.com'
    - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
    - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
  ports:
    - '80:80'
    - '443:443'
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
    - letsencrypt:/letsencrypt
  restart: unless-stopped
```

### Important: WebSocket Proxying

Real-time collaboration uses Yjs over WebSockets. Your reverse proxy **must**:

1. Support WebSocket upgrade (`Upgrade: websocket` header)
2. Set appropriate timeouts (WebSocket connections are long-lived)
3. Forward the `X-Real-IP` and `X-Forwarded-For` headers (the server has `trust proxy` enabled)

---

## 8. SSL/TLS

### Caddy (Automatic)

Caddy obtains and renews Let's Encrypt certificates automatically. No additional configuration is needed beyond the `Caddyfile` shown above.

### Certbot with Nginx

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Obtain certificate
sudo certbot --nginx -d notesaner.example.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot will modify your Nginx configuration to add SSL settings and set up automatic renewal via a systemd timer.

### Certbot Standalone (Docker)

If you are running everything in Docker, use a certbot container:

```yaml
certbot:
  image: certbot/certbot
  volumes:
    - ./certs:/etc/letsencrypt
    - certbot_webroot:/var/www/certbot
  entrypoint: >
    sh -c "certbot certonly --webroot --webroot-path=/var/www/certbot
    --email admin@example.com --agree-tos --no-eff-email
    -d notesaner.example.com
    && trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done"
```

Add the ACME challenge location to your Nginx config:

```nginx
server {
    listen 80;
    server_name notesaner.example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}
```

### Custom Certificates

For self-signed or enterprise CA certificates, mount them into the Nginx or Caddy container:

```yaml
nginx:
  volumes:
    - /path/to/fullchain.pem:/etc/nginx/certs/fullchain.pem:ro
    - /path/to/privkey.pem:/etc/nginx/certs/privkey.pem:ro
```

### Update Environment Variables

After enabling SSL, update your environment variables to use HTTPS:

```bash
FRONTEND_URL=https://notesaner.example.com
ALLOWED_ORIGINS=https://notesaner.example.com
```

And in the frontend container:

```bash
NEXT_PUBLIC_API_URL=https://notesaner.example.com
NEXT_PUBLIC_WS_URL=wss://notesaner.example.com
```

---

## 9. Backup & Restore

Notesaner includes a built-in backup system that handles both the PostgreSQL database and the workspace filesystem.

### Enabling Automated Backups

```bash
BACKUP_ENABLED=true
BACKUP_LOCAL_PATH=/var/lib/notesaner/backups
```

Mount a volume for backup storage:

```yaml
server:
  volumes:
    - backup_data:/var/lib/notesaner/backups
```

### Encryption

Backups are encrypted with AES-256-GCM when an encryption key is provided:

```bash
# Generate a 256-bit encryption key (64-char hex string)
openssl rand -hex 32

# Set it in your environment
BACKUP_ENCRYPTION_KEY=a1b2c3d4e5f6...  # 64 hex characters
```

**Store this key securely.** Backups encrypted with this key cannot be restored without it.

### Retention Policy

The backup scheduler creates daily, weekly, and monthly backups. Old backups are automatically pruned:

| Variable                   | Description             | Default |
| -------------------------- | ----------------------- | ------- |
| `BACKUP_RETENTION_DAILY`   | Daily backups to keep   | `7`     |
| `BACKUP_RETENTION_WEEKLY`  | Weekly backups to keep  | `4`     |
| `BACKUP_RETENTION_MONTHLY` | Monthly backups to keep | `3`     |

### S3-Compatible Storage

Backups can be uploaded to any S3-compatible storage (AWS S3, MinIO, Backblaze B2, Wasabi, etc.):

```bash
BACKUP_S3_ENDPOINT=https://s3.amazonaws.com     # or your MinIO endpoint
BACKUP_S3_REGION=us-east-1
BACKUP_S3_BUCKET=notesaner-backups
BACKUP_S3_ACCESS_KEY_ID=AKIA...
BACKUP_S3_SECRET_ACCESS_KEY=...
BACKUP_S3_PREFIX=backups
```

When S3 is configured, backups are stored both locally and remotely.

### Manual Backup

Trigger a manual backup via the admin API:

```bash
# Full backup (database + filesystem)
curl -X POST https://notesaner.example.com/api/admin/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "FULL"}'

# Database only
curl -X POST https://notesaner.example.com/api/admin/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "DATABASE"}'

# Filesystem only
curl -X POST https://notesaner.example.com/api/admin/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "FILESYSTEM"}'
```

### Checking Backup Status

```bash
# List all backups
curl https://notesaner.example.com/api/admin/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Check a specific backup job
curl https://notesaner.example.com/api/admin/backups/jobs/{jobId} \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Backup Verification

The system runs weekly restore-test verifications automatically. To trigger one manually:

```bash
curl -X POST https://notesaner.example.com/api/admin/backups/verify \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Manual Database Backup (pg_dump)

If you prefer managing database backups yourself:

```bash
# Backup
docker compose exec postgres pg_dump -U notesaner notesaner > backup_$(date +%Y%m%d).sql

# Compressed backup
docker compose exec postgres pg_dump -U notesaner -Fc notesaner > backup_$(date +%Y%m%d).dump
```

### Restore

#### Restoring a Database Backup

```bash
# From SQL dump
docker compose exec -T postgres psql -U notesaner notesaner < backup_20260328.sql

# From compressed dump
docker compose exec -T postgres pg_restore -U notesaner -d notesaner --clean backup_20260328.dump
```

#### Restoring Filesystem Notes

If using bind mounts, restore from your backup tool. If using Docker volumes:

```bash
# Stop the server first
docker compose stop server

# Restore files into the volume
docker run --rm \
  -v notesaner_notes_data:/data \
  -v /path/to/backup:/backup \
  alpine sh -c "rm -rf /data/* && cp -a /backup/workspaces/. /data/"

# Restart
docker compose start server
```

### Failure Alerts

Configure an email address to receive alerts when backups fail:

```bash
BACKUP_ALERT_EMAIL=admin@example.com
```

This requires a working email module configuration on the server.

---

## 10. Upgrading

### Standard Upgrade Process

1. **Read the release notes** for breaking changes at the [GitHub Releases](https://github.com/your-org/notesaner/releases) page.

2. **Create a backup** before upgrading:

```bash
# Trigger a full manual backup
curl -X POST https://notesaner.example.com/api/admin/backups \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type": "FULL"}'

# Or use pg_dump directly
docker compose exec postgres pg_dump -U notesaner -Fc notesaner > pre-upgrade-backup.dump
```

3. **Pull the new images**:

```bash
docker compose pull
```

4. **Stop the services**:

```bash
docker compose down
```

5. **Run database migrations**:

```bash
docker compose up -d postgres valkey
docker compose run --rm server npx prisma migrate deploy --schema=./prisma/schema.prisma
```

6. **Start all services**:

```bash
docker compose up -d
```

7. **Verify the upgrade**:

```bash
# Health check
curl http://localhost:4000/health

# Check logs for errors
docker compose logs --tail=50 server
docker compose logs --tail=50 web
```

### Pinning Versions

To upgrade to a specific version instead of `latest`:

```yaml
web:
  image: ghcr.io/your-org/notesaner/web:1.2.3

server:
  image: ghcr.io/your-org/notesaner/server:1.2.3
```

Version tags follow semver. Pinning to a specific version is recommended for production to avoid unexpected changes.

### Rolling Back

If an upgrade causes issues:

1. Restore the database from the pre-upgrade backup.
2. Change the image tags back to the previous version.
3. Restart services.

```bash
docker compose down

# Restore database
docker compose up -d postgres
docker compose exec -T postgres pg_restore -U notesaner -d notesaner --clean pre-upgrade-backup.dump

# Revert image tags in docker-compose.yml, then:
docker compose up -d
```

---

## 11. Monitoring

### Health Checks

The server exposes three health endpoints (no authentication required):

| Endpoint            | Purpose                                | Use Case                                   |
| ------------------- | -------------------------------------- | ------------------------------------------ |
| `GET /health`       | General health status                  | Reverse proxy, uptime monitoring           |
| `GET /health/live`  | Liveness probe                         | Kubernetes `livenessProbe`                 |
| `GET /health/ready` | Readiness probe (checks DB and ValKey) | Kubernetes `readinessProbe`, load balancer |

```bash
curl http://localhost:4000/health
# {"status":"ok","timestamp":"2026-03-28T12:00:00.000Z"}

curl http://localhost:4000/health/ready
# {"status":"ok","timestamp":"2026-03-28T12:00:00.000Z"}
```

### Prometheus Metrics

The server exposes Prometheus metrics at `GET /metrics` (no authentication required).

Available metrics:

| Metric                          | Type      | Description                                               |
| ------------------------------- | --------- | --------------------------------------------------------- |
| `http_request_duration_seconds` | Histogram | HTTP request latency by method, route, status code        |
| `http_errors_total`             | Counter   | HTTP error count (4xx, 5xx) by method, route, status code |
| `ws_connections_active`         | Gauge     | Current active WebSocket connections                      |
| `note_operations_total`         | Counter   | Note CRUD operations by type                              |
| `job_duration_seconds`          | Histogram | BullMQ job processing duration by queue, name, status     |
| Default Node.js metrics         | Various   | Memory, CPU, event loop, GC stats (via `prom-client`)     |

#### Prometheus Configuration

```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'notesaner'
    scrape_interval: 15s
    static_configs:
      - targets: ['server:4000']
    metrics_path: '/metrics'
```

#### Example Docker Compose Addition

```yaml
prometheus:
  image: prom/prometheus:latest
  volumes:
    - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
    - prometheus_data:/prometheus
  ports:
    - '9090:9090'
  restart: unless-stopped

grafana:
  image: grafana/grafana:latest
  volumes:
    - grafana_data:/var/lib/grafana
  ports:
    - '3001:3000'
  environment:
    - GF_SECURITY_ADMIN_PASSWORD=changeme
  restart: unless-stopped
```

### OpenTelemetry Tracing

The server sends distributed traces via OTLP when enabled. Traces cover HTTP requests, database queries (PostgreSQL), cache operations (ValKey/Redis), and NestJS internals.

```bash
OTEL_ENABLED=true
OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318
OTEL_SERVICE_NAME=notesaner-server
```

Health check, metrics, and Swagger endpoints are automatically excluded from tracing to reduce noise.

Compatible collectors: Jaeger, Tempo, Zipkin (with OTLP receiver), or any OpenTelemetry Collector.

#### Jaeger Example

```yaml
jaeger:
  image: jaegertracing/all-in-one:latest
  environment:
    COLLECTOR_OTLP_ENABLED: 'true'
  ports:
    - '16686:16686' # Jaeger UI
    - '4318:4318' # OTLP HTTP receiver
  restart: unless-stopped
```

### Structured Logging

The server produces structured JSON logs in production (via pino). In development mode, logs are pretty-printed.

```bash
LOG_LEVEL=info   # trace | debug | info | warn | error | fatal
```

Logs include:

- Correlation IDs (`X-Request-ID` header, auto-generated if absent)
- Request method, URL, status code, response time
- Automatic redaction of sensitive headers (`Authorization`, `Cookie`, `X-API-Key`)
- Separate log levels per status code (5xx = error, 4xx = warn, 2xx = info)

To view logs:

```bash
# All services
docker compose logs -f

# Server only, last 100 lines
docker compose logs --tail=100 -f server

# Filter for errors (structured JSON, pipe through jq)
docker compose logs server | grep '"level":50' | jq .
```

### External Monitoring

For uptime monitoring, configure your monitoring service to check:

- **Primary**: `GET https://notesaner.example.com/health` -- expect `{"status":"ok"}`
- **Database connectivity**: `GET https://notesaner.example.com/health/ready` -- expect `{"status":"ok"}`

---

## 12. Troubleshooting

### Common Issues

<details>
<summary>Server fails to start: "Configuration validation failed"</summary>

**Cause**: One or more required environment variables are missing or invalid.

**Solution**:

1. Check the error message in the logs -- it lists exactly which variables failed validation:
   ```bash
   docker compose logs server
   ```
2. Verify `DATABASE_URL` is a valid PostgreSQL connection string.
3. Verify `JWT_SECRET` is at least 32 characters.
4. Ensure all URLs (`FRONTEND_URL`, `ALLOWED_ORIGINS`, etc.) are valid.

</details>

<details>
<summary>Connection refused to database</summary>

**Cause**: PostgreSQL is not running, not ready yet, or the connection string is wrong.

**Solution**:

1. Check if PostgreSQL is running:
   ```bash
   docker compose ps postgres
   docker compose exec postgres pg_isready -U notesaner
   ```
2. Verify the `DATABASE_URL` password matches `POSTGRES_PASSWORD`.
3. If using an external database, ensure the host is reachable from within Docker:
   ```bash
   docker compose exec server sh -c "nc -zv your-db-host 5432"
   ```
4. Ensure the database `notesaner` exists:
   ```bash
   docker compose exec postgres psql -U notesaner -c "SELECT 1;"
   ```

</details>

<details>
<summary>CORS errors in the browser</summary>

**Cause**: The frontend URL does not match the `ALLOWED_ORIGINS` configuration.

**Solution**:

1. Verify `ALLOWED_ORIGINS` includes the exact URL shown in the browser address bar (including protocol and port):
   ```bash
   ALLOWED_ORIGINS=https://notesaner.example.com
   ```
2. If using multiple origins, separate with commas (no spaces):
   ```bash
   ALLOWED_ORIGINS=https://notesaner.example.com,https://admin.notesaner.example.com
   ```
3. Restart the server after changing:
   ```bash
   docker compose restart server
   ```

</details>

<details>
<summary>WebSocket connections fail (real-time sync not working)</summary>

**Cause**: The reverse proxy is not forwarding WebSocket upgrade requests.

**Solution**:

1. Verify your proxy passes the `Upgrade` and `Connection` headers. See the [Reverse Proxy](#7-reverse-proxy) section.
2. Check that `NEXT_PUBLIC_WS_URL` uses `wss://` (not `ws://`) when SSL is enabled.
3. Verify the WebSocket endpoint is reachable:
   ```bash
   curl -i -N \
     -H "Connection: Upgrade" \
     -H "Upgrade: websocket" \
     -H "Sec-WebSocket-Version: 13" \
     -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
     https://notesaner.example.com/ws/
   ```
4. Check proxy timeout settings -- WebSocket connections are long-lived and must not be timed out.

</details>

<details>
<summary>API returns 429 Too Many Requests</summary>

**Cause**: Rate limiting is active.

**Solution**:

1. Check the rate limit headers in the response:
   - `X-RateLimit-Limit`: maximum requests allowed
   - `X-RateLimit-Remaining`: remaining requests
   - `X-RateLimit-Reset`: time when the limit resets
   - `Retry-After`: seconds to wait
2. Increase limits via environment variables if needed (see [Rate Limiting](#rate-limiting)).
3. Ensure ValKey is running -- rate limiting uses ValKey for storage. If ValKey is down, rate limiting may behave unexpectedly:
   ```bash
   docker compose exec valkey valkey-cli ping
   # Expected: PONG
   ```

</details>

<details>
<summary>Account locked out after failed login attempts</summary>

**Cause**: Too many failed login attempts within the configured window.

**Solution**:

1. Wait for the lockout duration to expire (default: 30 minutes).
2. To adjust lockout settings:
   ```bash
   ACCOUNT_LOCKOUT_MAX_ATTEMPTS=10    # attempts before lockout
   ACCOUNT_LOCKOUT_DURATION=1800      # lockout duration (seconds)
   ACCOUNT_LOCKOUT_WINDOW=3600        # attempt counting window (seconds)
   ```
3. To clear a lockout immediately, flush the relevant key in ValKey:
   ```bash
   docker compose exec valkey valkey-cli KEYS "lockout:*"
   # Then delete the relevant key
   docker compose exec valkey valkey-cli DEL "lockout:user@example.com"
   ```

</details>

<details>
<summary>Backup fails with "pg_dump: command not found"</summary>

**Cause**: The `pg_dump` binary is not available in the server container.

**Solution**:

1. The server container may not include PostgreSQL client tools. Set `BACKUP_PG_DUMP_PATH` to the correct path, or install the client:
   ```bash
   docker compose exec server apk add --no-cache postgresql-client
   ```
2. Alternatively, run pg_dump from the PostgreSQL container directly (see [Manual Database Backup](#manual-database-backup-pgdump)).

</details>

<details>
<summary>Notes not persisting after container restart</summary>

**Cause**: The notes volume is not configured correctly.

**Solution**:

1. Verify the `notes_data` volume is defined and mounted:
   ```bash
   docker volume inspect notesaner_notes_data
   ```
2. Ensure `STORAGE_ROOT` matches the mount path inside the container.
3. Check file permissions:
   ```bash
   docker compose exec server ls -la /data/workspaces
   ```
   The directory must be writable by UID 1001 (the `nestjs` user).

</details>

<details>
<summary>OIDC/SAML login redirects to wrong URL</summary>

**Cause**: The callback URL registered with your identity provider does not match the actual server URL.

**Solution**:

1. Verify `FRONTEND_URL` is set to your production URL (including `https://`).
2. Check the auth provider's `callbackUrl` in the database matches your domain.
3. Verify the callback URL registered in your IdP (Keycloak, Authentik, etc.) matches exactly.
4. Common format: `https://notesaner.example.com/api/auth/oidc/callback`

</details>

### Diagnostic Commands

```bash
# Check all container statuses
docker compose ps

# View real-time logs
docker compose logs -f

# Enter the server container for debugging
docker compose exec server sh

# Check database connectivity
docker compose exec postgres pg_isready -U notesaner

# Check ValKey connectivity
docker compose exec valkey valkey-cli ping

# Inspect a Docker volume
docker volume inspect notesaner_notes_data

# Check resource usage
docker stats --no-stream
```

### Getting Help

- [GitHub Issues](https://github.com/your-org/notesaner/issues) -- report bugs and request features
- [GitHub Discussions](https://github.com/your-org/notesaner/discussions) -- ask questions and share configurations
