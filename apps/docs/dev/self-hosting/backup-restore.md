---
title: Backup & Restore
description: Backup Markdown files and PostgreSQL, and restore from backup.
---

# Backup & Restore

## What to Back Up

| Data                   | Location               | Method            |
| ---------------------- | ---------------------- | ----------------- |
| Notes (Markdown files) | `NOTES_PATH` volume    | File copy / rsync |
| PostgreSQL database    | `postgres_data` volume | `pg_dump`         |
| Configuration          | `.env` file            | Secure copy       |

## Backup Script

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/notesaner_${DATE}"
mkdir -p "${BACKUP_DIR}"

# Backup PostgreSQL
docker compose exec -T postgres pg_dump -U notesaner notesaner \
  | gzip > "${BACKUP_DIR}/postgres.sql.gz"

# Backup notes files
docker compose cp server:/data/notes "${BACKUP_DIR}/notes"

# Copy .env
cp .env "${BACKUP_DIR}/.env.bak"

echo "Backup complete: ${BACKUP_DIR}"
```

## Automated Backups

Add to crontab for daily backups:

```cron
0 2 * * * /opt/notesaner/backup.sh >> /var/log/notesaner-backup.log 2>&1
```

## Restore

```bash
# Restore PostgreSQL
gunzip -c backup/postgres.sql.gz | docker compose exec -T postgres psql -U notesaner notesaner

# Restore notes files
docker compose cp backup/notes/. server:/data/notes/
```
