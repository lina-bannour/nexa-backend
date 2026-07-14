import { Module } from '@nestjs/common';
import { AdminModerationController } from './admin-moderation.controller';
import { AdminModerationService } from './admin-moderation.service';

@Module({
  controllers: [AdminModerationController],
  providers: [AdminModerationService],
})
export class AdminModerationModule {}
