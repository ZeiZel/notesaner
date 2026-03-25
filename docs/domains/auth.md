# Domain: Authentication & Authorization

## Overview

Multi-provider authentication supporting SAML 2.0 (Keycloak, Authentik), OIDC, and local email/password. JWT-based session management with RBAC.

## Auth Providers

### SAML 2.0
- **Keycloak**: Full SAML SP implementation
- **Authentik**: SAML SP implementation
- **Generic SAML**: Configurable SAML SP for any IdP
- Configuration stored in `AuthProvider` table
- Metadata exchange via URL or XML upload

### OIDC (OpenID Connect)
- **Keycloak**: OIDC client
- **Authentik**: OIDC client
- **Google**: OAuth 2.0 + OIDC
- **GitHub**: OAuth 2.0
- **Generic OIDC**: Configurable for any OIDC provider

### Local Auth
- Email + password (bcrypt hashed)
- Optional TOTP 2FA
- Email verification flow

## Session Management

```
Login → Provider Auth → JWT Pair Generated
                            │
                ┌───────────┼───────────┐
                │                       │
         Access Token              Refresh Token
         (15 min TTL)              (7 day TTL)
         (in memory)               (httpOnly cookie)
                │                       │
         API requests              Token refresh
         Authorization              POST /auth/refresh
         header                         │
                                   New access token
```

## RBAC Model

### Roles
| Role | Scope | Permissions |
|------|-------|-------------|
| `owner` | Workspace | Full control, billing, delete workspace |
| `admin` | Workspace | Manage users, plugins, settings, all notes |
| `editor` | Workspace | Create/edit/delete own notes, view others |
| `viewer` | Workspace | Read-only access to shared notes |
| `guest` | Note | Read-only access to specific shared notes |

### Permissions
```typescript
enum Permission {
  // Notes
  NOTE_CREATE = 'note:create',
  NOTE_READ = 'note:read',
  NOTE_UPDATE = 'note:update',
  NOTE_DELETE = 'note:delete',
  NOTE_PUBLISH = 'note:publish',
  NOTE_SHARE = 'note:share',

  // Workspace
  WORKSPACE_SETTINGS = 'workspace:settings',
  WORKSPACE_USERS = 'workspace:users',
  WORKSPACE_PLUGINS = 'workspace:plugins',
  WORKSPACE_DELETE = 'workspace:delete',

  // Admin
  ADMIN_FILESYSTEM = 'admin:filesystem',
  ADMIN_BACKUP = 'admin:backup',
  ADMIN_AUTH_PROVIDERS = 'admin:auth-providers',
}
```

## Server Configuration

Admin configures auth providers via API or config file:

```yaml
# config/auth.yaml
auth:
  local:
    enabled: true
    requireEmailVerification: true

  saml:
    - name: "Corporate SSO"
      entityId: "https://notesaner.example.com"
      ssoUrl: "https://keycloak.example.com/auth/realms/corp/protocol/saml"
      certificate: "/certs/idp.pem"
      attributeMapping:
        email: "urn:oid:0.9.2342.19200300.100.1.3"
        name: "urn:oid:2.5.4.3"

  oidc:
    - name: "Authentik"
      issuer: "https://authentik.example.com/application/o/notesaner/"
      clientId: "${OIDC_CLIENT_ID}"
      clientSecret: "${OIDC_CLIENT_SECRET}"
      scopes: ["openid", "profile", "email"]
