---
title: Database Setup (PostgreSQL)
description: PostgreSQL 17 setup and schema migration with Prisma.
---

# Database Setup (PostgreSQL)

Notesaner uses PostgreSQL 17 for metadata storage, full-text search, and user management.

:::note
When using Docker Compose, PostgreSQL is configured automatically. This guide is for manual installations.
:::

## Installing PostgreSQL 17

```bash
# Ubuntu 24.04
sudo apt install -y postgresql-17 postgresql-contrib-17

# Start and enable
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

## Creating the Database

```bash
sudo -u postgres psql

CREATE USER notesaner WITH PASSWORD 'your_strong_password';
CREATE DATABASE notesaner OWNER notesaner;
GRANT ALL PRIVILEGES ON DATABASE notesaner TO notesaner;
\q
```

## Running Migrations

Notesaner uses Prisma for database migrations. Migrations run automatically on server startup in Docker.

For manual migration:

```bash
cd apps/server
pnpm prisma migrate deploy
```

## Schema Overview

Key tables:

- `users` — user accounts
- `workspaces` — workspace metadata
- `workspace_members` — user-workspace relationships
- `notes` — note metadata (not content — content is in MD files)
- `tags` — tag definitions
- `note_tags` — note-tag associations
- `api_keys` — API key management

## Full-Text Search

Notesaner uses PostgreSQL's `tsvector` for workspace-wide full-text search. The search index is updated automatically when notes are saved.
