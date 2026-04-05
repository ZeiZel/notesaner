import { z } from 'zod';

// ---------------------------------------------------------------------------
// SAML provider config schema
// ---------------------------------------------------------------------------

export const SamlConfigSchema = z.object({
  /** X.509 certificate (PEM) from the IdP for signature verification */
  certificate: z
    .string()
    .min(1, 'SAML certificate is required')
    .refine((v) => v.includes('BEGIN CERTIFICATE') || v.includes('BEGIN X509'), {
      message: 'certificate must be a valid PEM-encoded X.509 certificate',
    }),

  /** IdP Single Sign-On URL */
  ssoUrl: z
    .string()
    .url({ message: 'ssoUrl must be a valid URL' })
    .min(1, 'SAML SSO URL is required'),

  /** SP Entity ID (usually the app's base URL or an urn) */
  entityId: z.string().min(1, 'SAML entity ID is required'),

  /** Optional: attribute name for email (default: NameID) */
  emailAttribute: z.string().optional(),

  /** Optional: attribute name for display name */
  nameAttribute: z.string().optional(),

  /** Sign authentication requests */
  signRequests: z.boolean().optional().default(false),
});

export type SamlConfig = z.infer<typeof SamlConfigSchema>;

// ---------------------------------------------------------------------------
// OIDC provider config schema
// ---------------------------------------------------------------------------

export const OidcConfigSchema = z.object({
  /** OIDC issuer URL (e.g. https://accounts.google.com) */
  issuer: z
    .string()
    .url({ message: 'issuer must be a valid URL' })
    .min(1, 'OIDC issuer is required'),

  /** OAuth2 client ID */
  clientId: z.string().min(1, 'OIDC client ID is required'),

  /** OAuth2 client secret */
  clientSecret: z.string().min(1, 'OIDC client secret is required'),

  /** OAuth2 callback URL registered with the IdP */
  callbackUrl: z.string().url({ message: 'callbackUrl must be a valid URL' }).optional(),

  /** OAuth2 scopes to request (default: openid email profile) */
  scopes: z.array(z.string()).optional().default(['openid', 'email', 'profile']),

  /** Optional: claim name for email (default: email) */
  emailClaim: z.string().optional(),

  /** Optional: claim name for display name (default: name) */
  nameClaim: z.string().optional(),
});

export type OidcConfig = z.infer<typeof OidcConfigSchema>;

// ---------------------------------------------------------------------------
// Provider type discriminated union
// ---------------------------------------------------------------------------

export type AuthProviderConfig = SamlConfig | OidcConfig;

// ---------------------------------------------------------------------------
// Create auth provider DTO
// ---------------------------------------------------------------------------

export const CreateAuthProviderSchema = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('SAML'),
      name: z.string().min(1, 'Provider name is required').max(100),
      /** Optional workspace scoping — null/absent means global provider */
      workspaceId: z.string().uuid().optional().nullable(),
      isEnabled: z.boolean().optional().default(true),
      config: SamlConfigSchema,
    }),
    z.object({
      type: z.literal('OIDC'),
      name: z.string().min(1, 'Provider name is required').max(100),
      workspaceId: z.string().uuid().optional().nullable(),
      isEnabled: z.boolean().optional().default(true),
      config: OidcConfigSchema,
    }),
  ])
  .describe('CreateAuthProviderDto');

export type CreateAuthProviderDto = z.infer<typeof CreateAuthProviderSchema>;

// ---------------------------------------------------------------------------
// Update auth provider DTO (all fields optional except cannot change type)
// ---------------------------------------------------------------------------

export const UpdateAuthProviderSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    isEnabled: z.boolean().optional(),
    config: z.union([SamlConfigSchema.partial(), OidcConfigSchema.partial()]).optional(),
  })
  .describe('UpdateAuthProviderDto');

export type UpdateAuthProviderDto = z.infer<typeof UpdateAuthProviderSchema>;

// ---------------------------------------------------------------------------
// Toggle DTO
// ---------------------------------------------------------------------------

export const ToggleAuthProviderSchema = z.object({
  isEnabled: z.boolean({ message: 'isEnabled is required' }),
});

export type ToggleAuthProviderDto = z.infer<typeof ToggleAuthProviderSchema>;

// ---------------------------------------------------------------------------
// Query / list DTO
// ---------------------------------------------------------------------------

export const ListAuthProvidersQuerySchema = z.object({
  workspaceId: z.string().uuid().optional(),
  type: z.enum(['SAML', 'OIDC', 'LOCAL']).optional(),
  isEnabled: z
    .string()
    .transform((v) => v === 'true')
    .optional(),
});

export type ListAuthProvidersQuery = z.infer<typeof ListAuthProvidersQuerySchema>;
