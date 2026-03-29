---
title: Environment Variables Reference
description: Complete .env variable table with defaults and descriptions.
---

# Environment Variables Reference

## Required Variables

| Variable            | Description                            | Example                                           |
| ------------------- | -------------------------------------- | ------------------------------------------------- |
| `DATABASE_URL`      | PostgreSQL connection string           | `postgresql://user:pass@localhost:5432/notesaner` |
| `JWT_SECRET`        | Secret for signing JWTs (min 32 chars) | `your-secret-here`                                |
| `POSTGRES_PASSWORD` | PostgreSQL password (Docker Compose)   | `strongpassword123`                               |

## Server Configuration

| Variable           | Default                 | Description                        |
| ------------------ | ----------------------- | ---------------------------------- |
| `PORT`             | `3001`                  | NestJS server port                 |
| `NODE_ENV`         | `production`            | `production` or `development`      |
| `NOTES_PATH`       | `/data/notes`           | Filesystem path for Markdown files |
| `MAX_FILE_SIZE_MB` | `50`                    | Max attachment upload size in MB   |
| `CORS_ORIGINS`     | `http://localhost:3000` | Comma-separated allowed origins    |

## Authentication

| Variable             | Default | Description                |
| -------------------- | ------- | -------------------------- |
| `JWT_EXPIRES_IN`     | `7d`    | JWT token expiry           |
| `SAML_ENABLED`       | `false` | Enable SAML SSO            |
| `SAML_ENTRY_POINT`   | —       | SAML IdP entry point URL   |
| `SAML_ISSUER`        | —       | SAML SP issuer             |
| `SAML_CERT`          | —       | SAML IdP certificate       |
| `OIDC_ENABLED`       | `false` | Enable OIDC authentication |
| `OIDC_ISSUER`        | —       | OIDC provider issuer URL   |
| `OIDC_CLIENT_ID`     | —       | OIDC client ID             |
| `OIDC_CLIENT_SECRET` | —       | OIDC client secret         |

## Cache (ValKey / Redis)

| Variable            | Default                  | Description                  |
| ------------------- | ------------------------ | ---------------------------- |
| `REDIS_URL`         | `redis://localhost:6379` | ValKey/Redis connection URL  |
| `REDIS_SESSION_TTL` | `86400`                  | Session TTL in seconds (24h) |

## Frontend (Next.js)

| Variable              | Default                 | Description              |
| --------------------- | ----------------------- | ------------------------ |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | Backend API URL (public) |
| `NEXT_PUBLIC_WS_URL`  | `ws://localhost:3001`   | WebSocket URL (public)   |

## Email (Optional)

| Variable    | Default                 | Description             |
| ----------- | ----------------------- | ----------------------- |
| `SMTP_HOST` | —                       | SMTP server hostname    |
| `SMTP_PORT` | `587`                   | SMTP port               |
| `SMTP_USER` | —                       | SMTP username           |
| `SMTP_PASS` | —                       | SMTP password           |
| `SMTP_FROM` | `noreply@notesaner.com` | From address for emails |
