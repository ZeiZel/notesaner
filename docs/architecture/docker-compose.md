# Docker Configuration

## Architecture

```
[Internet] --> nginx:443 (TLS termination, HTTP/2)
           |-> /api/*  --> server:4000 (NestJS backend)     [backend-net]
           |-> /ws/*   --> server:4000 (WebSocket proxy)    [backend-net]
           \-> /*      --> web:3000    (Next.js frontend)   [frontend-net]

server:4000 --> postgres:5432                               [backend-net]
server:4000 --> valkey:6379                                 [backend-net]
```

### Network Isolation

- **frontend-net** (bridge): nginx <-> web (Next.js). Public-facing.
- **backend-net** (bridge, internal): nginx <-> server, server <-> postgres, server <-> valkey. Never exposed to host.

### Named Volumes

| Volume          | Mount                      | Purpose                          |
| --------------- | -------------------------- | -------------------------------- |
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL WAL + data            |
| `valkey_data`   | `/data`                    | ValKey AOF + RDB snapshots       |
| `notes_data`    | `/data/notes`              | Markdown notes (source of truth) |
| `nginx_certs`   | `/etc/nginx/certs`         | TLS certificates (certbot/ACME)  |
| `nginx_logs`    | `/var/log/nginx`           | Nginx access/error logs          |

## docker-compose.yml (Development)

Infrastructure-only compose for local development. Apps run via `pnpm nx serve`.

```yaml
services:
  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_USER: notesaner
      POSTGRES_PASSWORD: notesaner_dev
      POSTGRES_DB: notesaner
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U notesaner']
      interval: 5s
      timeout: 5s
      retries: 5

  valkey:
    image: valkey/valkey:8-alpine
    ports:
      - '6379:6379'
    volumes:
      - valkey_data:/data
    healthcheck:
      test: ['CMD', 'valkey-cli', 'ping']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  valkey_data:
```

## docker-compose.prod.yml (Production)

Full production stack at `docker/docker-compose.prod.yml`.

### Services

| Service  | Image                    | CPU                 | Memory               | Restart | Networks                  |
| -------- | ------------------------ | ------------------- | -------------------- | ------- | ------------------------- |
| postgres | postgres:17-alpine       | 1.0 (0.25 reserved) | 1G (256M reserved)   | always  | backend-net               |
| valkey   | valkey/valkey:8-alpine   | 0.5 (0.1 reserved)  | 512M (128M reserved) | always  | backend-net               |
| server   | ghcr.io/notesaner/server | 2.0 (0.25 reserved) | 1G (256M reserved)   | always  | backend-net               |
| web      | ghcr.io/notesaner/web    | 1.0 (0.1 reserved)  | 512M (128M reserved) | always  | frontend-net              |
| nginx    | nginx:1.27-alpine        | 0.5 (0.05 reserved) | 128M (32M reserved)  | always  | frontend-net, backend-net |

### Prerequisites

1. Copy and configure environment:

   ```bash
   cp docker/.env.example docker/.env
   chmod 600 docker/.env
   # Edit docker/.env with production values
   ```

2. Place TLS certificates:
   ```
   /etc/nginx/certs/fullchain.pem
   /etc/nginx/certs/privkey.pem
   ```

### Usage

```bash
# Start all services
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d

# Rolling update (zero-downtime)
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env pull
docker compose -f docker/docker-compose.prod.yml --env-file docker/.env up -d --no-deps --build web server

# View logs
docker compose -f docker/docker-compose.prod.yml logs -f server

# Backup volumes
docker run --rm -v notesaner-prod_postgres_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .
docker run --rm -v notesaner-prod_notes_data:/data -v $(pwd)/backups:/backup \
  alpine tar czf /backup/notes_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Security Features

- All services run with `no-new-privileges:true`
- Containers run as non-root users (nextjs:1001, nestjs:1001)
- PostgreSQL and ValKey are not exposed to host (backend-net only)
- ValKey dangerous commands are renamed with random tokens
- TLS 1.2+ only, strong cipher suites, HSTS preload
- Rate limiting on API (10r/s) and frontend (30r/s) endpoints
- Security headers: CSP, X-Frame-Options, X-Content-Type-Options

### Startup Order

```
postgres (healthy) --> server (healthy) --> web (healthy) --> nginx
valkey   (healthy) -/
```

Server entrypoint (`docker/entrypoint.sh`) runs `prisma migrate deploy` before starting the app.

## Dockerfile.web

Multi-stage build for the Next.js frontend:

1. **base**: Node 22 Alpine + pnpm
2. **deps**: Install dependencies with frozen lockfile
3. **builder**: Build Next.js standalone output
4. **runner**: Minimal runtime image (non-root user, port 3000)

## Dockerfile.server

Multi-stage build for the NestJS backend:

1. **base**: Node 22 Alpine + pnpm
2. **deps**: Install dependencies with frozen lockfile
3. **builder**: Build NestJS + generate Prisma client
4. **runner**: Minimal runtime image (non-root user, port 4000, entrypoint runs migrations)
