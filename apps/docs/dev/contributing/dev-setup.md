---
title: Development Setup
description: Clone, pnpm install, NX setup, and running Notesaner locally.
---

# Development Setup

## Prerequisites

- Node.js 20+
- pnpm 10+
- Docker (for PostgreSQL and ValKey)
- Git

## 1. Clone the Repository

```bash
git clone https://github.com/notesaner/notesaner.git
cd notesaner
```

## 2. Install Dependencies

```bash
pnpm install
```

## 3. Start Infrastructure

```bash
docker compose -f docker-compose.dev.yml up -d
```

This starts:

- PostgreSQL 17 on port 5432
- ValKey 8 on port 6379

## 4. Configure Environment

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env with your local settings
```

## 5. Run Database Migrations

```bash
pnpm nx run server:prisma-migrate
```

## 6. Start Development Servers

```bash
# In one terminal — start the backend
pnpm nx serve server

# In another terminal — start the frontend
pnpm nx serve web
```

Open `http://localhost:3000` in your browser.

## Useful Commands

```bash
# Run all tests
pnpm nx run-many -t test

# Run tests for a specific project
pnpm nx test web
pnpm nx test server

# Lint
pnpm nx run-many -t lint

# Type check
pnpm nx run-many -t type-check

# Build
pnpm nx build server
pnpm nx build web
```
