import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { SetPreferenceDto } from './dto/set-preference.dto';
import { BulkSetPreferencesDto } from './dto/bulk-set-preferences.dto';

@ApiTags('Preferences')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  /**
   * GET /users/me/preferences
   * Returns all preferences as a key-value map, merged with defaults.
   */
  @Get()
  @ApiOperation({ summary: 'Get all preferences for the authenticated user' })
  @ApiOkResponse({ description: 'Returns all user preferences as a key-value map.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getAll(@CurrentUser() user: JwtPayload) {
    return this.preferencesService.getAll(user.sub);
  }

  /**
   * PATCH /users/me/preferences
   * Upsert preferences (partial update). Accepts a key-value map or entries array.
   */
  @Patch()
  @ApiOperation({ summary: 'Upsert multiple preferences (partial update)' })
  @ApiBody({ type: BulkSetPreferencesDto })
  @ApiOkResponse({ description: 'Preferences updated. Returns the full preferences map.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiBadRequestResponse({
    description: 'Invalid namespace, value too large, or key limit exceeded.',
  })
  async bulkSet(@CurrentUser() user: JwtPayload, @Body() dto: BulkSetPreferencesDto) {
    return this.preferencesService.bulkSet(user.sub, dto.preferences);
  }

  /**
   * GET /users/me/preferences/:key
   * Get a single preference by key. Returns default if not stored.
   */
  @Get(':key')
  @ApiOperation({ summary: 'Get a single preference by key' })
  @ApiParam({
    name: 'key',
    description: 'Preference key (e.g. "theme.mode", "editor.fontSize")',
    example: 'theme.mode',
  })
  @ApiOkResponse({ description: 'Returns the preference value.' })
  @ApiNotFoundResponse({ description: 'Preference key not found and has no default.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiBadRequestResponse({ description: 'Invalid preference namespace.' })
  async getByKey(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return this.preferencesService.getByKey(user.sub, key);
  }

  /**
   * PATCH /users/me/preferences/:key
   * Set (upsert) a single preference.
   */
  @Patch(':key')
  @ApiOperation({ summary: 'Set (upsert) a single preference' })
  @ApiParam({
    name: 'key',
    description: 'Preference key (e.g. "theme.mode", "editor.fontSize")',
    example: 'theme.mode',
  })
  @ApiBody({ type: SetPreferenceDto })
  @ApiOkResponse({ description: 'Preference set successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiBadRequestResponse({
    description: 'Invalid namespace, value too large, or key limit exceeded.',
  })
  async set(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: SetPreferenceDto,
  ) {
    return this.preferencesService.set(user.sub, key, dto.value);
  }

  /**
   * DELETE /users/me/preferences/:key
   * Delete a single preference.
   */
  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single preference' })
  @ApiParam({
    name: 'key',
    description: 'Preference key to delete',
    example: 'theme.mode',
  })
  @ApiNoContentResponse({ description: 'Preference deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Preference key not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  @ApiBadRequestResponse({ description: 'Invalid preference namespace.' })
  async delete(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    await this.preferencesService.delete(user.sub, key);
  }
}
