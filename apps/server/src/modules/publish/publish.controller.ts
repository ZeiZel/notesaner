import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import { PublishService } from './publish.service';

class PublicVaultConfigDto {
  isPublic!: boolean;
  publicSlug?: string;
  customDomain?: string;
}

@Controller()
export class PublishController {
  constructor(private readonly publishService: PublishService) {}

  // Publishing management (authenticated)
  @Post('workspaces/:workspaceId/notes/:noteId/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async publishNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.publishService.publishNote(workspaceId, noteId);
  }

  @Delete('workspaces/:workspaceId/notes/:noteId/publish')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unpublishNote(
    @Param('workspaceId') workspaceId: string,
    @Param('noteId') noteId: string,
  ) {
    await this.publishService.unpublishNote(workspaceId, noteId);
  }

  @Put('workspaces/:workspaceId/publish-config')
  async setPublicVault(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: PublicVaultConfigDto,
  ) {
    return this.publishService.setPublicVault(workspaceId, dto);
  }

  @Get('workspaces/:workspaceId/publish-config')
  async getPublicVaultConfig(@Param('workspaceId') workspaceId: string) {
    return this.publishService.getPublicVaultConfig(workspaceId);
  }

  // Public access (no auth required)
  @Public()
  @Get('public/:publicSlug')
  async getPublicVaultIndex(@Param('publicSlug') publicSlug: string) {
    return this.publishService.renderVaultIndex(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/nav')
  async getPublicNavigation(@Param('publicSlug') publicSlug: string) {
    return this.publishService.getPublicNavigation(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/graph')
  async getPublicGraph(@Param('publicSlug') publicSlug: string) {
    return this.publishService.getGraphData(publicSlug);
  }

  @Public()
  @Get('public/:publicSlug/notes/*')
  async getPublicNote(
    @Param('publicSlug') publicSlug: string,
    @Param() params: Record<string, string>,
  ) {
    const notePath = params['0'] ?? '';
    return this.publishService.renderNote(publicSlug, notePath);
  }
}
