import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

class LoginDto {
  email!: string;
  password!: string;
  totpCode?: string;
}

class RegisterDto {
  email!: string;
  password!: string;
  displayName!: string;
}

class RefreshDto {
  refreshToken!: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.loginLocal(dto.email, dto.password, dto.totpCode);
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sessionId);
  }

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Get('sessions')
  async getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getUserSessions(user.sub);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: JwtPayload,
    @Param('sessionId') sessionId: string,
  ) {
    await this.authService.revokeSession(user.sub, sessionId);
  }

  @Public()
  @Get('providers')
  async getProviders() {
    return this.authService.getEnabledProviders();
  }

  @Post('totp/enable')
  async enableTotp(@CurrentUser() user: JwtPayload) {
    return this.authService.enableTotp(user.sub);
  }

  @Post('totp/verify')
  async verifyTotp(@CurrentUser() user: JwtPayload, @Body() body: { token: string }) {
    return this.authService.verifyTotp(user.sub, body.token);
  }

  @Delete('totp')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableTotp(@CurrentUser() user: JwtPayload) {
    await this.authService.disableTotp(user.sub);
  }
}
