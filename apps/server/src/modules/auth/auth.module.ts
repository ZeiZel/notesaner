import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthProvidersController } from './admin-auth-providers.controller';
import { AdminAuthProvidersService } from './admin-auth-providers.service';
import { UserApiKeyController } from './api-keys/api-key.controller';
import { UserApiKeyService } from './api-keys/api-key.service';
import { UserApiKeyGuard } from './api-keys/api-key.guard';
import { EmailModule } from '../email/email.module';
import { ValkeyModule } from '../valkey/valkey.module';

@Module({
  imports: [
    PassportModule.register({ session: false }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '15m', algorithm: 'HS256' },
      }),
      inject: [ConfigService],
    }),
    // EmailModule provides EmailService for sending verification and reset emails.
    EmailModule,
    // ValkeyModule provides ValkeyService for rate limiting.
    // It is @Global() so importing it here makes it available to all modules.
    ValkeyModule,
  ],
  controllers: [AuthController, AdminAuthProvidersController, UserApiKeyController],
  providers: [AuthService, AdminAuthProvidersService, UserApiKeyService, UserApiKeyGuard],
  exports: [AuthService, JwtModule, UserApiKeyService, UserApiKeyGuard],
})
export class AuthModule {}
