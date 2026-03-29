---
title: Troubleshooting Self-Hosted Instances
description: Common self-hosting issues and their solutions.
---

# Troubleshooting Self-Hosted Instances

## Server Won't Start

**Check logs first:**

```bash
docker compose logs server --tail=100
```

### Database Connection Failed

```
Error: Can't reach database server
```

Verify:

- PostgreSQL is running: `docker compose ps postgres`
- `DATABASE_URL` is correct in `.env`
- Database exists: `docker compose exec postgres psql -U notesaner -l`

### Port Already in Use

```
Error: listen EADDRINUSE :::3001
```

Find and stop the conflicting process:

```bash
sudo lsof -i :3001
sudo kill -9 <PID>
```

## WebSocket Not Connecting

Real-time collaboration won't work without proper WebSocket proxying.

Check your reverse proxy configuration — ensure `Upgrade` and `Connection` headers are proxied. See [Reverse Proxy](/docs/self-hosting/reverse-proxy).

## Prisma Migration Errors

```bash
# Run migrations manually
docker compose exec server pnpm prisma migrate deploy

# Reset (DESTRUCTIVE — development only)
docker compose exec server pnpm prisma migrate reset
```

## Storage Permission Errors

```bash
# Fix permissions on notes directory
docker compose exec server chown -R node:node /data/notes
```
