/**
 * Zod schema for the OIDC provider configuration stored in AuthProvider.config JSON.
 *
 * Config is stored as-is in the database; this schema is the runtime boundary
 * that validates and types the JSON blob before use in the OIDC strategy.
 */

import { z } from 'zod';

export const OidcProviderConfigSchema = z.object({
  /**
   * OIDC issuer URL used to discover provider metadata via
   * ${issuerUrl}/.well-known/openid-configuration
   *
   * Example: https://accounts.google.com
   * Example: https://keycloak.example.com/realms/myrealm
   */
  issuerUrl: z.string().url('issuerUrl must be a valid URL'),

  /**
   * Client ID registered with the OIDC provider.
   */
  clientId: z.string().min(1, 'clientId is required'),

  /**
   * Client secret. May be empty string for public clients using PKCE only.
   * For confidential clients (server-side) this must be provided.
   */
  clientSecret: z.string().optional(),

  /**
   * Additional scopes to request beyond the mandatory "openid profile email".
   * Example: ["groups", "roles"]
   */
  additionalScopes: z.array(z.string()).optional(),

  /**
   * Optional claims mapping overrides.
   * Keys are target field names (email, displayName, avatarUrl),
   * values are the claim names returned by the OIDC provider.
   * Example: { email: "upn", displayName: "name", avatarUrl: "picture" }
   */
  claimsMapping: z
    .object({
      email: z.string().optional(),
      displayName: z.string().optional(),
      avatarUrl: z.string().optional(),
    })
    .optional(),

  /**
   * Whether to use PKCE (Proof Key for Code Exchange) for the authorization
   * code flow. Required for public clients; recommended for all clients.
   * Defaults to true.
   */
  pkce: z.boolean().default(true),
});

export type OidcProviderConfig = z.infer<typeof OidcProviderConfigSchema>;

/**
 * Schema for creating an OIDC auth provider via the admin API.
 */
export const CreateOidcProviderDto = z.object({
  /** Human-readable name shown in the login UI */
  name: z.string().min(1).max(100),
  /** Optional workspace ID; null = global provider */
  workspaceId: z.string().uuid().optional().nullable(),
  /** Whether this provider is active */
  isEnabled: z.boolean().default(true),
  /** OIDC configuration */
  config: OidcProviderConfigSchema,
});

export const UpdateOidcProviderDto = z.object({
  name: z.string().min(1).max(100).optional(),
  isEnabled: z.boolean().optional(),
  config: OidcProviderConfigSchema.partial().optional(),
});

export type CreateOidcProviderDtoType = z.infer<typeof CreateOidcProviderDto>;
export type UpdateOidcProviderDtoType = z.infer<typeof UpdateOidcProviderDto>;
