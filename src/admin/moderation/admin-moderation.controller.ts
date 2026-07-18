import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { AdminModerationService } from './admin-moderation.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

class UpdatePostStatusDto {
  @IsIn(['PUBLISHED', 'REMOVED'])
  status: 'PUBLISHED' | 'REMOVED';
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/moderation')
export class AdminModerationController {
  constructor(
    private readonly adminModerationService: AdminModerationService,
  ) {}

  @Get('stats')
  getForumStats() {
    return this.adminModerationService.getForumStats();
  }

  @Get('reported')
  getReportedPosts() {
    return this.adminModerationService.getReportedPosts();
  }

  @Get('posts')
  getAllPosts() {
    return this.adminModerationService.getAllPosts();
  }

  @Patch('posts/:id/status')
  updatePostStatus(@Param('id') id: string, @Body() dto: UpdatePostStatusDto) {
    return this.adminModerationService.updatePostStatus(id, dto.status);
  }
}
