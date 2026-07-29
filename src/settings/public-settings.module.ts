import { Module } from '@nestjs/common';
import { PublicSettingsController } from './public-settings.controller';
import { PublicSettingsService } from './public-settings.service';

@Module({
  controllers: [PublicSettingsController],
  providers: [PublicSettingsService],
})
export class PublicSettingsModule {}
