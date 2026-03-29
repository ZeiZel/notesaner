---
title: File Storage Configuration
description: Local filesystem vs S3-compatible storage for Markdown files and attachments.
---

# File Storage Configuration

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Notesaner stores Markdown files and attachments on the filesystem. By default, files are stored locally. For production deployments, S3-compatible storage is recommended for durability and scalability.

## Local Storage (Default)

Set `NOTES_PATH` to the desired directory:

```env
NOTES_PATH=/data/notes
```

Ensure this directory is backed up regularly.

## S3-Compatible Storage

Configure S3 storage via environment variables:

```env
STORAGE_PROVIDER=s3
S3_BUCKET=my-notesaner-notes
S3_REGION=us-east-1
S3_ACCESS_KEY=your-access-key
S3_SECRET_KEY=your-secret-key
# For non-AWS providers (MinIO, Cloudflare R2, etc.):
S3_ENDPOINT=https://your-endpoint.com
```

Compatible providers: AWS S3, MinIO, Cloudflare R2, Backblaze B2, DigitalOcean Spaces.
