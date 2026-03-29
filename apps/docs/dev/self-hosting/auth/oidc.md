---
title: OIDC Setup
description: OpenID Connect authentication provider configuration.
---

# OIDC Setup

:::info Coming Soon
This page is under construction. Complete documentation will be available soon.
:::

Notesaner supports OIDC (OpenID Connect) for SSO with providers like Google, GitHub, Okta, and Authentik.

## Configuration

```env
OIDC_ENABLED=true
OIDC_ISSUER=https://accounts.google.com
OIDC_CLIENT_ID=your-client-id
OIDC_CLIENT_SECRET=your-client-secret
OIDC_REDIRECT_URI=https://notesaner.example.com/api/auth/oidc/callback
OIDC_SCOPE=openid email profile
```

## Supported Providers

| Provider  | Issuer URL                                          |
| --------- | --------------------------------------------------- |
| Google    | `https://accounts.google.com`                       |
| GitHub    | `https://token.actions.githubusercontent.com`       |
| Authentik | `https://auth.example.com/application/o/notesaner/` |
| Okta      | `https://your-domain.okta.com`                      |
