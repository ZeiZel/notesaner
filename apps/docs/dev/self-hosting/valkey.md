---
title: Cache Setup (ValKey / Redis)
description: ValKey 8 configuration for session storage and WebSocket pub/sub.
---

# Cache Setup (ValKey / Redis)

Notesaner uses [ValKey](https://valkey.io) (a Redis-compatible open-source cache) for:

- Session storage (JWT token blocklist)
- WebSocket pub/sub (collaborative editing coordination across multiple server instances)
- Rate limiting counters

:::note
ValKey is a drop-in Redis replacement. You can use Redis 7+ if preferred.
:::

## Docker Setup (Recommended)

ValKey is included in the Docker Compose configuration. No additional setup is required.

## Manual Installation

```bash
# Ubuntu 24.04 — install from ValKey repo
curl -fsSL https://repo.valkey.io/apt/valkey.gpg | sudo gpg --dearmor -o /usr/share/keyrings/valkey.gpg
echo "deb [signed-by=/usr/share/keyrings/valkey.gpg] https://repo.valkey.io/apt $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/valkey.list
sudo apt update && sudo apt install -y valkey

sudo systemctl start valkey
sudo systemctl enable valkey
```

## Configuration

Notesaner connects to ValKey via the `REDIS_URL` environment variable:

```env
REDIS_URL=redis://localhost:6379
# With password:
REDIS_URL=redis://:yourpassword@localhost:6379
```

## Scaling

For multi-server deployments, ValKey pub/sub ensures WebSocket messages are broadcast to all server instances. No additional configuration is needed — the `REDIS_URL` handles this automatically.
