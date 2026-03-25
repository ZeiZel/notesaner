export interface UserDto {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  isActive: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionDto {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: string;
  createdAt: string;
}

export type AuthProviderType = 'SAML' | 'OIDC' | 'LOCAL';

export interface AuthProviderDto {
  id: string;
  type: AuthProviderType;
  name: string;
  isEnabled: boolean;
}

export interface SAMLConfig {
  entityId: string;
  ssoUrl: string;
  sloUrl?: string;
  certificate: string;
  attributeMapping: {
    email: string;
    name: string;
    groups?: string;
  };
}

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  callbackUrl: string;
}

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
