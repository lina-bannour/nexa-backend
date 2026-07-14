import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto, UpdateMaintenanceDto } from './dto/settings.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  getSettings() { return this.adminSettingsService.getSettings(); }

  @Put()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminSettingsService.updateSettings(dto);
  }

  @Patch('maintenance')
  updateMaintenance(@Body() dto: UpdateMaintenanceDto) {
    return this.adminSettingsService.updateMaintenance(dto);
  }
}
