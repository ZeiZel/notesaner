import { Injectable, NotImplementedException } from '@nestjs/common';

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

export interface AuthProvider {
  id: string;
  type: string;
  name: string;
  loginUrl: string;
}

@Injectable()
export class AuthService {
  async loginLocal(
    _email: string,
    _password: string,
    _totpCode?: string,
  ): Promise<AuthTokens> {
    throw new NotImplementedException('loginLocal not yet implemented');
  }

  async register(_dto: { email: string; password: string; displayName: string }): Promise<unknown> {
    throw new NotImplementedException('register not yet implemented');
  }

  async refreshTokens(_refreshToken: string): Promise<AuthTokens> {
    throw new NotImplementedException('refreshTokens not yet implemented');
  }

  async logout(_sessionId: string): Promise<void> {
    throw new NotImplementedException('logout not yet implemented');
  }

  async getMe(_userId: string): Promise<unknown> {
    throw new NotImplementedException('getMe not yet implemented');
  }

  async getUserSessions(_userId: string): Promise<unknown[]> {
    throw new NotImplementedException('getUserSessions not yet implemented');
  }

  async revokeSession(_userId: string, _sessionId: string): Promise<void> {
    throw new NotImplementedException('revokeSession not yet implemented');
  }

  async getEnabledProviders(): Promise<{ providers: AuthProvider[]; localEnabled: boolean }> {
    throw new NotImplementedException('getEnabledProviders not yet implemented');
  }

  async enableTotp(_userId: string): Promise<{ secret: string; qrCodeDataUrl: string }> {
    throw new NotImplementedException('enableTotp not yet implemented');
  }

  async verifyTotp(_userId: string, _token: string): Promise<{ enabled: boolean }> {
    throw new NotImplementedException('verifyTotp not yet implemented');
  }

  async disableTotp(_userId: string): Promise<void> {
    throw new NotImplementedException('disableTotp not yet implemented');
  }
}
