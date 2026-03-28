import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import {
  GetNotificationsDto,
  UpdateNotificationPreferencesDto,
  UpdateDigestScheduleDto,
} from './dto';

/**
 * NotificationsController — REST endpoints for the notification system.
 *
 * All endpoints require JWT authentication. The authenticated user's ID
 * is automatically extracted from the token — users can only access
 * their own notifications and preferences.
 */
@ApiTags('Notifications')
@ApiBearerAuth('bearer')
@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  // ─── Notification list ──────────────────────────────────────────────────

  @Get()
  @ApiOperation({ summary: 'List notifications for the authenticated user' })
  @ApiOkResponse({ description: 'Paginated list of notifications with unread count.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getNotifications(@CurrentUser() user: JwtPayload, @Query() query: GetNotificationsDto) {
    return this.notificationsService.findAllForUser(user.sub, {
      limit: query.limit,
      offset: query.offset,
      type: query.type,
      isRead: query.isRead,
    });
  }

  // ─── Unread count ─────────────────────────────────────────────────────

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count' })
  @ApiOkResponse({ description: 'Unread count object.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getUnreadCount(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getUnreadCount(user.sub);
  }

  // ─── Mark single as read ──────────────────────────────────────────────

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a single notification as read' })
  @ApiOkResponse({ description: 'The updated notification.' })
  @ApiNotFoundResponse({ description: 'Notification not found.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async markAsRead(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markAsRead(user.sub, id);
  }

  // ─── Mark all as read ─────────────────────────────────────────────────

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark all notifications as read' })
  @ApiOkResponse({ description: 'Number of notifications updated.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async markAllAsRead(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.markAllAsRead(user.sub);
  }

  // ─── Preferences ──────────────────────────────────────────────────────

  @Get('preferences')
  @ApiOperation({ summary: 'Get notification preferences and digest schedule' })
  @ApiOkResponse({ description: 'Notification preferences and digest schedule.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async getPreferences(@CurrentUser() user: JwtPayload) {
    return this.notificationsService.getPreferences(user.sub);
  }

  @Put('preferences')
  @ApiOperation({ summary: 'Update notification channel preferences' })
  @ApiOkResponse({ description: 'Updated notification preferences.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updatePreferences(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.updatePreferences(user.sub, dto.preferences);
  }

  // ─── Digest schedule ──────────────────────────────────────────────────

  @Put('digest')
  @ApiOperation({ summary: 'Update digest email schedule' })
  @ApiOkResponse({ description: 'Updated digest schedule.' })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async updateDigestSchedule(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDigestScheduleDto,
  ) {
    return this.notificationsService.updateDigestSchedule(user.sub, dto.frequency);
  }
}
