import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { AdminModerationService } from './admin-moderation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { IsIn } from 'class-validator';

class UpdatePostStatusDto {
  @IsIn(['PUBLISHED', 'REMOVED']) status: 'PUBLISHED' | 'REMOVED';
}

@UseGuards(JwtAuthGuard)
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(private readonly adminModerationService: AdminModerationService) {}

  @Get('stats')
  getForumStats() { return this.adminModerationService.getForumStats(); }

  @Get('reported')
  getReportedPosts() { return this.adminModerationService.getReportedPosts(); }

  @Get('posts')
  getAllPosts() { return this.adminModerationService.getAllPosts(); }

  @Patch('posts/:id/status')
  updatePostStatus(@Param('id') id: string, @Body() dto: UpdatePostStatusDto) {
    return this.adminModerationService.updatePostStatus(id, dto.status);
  }
}
