# Notesaner Security Audit Checklist

Comprehensive security audit framework for the Notesaner platform.
Last reviewed: 2026-03-28.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Authorization](#2-authorization)
3. [Input Validation](#3-input-validation)
4. [API Security](#4-api-security)
5. [Data Protection](#5-data-protection)
6. [Infrastructure & Headers](#6-infrastructure--headers)
7. [File Upload Security](#7-file-upload-security)
8. [WebSocket Security](#8-websocket-security)
9. [Plugin Security](#9-plugin-security)
10. [Dependency Security](#10-dependency-security)
11. [Current Implementation Status](#11-current-implementation-status)
12. [Identified Gaps & Remediation](#12-identified-gaps--remediation)
13. [Penetration Testing Scenarios](#13-penetration-testing-scenarios)

---

## 1. Authentication

### 1.1 Session Management

| #     | Check                                                               | Status          | Notes                                                                                                   |
| ----- | ------------------------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------- |
| 1.1.1 | Session tokens are cryptographically random (min 128-bit entropy)   | PARTIAL         | Password reset tokens use `randomBytes(32)` (256-bit). JWT secret source not validated at startup.      |
| 1.1.2 | Session tokens are transmitted only over HTTPS (Secure cookie flag) | IMPLEMENTED     | `CsrfMiddleware` sets `secure: true` in production. Cookie parser configured in `main.ts`.              |
| 1.1.3 | Session tokens have appropriate expiry                              | PARTIAL         | `JWT_ACCESS_TOKEN_TTL` defaults to 900s (15 min), refresh to 30 days. loginLocal is still a stub.       |
| 1.1.4 | Sessions are invalidated on logout                                  | IMPLEMENTED     | `auth.service.ts` logout stub exists; password reset invalidates all sessions via `session.deleteMany`. |
| 1.1.5 | Sessions are invalidated on password change                         | IMPLEMENTED     | `resetPassword()` deletes all sessions in a Prisma transaction.                                         |
| 1.1.6 | Concurrent session limits are enforced                              | NOT IMPLEMENTED | No per-user session limit. WebSocket connections are limited (5 per user).                              |
| 1.1.7 | Session fixation protection                                         | NOT VERIFIED    | loginLocal is not yet implemented; needs verification on implementation.                                |
| 1.1.8 | Idle session timeout                                                | NOT IMPLEMENTED | No idle timeout mechanism; only absolute TTL on JWT.                                                    |
| 1.1.9 | Re-authentication for sensitive operations                          | NOT IMPLEMENTED | No step-up auth for password change, TOTP enable/disable, API key creation.                             |

### 1.2 Password Policy

| #     | Check                                    | Status          | Notes                                                                                    |
| ----- | ---------------------------------------- | --------------- | ---------------------------------------------------------------------------------------- |
| 1.2.1 | Minimum password length (>=8 chars)      | PARTIAL         | `ResetPasswordSchema` enforces min 8; registration DTO has no Zod validation yet (stub). |
| 1.2.2 | Password complexity requirements         | NOT VERIFIED    | Depends on Zod schema in registration (not yet implemented).                             |
| 1.2.3 | Password hashing uses strong algorithm   | IMPLEMENTED     | scrypt with N=16384, r=8, p=1, keyLen=64. Salt is 16 bytes random.                       |
| 1.2.4 | Passwords not stored in plaintext        | IMPLEMENTED     | Only SHA-256 hashes of reset/verification tokens stored; passwords use scrypt.           |
| 1.2.5 | Password history enforcement             | NOT IMPLEMENTED | No check prevents reusing previous passwords.                                            |
| 1.2.6 | Breached password check (HaveIBeenPwned) | NOT IMPLEMENTED | No integration with breach databases.                                                    |

### 1.3 Multi-Factor Authentication

| #     | Check                           | Status          | Notes                                                                                 |
| ----- | ------------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| 1.3.1 | TOTP (RFC 6238) implementation  | PARTIAL         | Endpoints exist (`/totp/enable`, `/totp/verify`, `/totp`); service methods are stubs. |
| 1.3.2 | TOTP secret stored securely     | NOT VERIFIED    | Implementation pending.                                                               |
| 1.3.3 | Backup/recovery codes available | NOT IMPLEMENTED | No backup code mechanism.                                                             |
| 1.3.4 | MFA bypass protection           | NOT VERIFIED    | loginLocal accepts `totpCode` param but is a stub.                                    |
| 1.3.5 | MFA enforced for admin roles    | NOT IMPLEMENTED | No enforcement policy for super-admin or workspace admin.                             |

### 1.4 Token Handling

| #     | Check                                               | Status          | Notes                                                                                                                     |
| ----- | --------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1.4.1 | JWT signing uses asymmetric algorithm (RS256/ES256) | NOT VERIFIED    | Configuration has `jwt.secret` (likely HS256). RS256 recommended.                                                         |
| 1.4.2 | JWT contains minimal claims                         | NOT VERIFIED    | loginLocal is a stub; `JwtPayload` type includes `sub`, `sessionId`, `isSuperAdmin`, `workspaceRole`.                     |
| 1.4.3 | Refresh token rotation implemented                  | NOT IMPLEMENTED | `refreshTokens()` is a stub.                                                                                              |
| 1.4.4 | Token revocation mechanism exists                   | PARTIAL         | `logout()` and `revokeSession()` stubs exist; password reset deletes sessions.                                            |
| 1.4.5 | Tokens not exposed in URLs                          | PARTIAL         | `reset-password` and `verify-email` pass tokens in URL query params (standard for email links but logged in access logs). |
| 1.4.6 | API keys use SHA-256 hash storage                   | IMPLEMENTED     | `ApiKeyService.hashKey()` uses SHA-256; raw key shown once at creation.                                                   |
| 1.4.7 | API key format is identifiable                      | IMPLEMENTED     | `nsk_` prefix makes keys recognizable in logs/dumps.                                                                      |

### 1.5 OIDC/SAML

| #     | Check                                             | Status       | Notes                                                                   |
| ----- | ------------------------------------------------- | ------------ | ----------------------------------------------------------------------- |
| 1.5.1 | State parameter validated in OAuth flow           | NEEDS REVIEW | `oidc.strategy.ts` exists; requires manual review for state validation. |
| 1.5.2 | Redirect URI validated (open redirect prevention) | NEEDS REVIEW | OIDC callback paths exempted from CSRF in `CsrfMiddleware`.             |
| 1.5.3 | Token exchange uses backchannel                   | NEEDS REVIEW | Strategy implementation needs review.                                   |
| 1.5.4 | ID token signature validated                      | NEEDS REVIEW | Depends on passport-openidconnect strategy configuration.               |

---

## 2. Authorization

### 2.1 RBAC Checks

| #     | Check                                                   | Status       | Notes                                                                                                                 |
| ----- | ------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| 2.1.1 | Role hierarchy enforced server-side                     | IMPLEMENTED  | `RolesGuard` with hierarchy OWNER(4) > ADMIN(3) > EDITOR(2) > VIEWER(1).                                              |
| 2.1.2 | Super-admin guard for global admin routes               | IMPLEMENTED  | `SuperAdminGuard` checks `isSuperAdmin` on JWT payload.                                                               |
| 2.1.3 | Default deny policy                                     | IMPLEMENTED  | `JwtAuthGuard` requires auth unless `@Public()` decorator is used.                                                    |
| 2.1.4 | Role checks applied to all state-changing endpoints     | PARTIAL      | `@Roles()` decorator exists but not applied on all controllers (e.g., notes, workspaces controllers lack `@Roles()`). |
| 2.1.5 | Admin endpoints use both JwtAuthGuard + SuperAdminGuard | NEEDS REVIEW | Admin module needs verification.                                                                                      |

### 2.2 IDOR Prevention

| #     | Check                                            | Status       | Notes                                                                                                      |
| ----- | ------------------------------------------------ | ------------ | ---------------------------------------------------------------------------------------------------------- |
| 2.2.1 | Workspace-scoped resources validate membership   | PARTIAL      | Notes controller passes `workspaceId` to service but no guard enforces membership before the service call. |
| 2.2.2 | Note operations verify workspace ownership       | PARTIAL      | `NotesService` receives `workspaceId` and `userId` but implementation is stub-level.                       |
| 2.2.3 | Attachment operations verify workspace ownership | IMPLEMENTED  | `AttachmentService.upload()` checks `note.workspaceId !== workspaceId`.                                    |
| 2.2.4 | API key operations scoped to workspace           | IMPLEMENTED  | `ApiKeyService.revoke()` requires matching `workspaceId`.                                                  |
| 2.2.5 | User cannot access another user's sessions       | NOT VERIFIED | `revokeSession()` receives `userId` from JWT but is a stub.                                                |
| 2.2.6 | UUID used for resource IDs (no sequential IDs)   | IMPLEMENTED  | Prisma schema uses UUIDs via `gen_random_uuid()`.                                                          |

### 2.3 Privilege Escalation Prevention

| #     | Check                                                   | Status          | Notes                                                                              |
| ----- | ------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------- |
| 2.3.1 | Users cannot assign roles higher than their own         | NOT IMPLEMENTED | `WorkspacesController.updateMemberRole()` has no guard checking the caller's role. |
| 2.3.2 | Owner role cannot be self-assigned                      | NOT VERIFIED    | Service implementation pending.                                                    |
| 2.3.3 | Super-admin flag cannot be set via API                  | NEEDS REVIEW    | No endpoint sets `isSuperAdmin` directly but verify UserService.                   |
| 2.3.4 | API key permissions cannot exceed creator's permissions | NOT IMPLEMENTED | `ApiKeyService.create()` does not validate permissions against user's role.        |

---

## 3. Input Validation

### 3.1 XSS Prevention

| #     | Check                                               | Status          | Notes                                                                                      |
| ----- | --------------------------------------------------- | --------------- | ------------------------------------------------------------------------------------------ |
| 3.1.1 | Global ValidationPipe with whitelist enabled        | IMPLEMENTED     | `main.ts` uses `whitelist: true, forbidNonWhitelisted: true`.                              |
| 3.1.2 | CSP prevents inline script execution                | IMPLEMENTED     | CSP directive: `script-src 'self'` (no `unsafe-eval`). `style-src` allows `unsafe-inline`. |
| 3.1.3 | HTML content is sanitized before storage            | NOT IMPLEMENTED | Note content is Markdown; no HTML sanitization on render path.                             |
| 3.1.4 | Note titles and metadata sanitized                  | NOT VERIFIED    | Depends on service layer validation (stubs).                                               |
| 3.1.5 | API responses set `X-Content-Type-Options: nosniff` | IMPLEMENTED     | `SecurityHeadersMiddleware` sets this header.                                              |
| 3.1.6 | Workspace/user display names sanitized              | NOT VERIFIED    | No explicit sanitization in DTOs.                                                          |

### 3.2 SQL Injection

| #     | Check                                         | Status       | Notes                                                                                                |
| ----- | --------------------------------------------- | ------------ | ---------------------------------------------------------------------------------------------------- |
| 3.2.1 | Parameterized queries used exclusively        | IMPLEMENTED  | Prisma ORM for most queries; `ApiKeyService` uses `$queryRaw` with tagged templates (parameterized). |
| 3.2.2 | No string concatenation in queries            | IMPLEMENTED  | Tagged template literals in `$queryRaw` calls.                                                       |
| 3.2.3 | Database user has least-privilege permissions | NOT VERIFIED | Depends on deployment configuration.                                                                 |

### 3.3 Command Injection

| #     | Check                                      | Status      | Notes                                                                                             |
| ----- | ------------------------------------------ | ----------- | ------------------------------------------------------------------------------------------------- |
| 3.3.1 | No shell command execution with user input | PARTIAL     | `backup.processor.ts` uses `pg_dump` via configurable path; verify input is not user-controlled.  |
| 3.3.2 | File paths constructed safely              | IMPLEMENTED | `AttachmentService.sanitizeFilename()` strips path separators; `resolveSafePath()` exists (stub). |
| 3.3.3 | No eval() or Function() with user input    | IMPLEMENTED | No usage found in server codebase.                                                                |

### 3.4 Path Traversal

| #     | Check                                                          | Status          | Notes                                                                      |
| ----- | -------------------------------------------------------------- | --------------- | -------------------------------------------------------------------------- |
| 3.4.1 | File path sanitization on uploads                              | IMPLEMENTED     | `sanitizeFilename()` uses `path.basename()` + character whitelist.         |
| 3.4.2 | `resolveSafePath()` validates paths stay within workspace root | PARTIAL         | Method exists in `FilesService` but is a stub (`NotImplementedException`). |
| 3.4.3 | Symlink following disabled                                     | NOT IMPLEMENTED | No explicit symlink check in file operations.                              |
| 3.4.4 | Null byte injection prevented                                  | IMPLEMENTED     | `sanitizeFilename()` regex replaces control characters.                    |

### 3.5 Zod Validation at Boundaries

| #     | Check                                        | Status          | Notes                                                                                           |
| ----- | -------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| 3.5.1 | Auth DTOs use Zod schemas                    | IMPLEMENTED     | `ForgotPasswordSchema`, `ResetPasswordSchema`, `VerifyEmailSchema`, `ResendVerificationSchema`. |
| 3.5.2 | OIDC config validated with Zod               | IMPLEMENTED     | `oidc-config.schema.ts` exists.                                                                 |
| 3.5.3 | All API endpoints use class-validator or Zod | PARTIAL         | Controller DTOs use class-validator decorators; some endpoints lack validation.                 |
| 3.5.4 | WebSocket message payloads validated         | NOT IMPLEMENTED | `SyncGateway` message handlers accept unvalidated payloads.                                     |

---

## 4. API Security

### 4.1 Rate Limiting

| #     | Check                                         | Status      | Notes                                                                                     |
| ----- | --------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------- |
| 4.1.1 | Global rate limiting enabled                  | IMPLEMENTED | `ThrottlerModule` with ValKey-backed storage, 100 req/min default.                        |
| 4.1.2 | Auth endpoints have stricter limits           | IMPLEMENTED | `@AuthRateLimit()` applies 5 req/min on login, register, forgot-password, reset-password. |
| 4.1.3 | Rate limit headers exposed                    | IMPLEMENTED | `RateLimitHeadersInterceptor` exposes `X-RateLimit-*` and `Retry-After`.                  |
| 4.1.4 | Rate limiting works across instances          | IMPLEMENTED | `ValkeyThrottlerStorage` uses atomic Lua script for distributed counting.                 |
| 4.1.5 | Search endpoints rate limited                 | AVAILABLE   | `@SearchRateLimit()` decorator exists (30 req/min). Verify application.                   |
| 4.1.6 | Upload endpoints rate limited                 | AVAILABLE   | `@UploadRateLimit()` decorator exists (10 req/min). Verify application.                   |
| 4.1.7 | Rate limiter uses real client IP behind proxy | IMPLEMENTED | `ThrottlerBehindProxyGuard` + `trust proxy` in `main.ts`.                                 |

### 4.2 CORS

| #     | Check                                             | Status      | Notes                                                                                             |
| ----- | ------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| 4.2.1 | CORS origin whitelist configured                  | IMPLEMENTED | `ALLOWED_ORIGINS` env var, defaults to `http://localhost:3000`.                                   |
| 4.2.2 | Credentials mode enabled with specific origins    | IMPLEMENTED | `credentials: true` with explicit origin list (no wildcard).                                      |
| 4.2.3 | Allowed methods restricted                        | IMPLEMENTED | `GET, POST, PUT, PATCH, DELETE, OPTIONS` only.                                                    |
| 4.2.4 | Allowed headers restricted                        | IMPLEMENTED | Explicit whitelist: `Content-Type, Authorization, Cookie, X-Request-ID, X-CSRF-Token, X-API-Key`. |
| 4.2.5 | No wildcard origin (`*`) when credentials enabled | IMPLEMENTED | Origin is an explicit list, not `*`.                                                              |

### 4.3 CSRF

| #     | Check                                                    | Status      | Notes                                                                |
| ----- | -------------------------------------------------------- | ----------- | -------------------------------------------------------------------- |
| 4.3.1 | Double-submit cookie pattern implemented                 | IMPLEMENTED | `CsrfMiddleware` generates random token, validates header vs cookie. |
| 4.3.2 | CSRF token is SameSite=Strict                            | IMPLEMENTED | Cookie set with `sameSite: 'strict'`.                                |
| 4.3.3 | State-changing methods (POST/PUT/PATCH/DELETE) protected | IMPLEMENTED | `protectedMethods` set in middleware.                                |
| 4.3.4 | CSRF exempt paths documented and minimal                 | IMPLEMENTED | Exempt: `/health`, `/api/auth/oidc/`, `/api/v1/` (API-key auth).     |
| 4.3.5 | API-key requests exempt from CSRF                        | IMPLEMENTED | Checked via `x-api-key` header presence.                             |
| 4.3.6 | CSRF token has sufficient entropy                        | IMPLEMENTED | `randomBytes(32)` = 256-bit entropy.                                 |

### 4.4 Content-Type Validation

| #     | Check                                                       | Status          | Notes                                                                             |
| ----- | ----------------------------------------------------------- | --------------- | --------------------------------------------------------------------------------- |
| 4.4.1 | `Content-Type` validated on incoming requests               | PARTIAL         | NestJS body parser handles JSON; no explicit content-type enforcement middleware. |
| 4.4.2 | Responses include correct `Content-Type`                    | IMPLEMENTED     | NestJS framework handles this.                                                    |
| 4.4.3 | File uploads validate `Content-Type` against actual content | NOT IMPLEMENTED | MIME type checked by name only, not magic bytes.                                  |

### 4.5 Error Handling

| #     | Check                                         | Status      | Notes                                                                         |
| ----- | --------------------------------------------- | ----------- | ----------------------------------------------------------------------------- |
| 4.5.1 | Generic error messages for 500 errors         | IMPLEMENTED | `AllExceptionsFilter` returns "Internal server error" for unknown exceptions. |
| 4.5.2 | No stack traces in production responses       | IMPLEMENTED | Stack traces only logged server-side, not in response body.                   |
| 4.5.3 | Prisma errors mapped to safe responses        | IMPLEMENTED | P2002 -> 409, P2025 -> 404, P2003 -> 400; default -> 500 "Database error".    |
| 4.5.4 | Auth failure messages do not leak information | IMPLEMENTED | `forgotPassword()` returns same message regardless of email existence.        |

---

## 5. Data Protection

### 5.1 Encryption at Rest

| #     | Check                                          | Status          | Notes                                                                                         |
| ----- | ---------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| 5.1.1 | Database encryption at rest                    | NOT VERIFIED    | Depends on PostgreSQL/infrastructure configuration.                                           |
| 5.1.2 | Backup encryption                              | IMPLEMENTED     | `BACKUP_ENCRYPTION_KEY` config exists; verify actual implementation in `backup.processor.ts`. |
| 5.1.3 | File storage encryption                        | NOT IMPLEMENTED | Markdown files stored as plaintext on filesystem.                                             |
| 5.1.4 | Secrets not stored in application config files | IMPLEMENTED     | All secrets via environment variables (`JWT_SECRET`, `DATABASE_URL`, etc.).                   |

### 5.2 Encryption in Transit

| #     | Check                            | Status      | Notes                                                                                      |
| ----- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------ |
| 5.2.1 | TLS enforced (HSTS)              | IMPLEMENTED | `SecurityHeadersMiddleware` sets HSTS in production (max-age=31536000, includeSubDomains). |
| 5.2.2 | Secure cookie flag in production | IMPLEMENTED | CSRF cookie uses `secure: isProduction`.                                                   |
| 5.2.3 | WebSocket connections use WSS    | PARTIAL     | CSP allows `wss:` in `connect-src`; actual WSS enforcement depends on deployment.          |

### 5.3 PII Handling

| #     | Check                                                 | Status          | Notes                                                                                           |
| ----- | ----------------------------------------------------- | --------------- | ----------------------------------------------------------------------------------------------- |
| 5.3.1 | PII not logged                                        | PARTIAL         | `CsrfMiddleware` logs IP; `AccountLockoutService` logs email; need audit of all log statements. |
| 5.3.2 | PII minimized in JWT claims                           | PARTIAL         | JWT includes `sub` (userId), not email. `isSuperAdmin` flag in JWT is acceptable.               |
| 5.3.3 | User data deletion capability (GDPR right to erasure) | NOT IMPLEMENTED | No explicit user deletion/data export endpoint.                                                 |
| 5.3.4 | Data retention policies defined                       | PARTIAL         | Backup retention configured (daily/weekly/monthly). No note or log retention policy.            |

### 5.4 Secrets Management

| #     | Check                                       | Status          | Notes                                                            |
| ----- | ------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| 5.4.1 | JWT secret loaded from environment          | IMPLEMENTED     | `jwt.secret` from `JWT_SECRET` env var.                          |
| 5.4.2 | Database credentials via environment        | IMPLEMENTED     | `DATABASE_URL` env var.                                          |
| 5.4.3 | API keys hashed before storage              | IMPLEMENTED     | SHA-256 hash of raw key stored.                                  |
| 5.4.4 | Password reset tokens hashed before storage | IMPLEMENTED     | SHA-256 hash stored; raw token in email only.                    |
| 5.4.5 | No secrets in source code                   | NEEDS REVIEW    | Periodic scan recommended (`git-secrets`, `gitleaks`).           |
| 5.4.6 | Secrets rotation procedure documented       | NOT IMPLEMENTED | No documented procedure for rotating JWT secret, DB credentials. |

---

## 6. Infrastructure & Headers

### 6.1 Security Headers

| #      | Check                                            | Status      | Notes                                                                                                 |
| ------ | ------------------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------- |
| 6.1.1  | Content-Security-Policy                          | IMPLEMENTED | Strict CSP: `default-src 'self'`, `script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`. |
| 6.1.2  | X-Content-Type-Options: nosniff                  | IMPLEMENTED | Set by `SecurityHeadersMiddleware`.                                                                   |
| 6.1.3  | X-Frame-Options: DENY                            | IMPLEMENTED | Set by `SecurityHeadersMiddleware`.                                                                   |
| 6.1.4  | Referrer-Policy: strict-origin-when-cross-origin | IMPLEMENTED | Set by `SecurityHeadersMiddleware`.                                                                   |
| 6.1.5  | Permissions-Policy                               | IMPLEMENTED | Denies camera, microphone, geolocation, payment, USB, magnetometer, gyroscope, accelerometer.         |
| 6.1.6  | Strict-Transport-Security (HSTS)                 | IMPLEMENTED | Production only; max-age=31536000, includeSubDomains.                                                 |
| 6.1.7  | X-DNS-Prefetch-Control: off                      | IMPLEMENTED | Set by `SecurityHeadersMiddleware`.                                                                   |
| 6.1.8  | X-Permitted-Cross-Domain-Policies: none          | IMPLEMENTED | Set by `SecurityHeadersMiddleware`.                                                                   |
| 6.1.9  | Helmet base headers                              | IMPLEMENTED | `main.ts` applies helmet (CSP and HSTS delegated to custom middleware).                               |
| 6.1.10 | CSP report-only mode for staging                 | IMPLEMENTED | `SECURITY_CSP_REPORT_ONLY` env var toggles report-only header.                                        |

### 6.2 TLS Configuration

| #     | Check                     | Status       | Notes                                                         |
| ----- | ------------------------- | ------------ | ------------------------------------------------------------- |
| 6.2.1 | TLS 1.2+ enforced         | NOT VERIFIED | Depends on reverse proxy / load balancer configuration.       |
| 6.2.2 | Strong cipher suites only | NOT VERIFIED | Depends on deployment infrastructure.                         |
| 6.2.3 | HSTS preload eligible     | PARTIAL      | `includeSubDomains` set but `preload` directive not included. |

### 6.3 Cookie Flags

| #     | Check                     | Status      | Notes                                                                                                             |
| ----- | ------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------- |
| 6.3.1 | HttpOnly on auth cookies  | PARTIAL     | CSRF cookie is intentionally non-HttpOnly (SPA reads it). Auth cookies need verification (login not implemented). |
| 6.3.2 | Secure flag in production | IMPLEMENTED | `CsrfMiddleware` uses `secure: this.isProduction`.                                                                |
| 6.3.3 | SameSite=Strict or Lax    | IMPLEMENTED | CSRF cookie uses `sameSite: 'strict'`.                                                                            |
| 6.3.4 | Cookie path restricted    | IMPLEMENTED | CSRF cookie path set to `/`.                                                                                      |

---

## 7. File Upload Security

### 7.1 Type Validation

| #     | Check                        | Status          | Notes                                                                                 |
| ----- | ---------------------------- | --------------- | ------------------------------------------------------------------------------------- |
| 7.1.1 | MIME type whitelist enforced | IMPLEMENTED     | `ALLOWED_MIME_TYPES` set in `AttachmentService`: images, PDF, text, office docs, zip. |
| 7.1.2 | File extension validation    | NOT IMPLEMENTED | Only MIME type checked, not file extension.                                           |
| 7.1.3 | Magic byte validation        | NOT IMPLEMENTED | MIME type from `Content-Type` header only; attackers can spoof.                       |
| 7.1.4 | SVG sanitization             | NOT IMPLEMENTED | `image/svg+xml` is allowed but SVGs can contain embedded scripts.                     |

### 7.2 Size Limits

| #     | Check                      | Status      | Notes                                                                                 |
| ----- | -------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| 7.2.1 | Maximum file size enforced | IMPLEMENTED | `UPLOAD_MAX_FILE_SIZE_MB` env var, default 50 MB. Double-checked in service + multer. |
| 7.2.2 | Request body size limited  | PARTIAL     | Multer limit configured; global body-parser limit not explicitly set.                 |

### 7.3 Storage Security

| #     | Check                                  | Status       | Notes                                                                             |
| ----- | -------------------------------------- | ------------ | --------------------------------------------------------------------------------- |
| 7.3.1 | Files stored outside web root          | IMPLEMENTED  | Attachments stored in workspace `.attachments/` directory, served via controller. |
| 7.3.2 | File names sanitized                   | IMPLEMENTED  | `sanitizeFilename()` strips path components and unsafe characters.                |
| 7.3.3 | Directory traversal prevented          | IMPLEMENTED  | `path.basename()` + `resolveSafePath()` (but `resolveSafePath` is a stub).        |
| 7.3.4 | Files served with correct Content-Type | NEEDS REVIEW | `AttachmentService.serve()` returns metadata; caller sets headers.                |

### 7.4 Malware Scanning

| #     | Check                                     | Status          | Notes                             |
| ----- | ----------------------------------------- | --------------- | --------------------------------- |
| 7.4.1 | Antivirus scanning on upload              | NOT IMPLEMENTED | No ClamAV or similar integration. |
| 7.4.2 | Quarantine mechanism for suspicious files | NOT IMPLEMENTED |                                   |

---

## 8. WebSocket Security

### 8.1 Authentication on Connect

| #     | Check                                            | Status          | Notes                                                                                                |
| ----- | ------------------------------------------------ | --------------- | ---------------------------------------------------------------------------------------------------- |
| 8.1.1 | JWT validated on WebSocket handshake             | NOT IMPLEMENTED | `SyncGateway.handleJoin()` has `TODO: validate token and extract userId`. Falls back to `anonymous`. |
| 8.1.2 | Token refresh handled for long-lived connections | NOT IMPLEMENTED | No mechanism to refresh auth during active WS session.                                               |
| 8.1.3 | Unauthenticated connections rejected             | NOT IMPLEMENTED | Anonymous connections allowed; no auth enforcement at gateway level.                                 |

### 8.2 Message Validation

| #     | Check                                    | Status          | Notes                                                                                             |
| ----- | ---------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| 8.2.1 | Message payload schema validated         | NOT IMPLEMENTED | Payloads cast to TypeScript interfaces without runtime validation.                                |
| 8.2.2 | Maximum message size enforced            | NOT IMPLEMENTED | No explicit message size limit on WS frames.                                                      |
| 8.2.3 | Message types restricted to known events | PARTIAL         | `@SubscribeMessage()` handlers only accept registered events, but malformed data is not rejected. |

### 8.3 Rate Limiting

| #     | Check                         | Status          | Notes                                                                               |
| ----- | ----------------------------- | --------------- | ----------------------------------------------------------------------------------- |
| 8.3.1 | Per-user connection limit     | IMPLEMENTED     | `WsConnectionLimitGuard` enforces max 5 connections per user via ValKey sorted set. |
| 8.3.2 | Message rate limiting         | NOT IMPLEMENTED | No per-message rate limiter; rapid update messages could cause DoS.                 |
| 8.3.3 | Connection TTL with heartbeat | PARTIAL         | `lastSeenAt` tracked but no reaping of idle connections.                            |

### 8.4 Authorization

| #     | Check                                 | Status          | Notes                                                             |
| ----- | ------------------------------------- | --------------- | ----------------------------------------------------------------- |
| 8.4.1 | Workspace membership verified on join | NOT IMPLEMENTED | `handleJoin()` does not verify user is a member of the workspace. |
| 8.4.2 | Note access verified (RBAC)           | NOT IMPLEMENTED | No role check before granting edit access to a note.              |
| 8.4.3 | Read-only role enforced for viewers   | NOT IMPLEMENTED | VIEWER role can send updates through WS.                          |

---

## 9. Plugin Security

### 9.1 Sandbox Isolation

| #     | Check                                         | Status          | Notes                                                            |
| ----- | --------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| 9.1.1 | Plugins run in sandboxed iframes              | DESIGNED        | Architecture specifies iframe sandbox. `PluginsService` is stub. |
| 9.1.2 | iframe `sandbox` attribute configured         | NOT IMPLEMENTED | No iframe rendering code yet.                                    |
| 9.1.3 | `allow-scripts` only (no `allow-same-origin`) | NOT IMPLEMENTED | Pending implementation.                                          |
| 9.1.4 | Plugin cannot access parent DOM               | NOT IMPLEMENTED | Pending implementation.                                          |

### 9.2 CSP for Plugin Iframes

| #     | Check                                 | Status          | Notes                                                                                                                    |
| ----- | ------------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| 9.2.1 | Separate CSP for plugin iframe routes | DESIGNED        | `SecurityHeadersMiddleware` notes "CSP for plugin iframes is handled separately via the plugin routes." Not implemented. |
| 9.2.2 | Plugin CSP restricts network access   | NOT IMPLEMENTED |                                                                                                                          |
| 9.2.3 | Plugin CSP restricts script sources   | NOT IMPLEMENTED |                                                                                                                          |

### 9.3 postMessage Validation

| #     | Check                                 | Status          | Notes                                    |
| ----- | ------------------------------------- | --------------- | ---------------------------------------- |
| 9.3.1 | Origin validated on incoming messages | NOT IMPLEMENTED | No postMessage handler code yet.         |
| 9.3.2 | Message schema validated              | NOT IMPLEMENTED |                                          |
| 9.3.3 | Permitted actions whitelisted         | NOT IMPLEMENTED | Plugin SDK designed but not implemented. |
| 9.3.4 | Plugin permissions model enforced     | NOT IMPLEMENTED |                                          |

### 9.4 Plugin Registry Security

| #     | Check                                     | Status          | Notes            |
| ----- | ----------------------------------------- | --------------- | ---------------- |
| 9.4.1 | Plugin source verification (GitHub-based) | NOT IMPLEMENTED | Service is stub. |
| 9.4.2 | Version pinning                           | NOT IMPLEMENTED |                  |
| 9.4.3 | Integrity hash verification               | NOT IMPLEMENTED |                  |

---

## 10. Dependency Security

### 10.1 Known CVEs

| #      | Check                                              | Status       | Notes                                               |
| ------ | -------------------------------------------------- | ------------ | --------------------------------------------------- |
| 10.1.1 | `pnpm audit` runs in CI                            | NEEDS REVIEW | Verify GitHub Actions workflow includes audit step. |
| 10.1.2 | No critical/high CVEs in production dependencies   | NEEDS REVIEW | Run `pnpm audit --production`.                      |
| 10.1.3 | Automated dependency updates (Dependabot/Renovate) | NEEDS REVIEW | Check repository configuration.                     |

### 10.2 Supply Chain

| #      | Check                                | Status          | Notes                                               |
| ------ | ------------------------------------ | --------------- | --------------------------------------------------- |
| 10.2.1 | Lock file integrity (pnpm-lock.yaml) | NEEDS REVIEW    | Verify `pnpm install --frozen-lockfile` in CI.      |
| 10.2.2 | Package provenance verification      | NOT IMPLEMENTED | npm provenance not enforced.                        |
| 10.2.3 | Minimal dependency footprint         | NEEDS REVIEW    | Periodic review recommended.                        |
| 10.2.4 | License compliance checked           | NEEDS REVIEW    | Consider `license-checker` or `pnpm licenses list`. |

---

## 11. Current Implementation Status

### Fully Implemented Security Features

1. **Rate Limiting**: Global (100/min) + profile-based (auth: 5/min, search: 30/min, upload: 10/min) via ValKey-backed distributed throttler.
2. **Account Lockout**: IP and email-based tracking with configurable threshold (10 attempts) and cooldown (30 min).
3. **CSRF Protection**: Double-submit cookie pattern with SameSite=Strict, 256-bit random tokens, path-based exemptions.
4. **Security Headers**: Full suite -- CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS, X-DNS-Prefetch-Control.
5. **CORS**: Explicit origin whitelist with credentials support, restricted headers and methods.
6. **Input Validation**: Global `ValidationPipe` with `whitelist: true, forbidNonWhitelisted: true`.
7. **Error Sanitization**: `AllExceptionsFilter` prevents stack trace and internal detail leakage.
8. **API Key Security**: SHA-256 hashed storage, `nsk_` prefix, permission-based access control, soft revocation.
9. **Password Security**: scrypt hashing (N=16384, r=8, p=1), hashed reset tokens, rate-limited reset flow, anti-enumeration responses.
10. **WebSocket Connection Limits**: Per-user connection cap (5) with ValKey-backed tracking and TTL cleanup.
11. **Audit Logging**: Audit module with interceptor and decorator pattern.
12. **Structured Logging**: Pino JSON logging with correlation IDs.
13. **Monitoring**: Prometheus metrics and OpenTelemetry tracing.

### Partially Implemented

1. **JWT Authentication**: Guard and decorators exist; `loginLocal`, `register`, `refreshTokens` are stubs.
2. **RBAC**: `RolesGuard` exists but not applied on all protected controllers.
3. **TOTP MFA**: Endpoints exist; service methods are stubs.
4. **OIDC/SAML**: Strategy and controller exist; needs integration review.
5. **File Path Security**: `sanitizeFilename()` works; `resolveSafePath()` is a stub.

### Not Implemented (Gaps)

1. **WebSocket authentication**: No JWT validation on WS handshake.
2. **WebSocket message validation**: No Zod/schema validation on WS payloads.
3. **WebSocket RBAC**: No workspace membership or role enforcement.
4. **Plugin sandbox**: Full plugin security layer is designed but not built.
5. **Magic byte validation**: File uploads check MIME type from header only.
6. **SVG sanitization**: SVGs allowed without script stripping.
7. **Re-authentication for sensitive operations**: No step-up auth.
8. **Session idle timeout**: Only absolute JWT expiry.
9. **GDPR data export/deletion**: Not implemented.
10. **Secret rotation documentation**: No runbook.

---

## 12. Identified Gaps & Remediation

### Critical Priority

| Gap                                        | Risk                                        | Remediation                                                                        | Effort |
| ------------------------------------------ | ------------------------------------------- | ---------------------------------------------------------------------------------- | ------ |
| WebSocket auth missing                     | Unauthorized users can edit any note via WS | Validate JWT in `handleConnection` or `handleJoin`; reject unauthenticated clients | Medium |
| WebSocket workspace membership not checked | IDOR via WS; user can join any note room    | Verify workspace membership in `handleJoin` before adding to room                  | Medium |
| `resolveSafePath()` is a stub              | Path traversal in file operations           | Implement: resolve absolute path, verify it starts with workspace root             | Low    |

### High Priority

| Gap                                                   | Risk                                                         | Remediation                                                                      | Effort |
| ----------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| WebSocket message payload validation                  | Malformed Yjs updates could crash server or corrupt data     | Add Zod schemas for all WS message types; validate in handlers                   | Medium |
| SVG upload allows embedded scripts                    | Stored XSS via malicious SVG                                 | Either remove `image/svg+xml` from whitelist or add SVG sanitization (DOMPurify) | Low    |
| Magic byte validation missing                         | MIME spoofing; upload disguised executables                  | Add `file-type` library to validate magic bytes match declared MIME              | Low    |
| `@Roles()` not applied to notes/workspace controllers | Any authenticated user can modify resources in any workspace | Add `@Roles('EDITOR')` minimum to state-changing note endpoints                  | Medium |
| No privilege escalation guard on role updates         | Admin could promote themselves to Owner                      | Add role hierarchy check in `updateMemberRole`                                   | Low    |

### Medium Priority

| Gap                                    | Risk                                  | Remediation                                                                       | Effort |
| -------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| No WebSocket message rate limiting     | DoS via rapid update messages         | Add per-client message throttler (e.g., token bucket in ValKey)                   | Medium |
| No idle session timeout                | Abandoned sessions remain valid       | Add middleware to check `iat` + idle window; force re-auth                        | Medium |
| No re-authentication for sensitive ops | Account takeover via stolen session   | Require password confirmation for TOTP changes, password change, API key creation | Medium |
| JWT likely uses HS256                  | Shared secret risk                    | Migrate to RS256 or ES256 with key pair                                           | Medium |
| Password history not enforced          | Users can reuse compromised passwords | Store last N password hashes; check on reset/change                               | Low    |
| HSTS lacks `preload` directive         | Not eligible for browser preload list | Add `preload` to HSTS header                                                      | Low    |

### Low Priority

| Gap                                   | Risk                                          | Remediation                                            | Effort |
| ------------------------------------- | --------------------------------------------- | ------------------------------------------------------ | ------ |
| No malware scanning on uploads        | Malicious files stored and potentially served | Integrate ClamAV via `clamscan` or clamav.js           | Medium |
| No breached password check            | Users may use known-compromised passwords     | Integrate HaveIBeenPwned API (k-anonymity model)       | Low    |
| GDPR right to erasure not implemented | Regulatory non-compliance                     | Add user data export and deletion endpoints            | High   |
| No secret rotation documentation      | Incident response delayed                     | Document JWT secret, DB credential rotation procedures | Low    |
| Plugin security not implemented       | Future risk when plugins launch               | Implement iframe sandbox, CSP, postMessage validation  | High   |

---

## 13. Penetration Testing Scenarios

### 13.1 Authentication Tests

```
SCENARIO: Brute force login
  GIVEN a valid user email
  WHEN the attacker sends >10 login attempts with wrong passwords
  THEN account lockout is triggered (429 with ACCOUNT_LOCKED code)
  AND the IP is locked for 30 minutes
  AND correct credentials are rejected during lockout

SCENARIO: Credential stuffing
  GIVEN a list of email/password pairs
  WHEN the attacker sends rapid login attempts for multiple accounts
  THEN rate limiting (5 req/min) throttles the attacker
  AND individual email lockout triggers at 10 failed attempts

SCENARIO: Session fixation
  GIVEN an attacker-generated session token
  WHEN a victim authenticates with the attacker's token
  THEN a new session token must be generated (old one invalidated)

SCENARIO: Token in URL leakage
  GIVEN a password reset or email verification link
  WHEN the user follows the link
  THEN the token should not appear in Referrer headers to third parties
  AND the token is consumed (single-use)

SCENARIO: JWT manipulation
  GIVEN a valid JWT
  WHEN the attacker modifies claims (sub, isSuperAdmin, workspaceRole)
  THEN signature verification fails and the request is rejected (401)

SCENARIO: Expired token reuse
  GIVEN a JWT that has expired
  WHEN the attacker sends it as Authorization header
  THEN the request is rejected with 401
```

### 13.2 Authorization Tests

```
SCENARIO: IDOR - accessing another workspace's notes
  GIVEN user A is a member of workspace X but not workspace Y
  WHEN user A requests GET /api/workspaces/{Y}/notes
  THEN the response is 403 Forbidden

SCENARIO: IDOR - modifying another user's note
  GIVEN user A (VIEWER role in workspace X)
  WHEN user A sends PATCH /api/workspaces/{X}/notes/{noteId}
  THEN the response is 403 Forbidden

SCENARIO: Privilege escalation via role update
  GIVEN user A is ADMIN in workspace X
  WHEN user A sends PATCH /api/workspaces/{X}/members/{A} with role=OWNER
  THEN the response is 403 Forbidden

SCENARIO: IDOR - accessing another workspace's API keys
  GIVEN user A has workspace X
  WHEN user A requests GET /api/v1/workspaces/{Y}/api-keys (workspace Y is not theirs)
  THEN the response is 403 Forbidden

SCENARIO: Super-admin bypass
  GIVEN a regular user (isSuperAdmin=false)
  WHEN the user accesses admin endpoints
  THEN SuperAdminGuard rejects with 403

SCENARIO: WebSocket IDOR
  GIVEN user A is not a member of workspace Y
  WHEN user A sends { event: 'join', data: { workspaceId: Y, noteId: Z, token: ... } }
  THEN the join is rejected (membership not verified)
```

### 13.3 Input Validation Tests

```
SCENARIO: XSS via note title
  GIVEN a note creation request
  WHEN the title contains <script>alert(1)</script>
  THEN the HTML is either stripped or escaped in all outputs
  AND CSP prevents script execution even if stored

SCENARIO: XSS via SVG upload
  GIVEN a file upload request
  WHEN the file is an SVG containing <script> or event handlers
  THEN the upload is blocked OR the SVG is sanitized before serving

SCENARIO: SQL injection via search
  GIVEN the search endpoint
  WHEN the query contains ' OR 1=1--
  THEN the query is parameterized and returns no unexpected results
  AND no SQL error is exposed

SCENARIO: Path traversal via filename
  GIVEN an attachment upload
  WHEN the filename is ../../../etc/passwd
  THEN sanitizeFilename() strips it to etc_passwd
  AND the file is stored safely within the workspace directory

SCENARIO: Path traversal via note path
  GIVEN a note creation request
  WHEN the path contains ../../sensitive/data
  THEN the path is validated and rejected

SCENARIO: Command injection via backup path
  GIVEN the backup configuration
  WHEN pg_dump_path is set to a value containing shell metacharacters
  THEN the execution is safe (parameterized, no shell expansion)

SCENARIO: Oversized WebSocket message
  GIVEN an active WebSocket connection
  WHEN the client sends a message >10MB
  THEN the message is rejected or the connection is terminated

SCENARIO: Malformed Yjs update
  GIVEN an active sync session
  WHEN the client sends an invalid Yjs update binary
  THEN the server handles the error gracefully without crashing
```

### 13.4 API Security Tests

```
SCENARIO: CSRF bypass attempt
  GIVEN a state-changing request (POST, PUT, PATCH, DELETE)
  WHEN the X-CSRF-Token header is missing or does not match cookie
  THEN the response is 403 with CSRF_INVALID code

SCENARIO: CORS preflight
  GIVEN an OPTIONS request from a non-whitelisted origin
  WHEN the request is sent
  THEN CORS headers are not present in the response

SCENARIO: Rate limit exhaustion
  GIVEN the login endpoint
  WHEN 6 requests are sent within 60 seconds from the same IP
  THEN the 6th request returns 429 with Retry-After header

SCENARIO: Content-Type confusion
  GIVEN a JSON API endpoint
  WHEN the request Content-Type is text/html with JSON body
  THEN the request is handled safely (body parser rejects or ignores)

SCENARIO: API key revocation
  GIVEN a revoked API key
  WHEN the key is used in X-API-Key header
  THEN the response is 401 with "Invalid or revoked API key"
```

### 13.5 Data Protection Tests

```
SCENARIO: Password reset token reuse
  GIVEN a valid password reset token
  WHEN the token is used once to reset the password
  THEN a second attempt with the same token returns 400

SCENARIO: Email enumeration via password reset
  GIVEN the forgot-password endpoint
  WHEN requests are sent for existing and non-existing emails
  THEN both return the same 200 response with identical message

SCENARIO: Sensitive data in error responses
  GIVEN a request that triggers a database error
  WHEN the error occurs
  THEN the response contains "Database error" with no schema/query details

SCENARIO: Token hash storage
  GIVEN a password reset token is generated
  WHEN the database is queried
  THEN only the SHA-256 hash is stored, not the raw token
```

### 13.6 WebSocket Security Tests

```
SCENARIO: Unauthenticated WebSocket editing
  GIVEN a WebSocket connection with no valid token
  WHEN the client sends join + update messages
  THEN the join is rejected or updates are not applied

SCENARIO: Cross-workspace WebSocket access
  GIVEN user A connected via WebSocket to workspace X
  WHEN user A sends a join message for workspace Y (not a member)
  THEN the join is rejected

SCENARIO: WebSocket connection flood
  GIVEN a single user
  WHEN the user opens 6+ WebSocket connections
  THEN the 6th connection is rejected (connection_limit_exceeded)

SCENARIO: Rapid WebSocket messages
  GIVEN an active WebSocket session
  WHEN 100+ update messages are sent per second
  THEN messages are throttled or the connection is terminated
```

---

## Audit Execution Guide

### Pre-Audit Checklist

- [ ] Access to staging environment with production-like configuration
- [ ] Test accounts with all role types (VIEWER, EDITOR, ADMIN, OWNER, super-admin)
- [ ] Network capture tool (Burp Suite, mitmproxy, or OWASP ZAP)
- [ ] WebSocket testing tool (wscat, websocat, or Postman)
- [ ] Automated scanner (OWASP ZAP, Nikto)
- [ ] Dependency audit results (`pnpm audit`)

### Audit Frequency

| Activity                             | Frequency                     |
| ------------------------------------ | ----------------------------- |
| Automated dependency scan            | Every CI build                |
| Security header verification         | Monthly                       |
| Authentication & authorization tests | Before each release           |
| Full penetration test                | Quarterly                     |
| Third-party security audit           | Annually                      |
| Threat model review                  | On major architecture changes |

### Reporting Template

For each finding:

```
## Finding: [TITLE]

**Severity**: Critical / High / Medium / Low / Informational
**Category**: Authentication / Authorization / Input Validation / API Security / ...
**Status**: Open / In Progress / Mitigated / Accepted
**CVSS Score**: [0-10]

### Description
[What was found]

### Impact
[What could happen if exploited]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]

### Remediation
[How to fix it]

### References
- [CWE/CVE/OWASP reference]
```
