---
title: SAML SSO (Keycloak, Authentik)
description: Step-by-step SAML SSO configuration with Keycloak and Authentik.
---

# SAML SSO

Notesaner supports SAML 2.0 SSO for enterprise authentication. This enables users to log in with their existing corporate identity provider.

## Supported Providers

- Keycloak
- Authentik
- Okta
- Azure AD (Entra ID)
- Any SAML 2.0-compliant IdP

## Environment Variables

```env
SAML_ENABLED=true
SAML_ENTRY_POINT=https://keycloak.example.com/auth/realms/notesaner/protocol/saml
SAML_ISSUER=notesaner-app
SAML_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
SAML_CALLBACK_URL=https://notesaner.example.com/api/auth/saml/callback
```

## Keycloak Setup

1. Create a new Client in Keycloak with:
   - Client ID: `notesaner-app`
   - Client Protocol: `saml`
   - Root URL: `https://notesaner.example.com`
   - Valid Redirect URIs: `https://notesaner.example.com/api/auth/saml/callback`

2. Set **Client Signature Required** to `OFF`

3. Add Mappers:
   - `email` → attribute `email`
   - `firstName` + `lastName` → attribute `displayName`

4. Download the IdP certificate and set it as `SAML_CERT`

## Authentik Setup

:::info Coming Soon
Authentik-specific instructions coming soon.
:::
