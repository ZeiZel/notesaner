---
title: Docker Compose (Recommended)
description: Full docker-compose.yml walkthrough for deploying Notesaner.
---

# Docker Compose Setup

Docker Compose is the recommended way to deploy Notesaner. It manages all services (web, server, PostgreSQL, ValKey) together.

## Quick Start

```bash
# Clone the repo
git clone https://github.com/notesaner/notesaner.git
cd notesaner

# Copy environment template
cp .env.example .env

# Edit required values
nano .env

# Start all services
docker compose up -d

# Check status
docker compose ps
```

## docker-compose.yml

```yaml
version: '3.9'

services:
  web:
    image: notesaner/web:latest
    ports:
      - '3000:3000'
    environment:
      - NEXT_PUBLIC_API_URL=http://server:3001
    depends_on:
      - server
    restart: unless-stopped

  server:
    image: notesaner/server:latest
    ports:
      - '3001:3001'
    environment:
      - DATABASE_URL=postgresql://notesaner:${POSTGRES_PASSWORD}@postgres:5432/notesaner
      - REDIS_URL=redis://valkey:6379
      - NOTES_PATH=/data/notes
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - notes_data:/data/notes
    depends_on:
      - postgres
      - valkey
    restart: unless-stopped

  postgres:
    image: postgres:17-alpine
    environment:
      - POSTGRES_DB=notesaner
      - POSTGRES_USER=notesaner
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  valkey:
    image: valkey/valkey:8-alpine
    volumes:
      - valkey_data:/data
    restart: unless-stopped

volumes:
  notes_data:
  postgres_data:
  valkey_data:
```

## Running Behind a Reverse Proxy

See the [Reverse Proxy guide](/docs/self-hosting/reverse-proxy) for Nginx and Caddy configuration examples with WebSocket support.

## Updating

```bash
docker compose pull
docker compose up -d
```

Prisma migrations run automatically on server startup.
