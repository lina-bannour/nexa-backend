import { Controller, Get, Put, Patch, Body, UseGuards } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateSettingsDto, UpdateMaintenanceDto } from './dto/settings.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly adminSettingsService: AdminSettingsService) {}

  @Get()
  getSettings() {
    return this.adminSettingsService.getSettings();
  }

  @Put()
  updateSettings(@Body() dto: UpdateSettingsDto) {
    return this.adminSettingsService.updateSettings(dto);
  }

  @Patch('maintenance')
  updateMaintenance(@Body() dto: UpdateMaintenanceDto) {
    return this.adminSettingsService.updateMaintenance(dto);
  }
}
