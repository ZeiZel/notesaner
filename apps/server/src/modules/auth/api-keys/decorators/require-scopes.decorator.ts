import { SetMetadata } from '@nestjs/common';
import type { UserApiKeyScope } from '../dto/create-api-key.dto';

/**
 * Metadata key for the required API key scopes.
 * Used by UserApiKeyGuard to enforce scope-based access control.
 */
export const REQUIRE_SCOPES_KEY = 'requireApiKeyScopes';

/**
 * Declares the API key scopes required to access a route.
 *
 * When applied, UserApiKeyGuard will verify that the API key
 * includes all listed scopes (using the scope hierarchy:
 * ADMIN > WRITE > READ).
 *
 * For JWT-authenticated requests, scope checks are skipped
 * (JWT users have full access based on their workspace roles).
 *
 * @example
 * // Require read scope
 * @RequireScopes('read')
 * @Get('notes')
 * async listNotes() { ... }
 *
 * @example
 * // Require both read and write scopes
 * @RequireScopes('read', 'write')
 * @Post('notes')
 * async createNote() { ... }
 */
export const RequireScopes = (...scopes: UserApiKeyScope[]) =>
  SetMetadata(REQUIRE_SCOPES_KEY, scopes);
