import { describe, it, expect } from 'vitest';
import {
  SamlConfigSchema,
  OidcConfigSchema,
  CreateAuthProviderSchema,
  UpdateAuthProviderSchema,
  ToggleAuthProviderSchema,
  ListAuthProvidersQuerySchema,
} from '../dto/auth-provider.dto';

// ---------------------------------------------------------------------------
// SamlConfigSchema
// ---------------------------------------------------------------------------

describe('SamlConfigSchema', () => {
  const validSaml = {
    certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
    ssoUrl: 'https://idp.example.com/sso',
    entityId: 'https://app.example.com',
  };

  it('accepts a valid SAML config', () => {
    const result = SamlConfigSchema.safeParse(validSaml);
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = SamlConfigSchema.safeParse({
      ...validSaml,
      emailAttribute: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
      nameAttribute: 'http://schemas.microsoft.com/identity/claims/displayname',
      signRequests: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing certificate', () => {
    const { certificate: _cert, ...rest } = validSaml;
    const result = SamlConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects invalid ssoUrl', () => {
    const result = SamlConfigSchema.safeParse({ ...validSaml, ssoUrl: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('valid URL');
    }
  });

  it('rejects empty entityId', () => {
    const result = SamlConfigSchema.safeParse({ ...validSaml, entityId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects certificate without PEM headers', () => {
    const result = SamlConfigSchema.safeParse({ ...validSaml, certificate: 'plain-base64-nope' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('PEM-encoded');
    }
  });

  it('defaults signRequests to false', () => {
    const result = SamlConfigSchema.safeParse(validSaml);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.signRequests).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// OidcConfigSchema
// ---------------------------------------------------------------------------

describe('OidcConfigSchema', () => {
  const validOidc = {
    issuer: 'https://accounts.google.com',
    clientId: 'my-client-id',
    clientSecret: 'my-client-secret',
  };

  it('accepts a valid OIDC config', () => {
    const result = OidcConfigSchema.safeParse(validOidc);
    expect(result.success).toBe(true);
  });

  it('accepts optional callbackUrl and scopes', () => {
    const result = OidcConfigSchema.safeParse({
      ...validOidc,
      callbackUrl: 'https://app.example.com/callback',
      scopes: ['openid', 'email'],
      emailClaim: 'email',
      nameClaim: 'name',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing issuer', () => {
    const { issuer: _i, ...rest } = validOidc;
    const result = OidcConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it('rejects non-URL issuer', () => {
    const result = OidcConfigSchema.safeParse({ ...validOidc, issuer: 'not-a-url' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.errors[0].message).toContain('valid URL');
    }
  });

  it('rejects empty clientId', () => {
    const result = OidcConfigSchema.safeParse({ ...validOidc, clientId: '' });
    expect(result.success).toBe(false);
  });

  it('rejects empty clientSecret', () => {
    const result = OidcConfigSchema.safeParse({ ...validOidc, clientSecret: '' });
    expect(result.success).toBe(false);
  });

  it('defaults scopes to openid email profile', () => {
    const result = OidcConfigSchema.safeParse(validOidc);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scopes).toEqual(['openid', 'email', 'profile']);
    }
  });

  it('rejects invalid callbackUrl', () => {
    const result = OidcConfigSchema.safeParse({
      ...validOidc,
      callbackUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// CreateAuthProviderSchema — discriminated union
// ---------------------------------------------------------------------------

describe('CreateAuthProviderSchema', () => {
  const samlBase = {
    type: 'SAML' as const,
    name: 'My SAML IdP',
    config: {
      certificate: '-----BEGIN CERTIFICATE-----\nMIIC...\n-----END CERTIFICATE-----',
      ssoUrl: 'https://idp.example.com/sso',
      entityId: 'https://app.example.com',
    },
  };

  const oidcBase = {
    type: 'OIDC' as const,
    name: 'Google OIDC',
    config: {
      issuer: 'https://accounts.google.com',
      clientId: 'my-client',
      clientSecret: 'my-secret',
    },
  };

  it('accepts valid SAML provider', () => {
    expect(CreateAuthProviderSchema.safeParse(samlBase).success).toBe(true);
  });

  it('accepts valid OIDC provider', () => {
    expect(CreateAuthProviderSchema.safeParse(oidcBase).success).toBe(true);
  });

  it('accepts optional workspaceId', () => {
    const result = CreateAuthProviderSchema.safeParse({
      ...oidcBase,
      workspaceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid workspaceId (not a UUID)', () => {
    const result = CreateAuthProviderSchema.safeParse({
      ...oidcBase,
      workspaceId: 'not-a-uuid',
    });
    expect(result.success).toBe(false);
  });

  it('rejects unknown type', () => {
    const result = CreateAuthProviderSchema.safeParse({
      type: 'OAUTH',
      name: 'Test',
      config: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects SAML without required config fields', () => {
    const result = CreateAuthProviderSchema.safeParse({
      ...samlBase,
      config: { ssoUrl: 'https://idp.example.com/sso' }, // missing certificate and entityId
    });
    expect(result.success).toBe(false);
  });

  it('rejects OIDC with missing clientSecret', () => {
    const result = CreateAuthProviderSchema.safeParse({
      ...oidcBase,
      config: { issuer: 'https://accounts.google.com', clientId: 'my-client' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = CreateAuthProviderSchema.safeParse({
      ...oidcBase,
      name: '',
    });
    expect(result.success).toBe(false);
  });

  it('defaults isEnabled to true', () => {
    const result = CreateAuthProviderSchema.safeParse(oidcBase);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isEnabled).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// UpdateAuthProviderSchema
// ---------------------------------------------------------------------------

describe('UpdateAuthProviderSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    expect(UpdateAuthProviderSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial name update', () => {
    expect(UpdateAuthProviderSchema.safeParse({ name: 'New Name' }).success).toBe(true);
  });

  it('accepts isEnabled toggle', () => {
    expect(UpdateAuthProviderSchema.safeParse({ isEnabled: false }).success).toBe(true);
  });

  it('rejects name that is empty string', () => {
    expect(UpdateAuthProviderSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ToggleAuthProviderSchema
// ---------------------------------------------------------------------------

describe('ToggleAuthProviderSchema', () => {
  it('accepts isEnabled=true', () => {
    expect(ToggleAuthProviderSchema.safeParse({ isEnabled: true }).success).toBe(true);
  });

  it('accepts isEnabled=false', () => {
    expect(ToggleAuthProviderSchema.safeParse({ isEnabled: false }).success).toBe(true);
  });

  it('rejects missing isEnabled', () => {
    const result = ToggleAuthProviderSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-boolean isEnabled', () => {
    const result = ToggleAuthProviderSchema.safeParse({ isEnabled: 'yes' });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ListAuthProvidersQuerySchema
// ---------------------------------------------------------------------------

describe('ListAuthProvidersQuerySchema', () => {
  it('accepts empty query', () => {
    expect(ListAuthProvidersQuerySchema.safeParse({}).success).toBe(true);
  });

  it('accepts valid UUID workspaceId', () => {
    const result = ListAuthProvidersQuerySchema.safeParse({
      workspaceId: '00000000-0000-0000-0000-000000000001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid UUID workspaceId', () => {
    const result = ListAuthProvidersQuerySchema.safeParse({ workspaceId: 'abc' });
    expect(result.success).toBe(false);
  });

  it('accepts valid type filters', () => {
    for (const type of ['SAML', 'OIDC', 'LOCAL']) {
      expect(ListAuthProvidersQuerySchema.safeParse({ type }).success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    expect(ListAuthProvidersQuerySchema.safeParse({ type: 'GITHUB' }).success).toBe(false);
  });

  it('transforms isEnabled string to boolean', () => {
    const result = ListAuthProvidersQuerySchema.safeParse({ isEnabled: 'true' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isEnabled).toBe(true);
    }
  });
});
