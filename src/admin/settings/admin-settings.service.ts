import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateSettingsDto, UpdateMaintenanceDto } from './dto/settings.dto';

@Injectable()
export class AdminSettingsService {
  constructor(private prisma: PrismaService) {}

  async getSettings() {
    // Get or create the single settings row.
    return this.prisma.platformSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  }

  async updateSettings(dto: UpdateSettingsDto) {
    return this.prisma.platformSettings.upsert({
      where: { id: 1 },
      update: { ...dto },
      create: { id: 1, ...dto },
    });
  }

  async updateMaintenance(dto: UpdateMaintenanceDto) {
    return this.prisma.platformSettings.upsert({
      where: { id: 1 },
      update: { maintenanceMode: dto.maintenanceMode },
      create: { id: 1, maintenanceMode: dto.maintenanceMode },
    });
  }

  // Used by MaintenanceMiddleware — must never throw (fails open if the
  // settings row/table isn't reachable yet, e.g. right after a fresh migration).
  async isMaintenanceMode(): Promise<boolean> {
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: 1 },
      });
      return settings?.maintenanceMode ?? false;
    } catch {
      return false;
    }
  }
}
