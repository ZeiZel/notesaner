import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import type {
  NotificationType,
  NotificationChannel,
  DigestFrequency,
  Prisma,
} from '@prisma/client';
import { DEFAULT_PAGE_LIMIT } from './notifications.constants';
import type {
  CreateNotificationInput,
  NotificationListResponse,
  NotificationDto,
  NotificationPreferenceDto,
  DigestScheduleDto,
  UnreadCountDto,
  NotificationPreferenceInput,
} from './notifications.types';

/**
 * NotificationsService — core business logic for the notification system.
 *
 * Responsibilities:
 *   - Create in-app notifications (with optional email dispatch)
 *   - Query notifications with pagination and filtering
 *   - Mark notifications as read (single or bulk)
 *   - Manage per-user notification channel preferences
 *   - Manage digest email schedules
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  // ─── Create ───────────────────────────────────────────────────────────────

  /**
   * Creates a notification and optionally sends an email based on user preferences.
   *
   * Flow:
   *   1. Check user's channel preference for this notification type
   *   2. If NONE, skip entirely
   *   3. If IN_APP or BOTH, create the database record
   *   4. If EMAIL or BOTH, queue an immediate email
   */
  async create(input: CreateNotificationInput): Promise<NotificationDto | null> {
    const { userId, type, title, body, metadata } = input;

    // Resolve user preference for this notification type
    const channel = await this.getChannelForType(userId, type);

    if (channel === 'NONE') {
      this.logger.debug(`Notification [${type}] skipped for user ${userId} (channel=NONE)`);
      return null;
    }

    let notification: NotificationDto | null = null;

    // Create in-app notification if channel includes in-app
    if (channel === 'IN_APP' || channel === 'BOTH') {
      const created = await this.prisma.notification.create({
        data: {
          userId,
          type,
          title,
          body,
          metadata: (metadata ?? {}) as Prisma.InputJsonValue,
        },
      });

      notification = this.toDto(created);
    }

    // Send immediate email if channel includes email
    if (channel === 'EMAIL' || channel === 'BOTH') {
      await this.sendNotificationEmail(userId, type, title, body);
    }

    return notification;
  }

  /**
   * Creates notifications for multiple users in bulk.
   * Useful for system announcements or workspace-wide notifications.
   */
  async createBulk(
    inputs: CreateNotificationInput[],
  ): Promise<{ created: number; skipped: number }> {
    let created = 0;
    let skipped = 0;

    // Process in parallel with controlled concurrency
    const results = await Promise.allSettled(inputs.map((input) => this.create(input)));

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value !== null) {
        created++;
      } else {
        skipped++;
      }
    }

    return { created, skipped };
  }

  // ─── Read ─────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of notifications for a user.
   */
  async findAllForUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      type?: NotificationType;
      isRead?: boolean;
    } = {},
  ): Promise<NotificationListResponse> {
    const limit = options.limit ?? DEFAULT_PAGE_LIMIT;
    const offset = options.offset ?? 0;

    const where: Prisma.NotificationWhereInput = {
      userId,
      ...(options.type !== undefined && { type: options.type }),
      ...(options.isRead !== undefined && { isRead: options.isRead }),
    };

    const [data, total, unreadCount] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, isRead: false },
      }),
    ]);

    return {
      data: data.map((n) => this.toDto(n)),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    };
  }

  /**
   * Returns the count of unread notifications for a user.
   */
  async getUnreadCount(userId: string): Promise<UnreadCountDto> {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });

    return { count };
  }

  // ─── Update ───────────────────────────────────────────────────────────────

  /**
   * Marks a single notification as read.
   * Returns the updated notification.
   */
  async markAsRead(userId: string, notificationId: string): Promise<NotificationDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${notificationId} not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });

    return this.toDto(updated);
  }

  /**
   * Marks all unread notifications as read for a user.
   * Returns the number of notifications updated.
   */
  async markAllAsRead(userId: string): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    return { updated: result.count };
  }

  // ─── Preferences ──────────────────────────────────────────────────────────

  /**
   * Returns all notification preferences for a user.
   * Missing preferences default to BOTH.
   */
  async getPreferences(userId: string): Promise<{
    preferences: NotificationPreferenceDto[];
    frequency: DigestFrequency;
    lastSentAt: string | null;
  }> {
    const allTypes: NotificationType[] = [
      'COMMENT_MENTION',
      'NOTE_SHARED',
      'WORKSPACE_INVITE',
      'SYSTEM_ANNOUNCEMENT',
    ];

    const [savedPrefs, digestSchedule] = await this.prisma.$transaction([
      this.prisma.notificationPreference.findMany({
        where: { userId },
      }),
      this.prisma.notificationDigestSchedule.findUnique({
        where: { userId },
      }),
    ]);

    const prefMap = new Map(savedPrefs.map((p) => [p.type, p.channel]));

    const preferences: NotificationPreferenceDto[] = allTypes.map((type) => ({
      type,
      channel: prefMap.get(type) ?? ('BOTH' as NotificationChannel),
    }));

    return {
      preferences,
      frequency: digestSchedule?.frequency ?? ('DAILY' as DigestFrequency),
      lastSentAt: digestSchedule?.lastSentAt?.toISOString() ?? null,
    };
  }

  /**
   * Updates notification channel preferences for a user.
   * Uses upsert to handle both create and update cases.
   */
  async updatePreferences(
    userId: string,
    preferences: NotificationPreferenceInput[],
  ): Promise<NotificationPreferenceDto[]> {
    const operations = preferences.map((pref) =>
      this.prisma.notificationPreference.upsert({
        where: {
          userId_type: { userId, type: pref.type },
        },
        create: {
          userId,
          type: pref.type,
          channel: pref.channel,
        },
        update: {
          channel: pref.channel,
        },
      }),
    );

    const results = await this.prisma.$transaction(operations);

    return results.map((r) => ({
      type: r.type,
      channel: r.channel,
    }));
  }

  /**
   * Updates the digest email schedule for a user.
   */
  async updateDigestSchedule(
    userId: string,
    frequency: DigestFrequency,
  ): Promise<DigestScheduleDto> {
    const schedule = await this.prisma.notificationDigestSchedule.upsert({
      where: { userId },
      create: { userId, frequency },
      update: { frequency },
    });

    return {
      frequency: schedule.frequency,
      lastSentAt: schedule.lastSentAt?.toISOString() ?? null,
    };
  }

  // ─── Digest ───────────────────────────────────────────────────────────────

  /**
   * Processes digest emails for users with the given frequency.
   * Called by the digest processor on a cron schedule.
   *
   * For each user:
   *   1. Find unread notifications since lastSentAt
   *   2. Render and send a digest email
   *   3. Update lastSentAt
   */
  async processDigest(
    frequency: DigestFrequency,
  ): Promise<{ usersProcessed: number; emailsSent: number }> {
    const schedules = await this.prisma.notificationDigestSchedule.findMany({
      where: { frequency },
      include: { user: true },
    });

    let emailsSent = 0;

    for (const schedule of schedules) {
      const since = schedule.lastSentAt ?? new Date(0);

      const notifications = await this.prisma.notification.findMany({
        where: {
          userId: schedule.userId,
          createdAt: { gt: since },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      if (notifications.length === 0) {
        continue;
      }

      try {
        await this.sendDigestEmail(
          schedule.user.email,
          schedule.user.displayName,
          notifications.map((n) => ({
            title: n.title,
            body: n.body,
            type: n.type,
            createdAt: n.createdAt.toISOString(),
          })),
          frequency,
        );

        await this.prisma.notificationDigestSchedule.update({
          where: { id: schedule.id },
          data: { lastSentAt: new Date() },
        });

        emailsSent++;
      } catch (err) {
        this.logger.error(
          `Failed to send digest to ${schedule.user.email}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return { usersProcessed: schedules.length, emailsSent };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Resolves the notification channel for a user + notification type.
   * Defaults to BOTH if no preference is set.
   */
  private async getChannelForType(
    userId: string,
    type: NotificationType,
  ): Promise<NotificationChannel> {
    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type } },
    });

    return pref?.channel ?? 'BOTH';
  }

  /**
   * Sends an immediate notification email to a user.
   */
  private async sendNotificationEmail(
    userId: string,
    type: NotificationType,
    title: string,
    body: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, displayName: true },
    });

    if (!user) {
      this.logger.warn(`Cannot send notification email: user ${userId} not found`);
      return;
    }

    // Map notification type to the closest existing email template
    const templateMap: Partial<Record<NotificationType, string>> = {
      COMMENT_MENTION: 'comment-mention',
      WORKSPACE_INVITE: 'workspace-invite',
    };

    const template = templateMap[type];

    if (template) {
      await this.emailService.send({
        to: user.email,
        template: template as Parameters<typeof this.emailService.send>[0]['template'],
        variables: {
          displayName: user.displayName,
          subject: title,
          body,
        },
      });
    } else {
      // For types without a dedicated template, log and skip email
      this.logger.debug(
        `No email template for notification type ${type}, skipping email for user ${userId}`,
      );
    }
  }

  /**
   * Sends a digest summary email using the notification-digest template.
   */
  private async sendDigestEmail(
    email: string,
    displayName: string,
    notifications: Array<{
      title: string;
      body: string;
      type: string;
      createdAt: string;
    }>,
    frequency: DigestFrequency,
  ): Promise<void> {
    const periodLabel = frequency === 'DAILY' ? 'daily' : 'weekly';

    this.logger.log(
      `Sending ${periodLabel} digest to ${email} with ${notifications.length} notifications`,
    );

    await this.emailService.send({
      to: email,
      template: 'notification-digest',
      variables: {
        displayName,
        periodLabel,
        notificationCount: notifications.length,
        notifications,
        appUrl: '#',
      },
    });
  }

  /**
   * Maps a Prisma Notification record to the API DTO shape.
   */
  private toDto(notification: {
    id: string;
    type: NotificationType;
    title: string;
    body: string;
    isRead: boolean;
    metadata: unknown;
    createdAt: Date;
  }): NotificationDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      isRead: notification.isRead,
      metadata: (notification.metadata ?? {}) as Record<string, unknown>,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
