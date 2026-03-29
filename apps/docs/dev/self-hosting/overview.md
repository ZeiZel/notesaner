---
title: Overview & Requirements
description: System requirements, architecture diagram, and supported platforms for self-hosting Notesaner.
sidebar_position: 1
---

# Self-Hosting Overview & Requirements

Notesaner is fully self-hostable. This guide covers deploying Notesaner on your own infrastructure using Docker Compose (recommended) or manual installation.

## Architecture Overview

```
┌─────────────────────────────────────────┐
│                 Internet                │
└───────────────────┬─────────────────────┘
                    │ HTTPS
         ┌──────────▼──────────┐
         │  Nginx / Caddy      │  Reverse Proxy
         │  (TLS termination)  │
         └──────┬──────────────┘
                │
    ┌───────────▼───────────────┐
    │   Notesaner Web (Next.js) │  Port 3000
    └───────────────────────────┘
                │ API calls + WebSocket
    ┌───────────▼───────────────┐
    │  Notesaner API (NestJS)   │  Port 3001
    └───┬──────────┬────────────┘
        │          │
   ┌────▼────┐ ┌───▼────┐ ┌──────────────┐
   │Postgres │ │ValKey  │ │  Filesystem  │
   │  :5432  │ │  :6379 │ │  (MD files)  │
   └─────────┘ └────────┘ └──────────────┘
```

## System Requirements

| Component | Minimum               | Recommended      |
| --------- | --------------------- | ---------------- |
| CPU       | 2 cores               | 4 cores          |
| RAM       | 2 GB                  | 4 GB             |
| Disk      | 20 GB SSD             | 100 GB SSD       |
| OS        | Linux (Ubuntu 22.04+) | Ubuntu 24.04 LTS |

## Software Requirements

| Software           | Version |
| ------------------ | ------- |
| Docker             | 24.0+   |
| Docker Compose     | 2.20+   |
| (Optional) Node.js | 20+     |
| (Optional) pnpm    | 10+     |

## Supported Platforms

- Ubuntu 22.04 / 24.04 LTS ✓
- Debian 12 ✓
- Fedora 38+ ✓
- macOS (development only)
- Windows WSL2 (development only)

## Next Steps

1. [Docker Compose Setup](/docs/self-hosting/docker-compose) (recommended)
2. [Environment Variables Reference](/docs/self-hosting/env-vars)
3. [Database Setup](/docs/self-hosting/postgresql)
