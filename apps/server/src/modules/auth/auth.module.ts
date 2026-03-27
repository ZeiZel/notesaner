import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AdminAuthProvidersController } from './admin-auth-providers.controller';
import { AdminAuthProvidersService } from './admin-auth-providers.service';

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
  ],
  controllers: [AuthController, AdminAuthProvidersController],
  providers: [AuthService, AdminAuthProvidersService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
