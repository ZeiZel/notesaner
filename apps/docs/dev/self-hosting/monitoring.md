---
title: Monitoring & Health Checks
description: /health endpoint, log aggregation, and alerting for self-hosted Notesaner.
---

# Monitoring & Health Checks

## Health Endpoint

The API server exposes a `/health` endpoint:

```bash
curl https://notesaner.example.com/api/health
```

Response:

```json
{
  "status": "ok",
  "version": "1.2.3",
  "uptime": 86400,
  "database": "connected",
  "cache": "connected",
  "storage": "accessible"
}
```

## Docker Compose Health Check

Add to your `docker-compose.yml`:

```yaml
server:
  healthcheck:
    test: ['CMD', 'curl', '-f', 'http://localhost:3001/health']
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 40s
```

## Logs

```bash
# All services
docker compose logs -f

# Server only
docker compose logs -f server

# Last 100 lines
docker compose logs --tail=100 server
```

## Metrics (Prometheus)

Notesaner exposes Prometheus metrics at `/api/metrics` when `METRICS_ENABLED=true`.

Example alerts:

- High error rate: `rate(http_requests_total{status=~"5.."}[5m]) > 0.01`
- Slow responses: `histogram_quantile(0.99, http_request_duration_seconds_bucket) > 2`
