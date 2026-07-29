import { Controller, Get } from '@nestjs/common';
import { PublicSettingsService } from './public-settings.service';

@Controller('settings')
export class PublicSettingsController {
  constructor(private readonly service: PublicSettingsService) {}

  // Public (no auth needed) — powers the "Barème" section on the
  // student profile's Progression screen.
  @Get('bareme')
  getBareme() {
    return this.service.getBareme();
  }
}
