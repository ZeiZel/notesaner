---
title: Cache Setup (Redis)
description: Redis 7 configuration for session storage, rate limiting, and BullMQ job queues.
---

# Cache Setup (Redis)

Notesaner uses [Redis](https://redis.io) for:

- Session storage (JWT token blocklist)
- WebSocket pub/sub (collaborative editing coordination across multiple server instances)
- Rate limiting counters
- BullMQ job queues

## Docker Setup (Recommended)

Redis is included in the Docker Compose configuration. No additional setup is required.

## Manual Installation

```bash
# Ubuntu 24.04 — install from official Redis repo
curl -fsSL https://packages.redis.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/redis-archive-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/redis-archive-keyring.gpg] https://packages.redis.io/deb $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/redis.list
sudo apt update && sudo apt install -y redis

sudo systemctl start redis
sudo systemctl enable redis
```

## Configuration

Notesaner connects to Redis via the `REDIS_URL` environment variable:

```env
REDIS_URL=redis://localhost:6379
# With password:
REDIS_URL=redis://:yourpassword@localhost:6379
```

## Scaling

For multi-server deployments, Redis pub/sub ensures WebSocket messages are broadcast to all server instances. No additional configuration is needed -- the `REDIS_URL` handles this automatically.
