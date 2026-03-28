import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Put } from '@nestjs/common';
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
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { PreferencesService } from './preferences.service';
import { SetPreferenceDto } from './dto/set-preference.dto';
import { BulkSetPreferencesDto } from './dto/bulk-set-preferences.dto';

@ApiTags('Preferences')
@ApiBearerAuth('bearer')
@Controller('api/preferences')
export class PreferencesController {
  constructor(private readonly preferencesService: PreferencesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all preferences for the authenticated user' })
  @ApiOkResponse({ description: 'Returns all user preferences.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getAll(@CurrentUser() user: JwtPayload) {
    return this.preferencesService.getAll(user.sub);
  }

  // NOTE: The bulk endpoint must be registered BEFORE the :key param route,
  // otherwise NestJS would interpret "bulk" as a key parameter.
  @Put('bulk')
  @ApiOperation({ summary: 'Bulk update multiple preferences' })
  @ApiBody({ type: BulkSetPreferencesDto })
  @ApiOkResponse({ description: 'All preferences updated successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async bulkSet(@CurrentUser() user: JwtPayload, @Body() dto: BulkSetPreferencesDto) {
    return this.preferencesService.bulkSet(user.sub, dto.preferences);
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get a single preference by key' })
  @ApiParam({
    name: 'key',
    description: 'Preference key (e.g. "theme", "editor.fontSize")',
    example: 'theme',
  })
  @ApiOkResponse({ description: 'Returns the preference value.' })
  @ApiNotFoundResponse({ description: 'Preference key not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getByKey(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    return this.preferencesService.getByKey(user.sub, key);
  }

  @Put(':key')
  @ApiOperation({ summary: 'Set (upsert) a single preference' })
  @ApiParam({
    name: 'key',
    description: 'Preference key (e.g. "theme", "editor.fontSize")',
    example: 'theme',
  })
  @ApiBody({ type: SetPreferenceDto })
  @ApiOkResponse({ description: 'Preference set successfully.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async set(
    @CurrentUser() user: JwtPayload,
    @Param('key') key: string,
    @Body() dto: SetPreferenceDto,
  ) {
    return this.preferencesService.set(user.sub, key, dto.value);
  }

  @Delete(':key')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a single preference' })
  @ApiParam({
    name: 'key',
    description: 'Preference key to delete',
    example: 'theme',
  })
  @ApiNoContentResponse({ description: 'Preference deleted successfully.' })
  @ApiNotFoundResponse({ description: 'Preference key not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async delete(@CurrentUser() user: JwtPayload, @Param('key') key: string) {
    await this.preferencesService.delete(user.sub, key);
  }
}
