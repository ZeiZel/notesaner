---
title: Upgrading Notesaner
description: Version migration steps and Prisma migration commands.
---

# Upgrading Notesaner

## Docker Compose Upgrade

```bash
# Pull latest images
docker compose pull

# Restart with new images (Prisma migrations run automatically)
docker compose up -d

# Verify
docker compose ps
docker compose logs server --tail=50
```

## Before Upgrading

1. **Backup your data** — see [Backup & Restore](/docs/self-hosting/backup-restore)
2. Check the [changelog](/docs/api-reference/changelog) for breaking changes
3. Test in a staging environment before upgrading production

## Manual Migration (Non-Docker)

```bash
git pull origin main
pnpm install
cd apps/server
pnpm prisma migrate deploy
pnpm nx build server
pm2 restart notesaner-server
```

## Rollback

If an upgrade fails, restore from backup and roll back to the previous Docker image:

```bash
docker compose down
# Restore from backup
docker compose up -d --scale server=0  # stop server only
# Restore database
docker compose up -d  # start with old image tag
```
