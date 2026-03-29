---
title: Authentication Flow
description: JWT lifecycle, SAML flow, OIDC flow, and session storage in ValKey.
---

# Authentication Flow

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

## JWT Flow

```
Client                    Server
──────                    ──────
POST /api/auth/login ────►
  email, password          Verify credentials
                           Generate JWT (7d expiry)
                         ◄── { accessToken, refreshToken }

GET /api/notes ──────────►
  Authorization: Bearer    Verify JWT signature
  <token>                  Check token not revoked (ValKey)
                         ◄── Note data
```

## Token Storage

- **Access token**: httpOnly cookie (or localStorage for SPA mode)
- **Refresh token**: httpOnly cookie with longer expiry
- **Token blocklist**: Revoked tokens stored in ValKey with TTL

## SAML Flow

```
Client → Notesaner → SAML IdP (Keycloak/Authentik)
                          │
                          ▼ (after user authenticates)
                     SAML Assertion →
                          │
                     Notesaner validates assertion
                          │
                     Creates/updates user
                          │
                     Issues JWT
                          │
                     Redirect to app
```
