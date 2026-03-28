import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiCreatedResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { AuthRateLimit } from '../../common/decorators/throttle.decorator';
import { AuthService } from './auth.service';

// ── DTOs ────────────────────────────────────────────────────────────────────

class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ description: 'User password', example: 'securePassword123' })
  password!: string;

  @ApiPropertyOptional({
    description: 'TOTP code for two-factor authentication',
    example: '123456',
  })
  totpCode?: string;
}

class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'alice@example.com' })
  email!: string;

  @ApiProperty({ description: 'User password (min 8 characters)', example: 'securePassword123' })
  password!: string;

  @ApiProperty({ description: 'Display name', example: 'Alice Johnson' })
  displayName!: string;
}

class RefreshDto {
  @ApiProperty({ description: 'JWT refresh token', example: 'eyJhbGciOiJIUzI1NiIs...' })
  refreshToken!: string;
}

class TotpVerifyDto {
  @ApiProperty({ description: 'TOTP verification token', example: '123456' })
  token!: string;
}

class ForgotPasswordBodyDto {
  @ApiProperty({ description: 'Email address of the account', example: 'alice@example.com' })
  email!: string;
}

class ResetPasswordBodyDto {
  @ApiProperty({ description: 'Password reset token from the email link' })
  token!: string;

  @ApiProperty({ description: 'New password (min 8 characters)', example: 'newSecurePassword123' })
  password!: string;
}

class ResendVerificationBodyDto {
  @ApiProperty({
    description: 'Email address of the unverified account',
    example: 'alice@example.com',
  })
  email!: string;
}

// ── Controller ──────────────────────────────────────────────────────────────

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @AuthRateLimit()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ description: 'Login successful. Returns access and refresh tokens.' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or TOTP code.' })
  async login(@Body() dto: LoginDto) {
    return this.authService.loginLocal(dto.email, dto.password, dto.totpCode);
  }

  @Public()
  @AuthRateLimit()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user account' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ description: 'User registered successfully.' })
  @ApiConflictResponse({ description: 'A user with this email already exists.' })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiBody({ type: RefreshDto })
  @ApiOkResponse({ description: 'New access and refresh tokens issued.' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token.' })
  async refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Log out and invalidate the current session' })
  @ApiNoContentResponse({ description: 'Session invalidated successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async logout(@CurrentUser() user: JwtPayload) {
    await this.authService.logout(user.sessionId);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  @ApiOkResponse({ description: 'Returns the current user profile.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getMe(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Get('sessions')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List all active sessions for the current user' })
  @ApiOkResponse({ description: 'Returns a list of active sessions.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getSessions(@CurrentUser() user: JwtPayload) {
    return this.authService.getUserSessions(user.sub);
  }

  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke a specific session' })
  @ApiParam({ name: 'sessionId', description: 'Session ID to revoke', type: String })
  @ApiNoContentResponse({ description: 'Session revoked successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async revokeSession(@CurrentUser() user: JwtPayload, @Param('sessionId') sessionId: string) {
    await this.authService.revokeSession(user.sub, sessionId);
  }

  @Public()
  @Get('providers')
  @ApiOperation({ summary: 'List enabled authentication providers' })
  @ApiOkResponse({ description: 'Returns enabled auth providers (SAML, OIDC, LOCAL).' })
  async getProviders() {
    return this.authService.getEnabledProviders();
  }

  @Post('totp/enable')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Enable TOTP two-factor authentication' })
  @ApiOkResponse({ description: 'Returns TOTP secret and QR code URI.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async enableTotp(@CurrentUser() user: JwtPayload) {
    return this.authService.enableTotp(user.sub);
  }

  @Post('totp/verify')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Verify and confirm TOTP setup' })
  @ApiBody({ type: TotpVerifyDto })
  @ApiOkResponse({ description: 'TOTP verified and activated.' })
  @ApiUnauthorizedResponse({ description: 'Invalid TOTP code.' })
  async verifyTotp(@CurrentUser() user: JwtPayload, @Body() body: TotpVerifyDto) {
    return this.authService.verifyTotp(user.sub, body.token);
  }

  @Delete('totp')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Disable TOTP two-factor authentication' })
  @ApiNoContentResponse({ description: 'TOTP disabled successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async disableTotp(@CurrentUser() user: JwtPayload) {
    await this.authService.disableTotp(user.sub);
  }

  // ===========================================================================
  // Password Reset
  // ===========================================================================

  @Public()
  @AuthRateLimit()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Request a password reset email',
    description:
      'Sends a password reset email if the account exists. Always returns 200 to prevent email enumeration. Rate-limited to 3 requests per hour per email.',
  })
  @ApiBody({ type: ForgotPasswordBodyDto })
  @ApiOkResponse({ description: 'Request accepted (always returns success).' })
  async forgotPassword(@Body() body: ForgotPasswordBodyDto) {
    return this.authService.forgotPassword(body);
  }

  @Public()
  @Get('reset-password')
  @ApiOperation({
    summary: 'Validate a password reset token',
    description:
      'Checks whether a password reset token is valid and not expired. Does not consume the token.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Password reset token from the email link',
    type: String,
  })
  @ApiOkResponse({ description: 'Returns { valid: true } or { valid: false }.' })
  async validateResetToken(@Query('token') token: string) {
    return this.authService.validateResetToken(token);
  }

  @Public()
  @AuthRateLimit()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reset password using a valid token',
    description:
      'Sets a new password using a valid password reset token. Invalidates all existing sessions for the user.',
  })
  @ApiBody({ type: ResetPasswordBodyDto })
  @ApiOkResponse({ description: 'Password reset successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token.' })
  async resetPassword(@Body() body: ResetPasswordBodyDto) {
    return this.authService.resetPassword(body);
  }

  // ===========================================================================
  // Email Verification
  // ===========================================================================

  @Public()
  @Get('verify-email')
  @ApiOperation({
    summary: 'Verify email address using token',
    description:
      'Verifies the user email address by consuming the verification token sent via email.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Email verification token from the email link',
    type: String,
  })
  @ApiOkResponse({ description: 'Email verified successfully.' })
  @ApiBadRequestResponse({ description: 'Invalid or expired verification token.' })
  async verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail({ token });
  }

  @Public()
  @AuthRateLimit()
  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Resend email verification email',
    description:
      'Resends the verification email for an unverified account. Always returns 200 to prevent email enumeration. Rate-limited to 3 requests per hour per email.',
  })
  @ApiBody({ type: ResendVerificationBodyDto })
  @ApiOkResponse({ description: 'Request accepted (always returns success).' })
  async resendVerification(@Body() body: ResendVerificationBodyDto) {
    return this.authService.resendVerificationEmail(body);
  }
}
