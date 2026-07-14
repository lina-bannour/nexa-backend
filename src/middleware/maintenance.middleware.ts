import { Injectable, NestMiddleware, ServiceUnavailableException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(private settingsService: AdminSettingsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Allow admin routes and auth routes during maintenance
    if (req.path.startsWith('/admin') || req.path.startsWith('/auth')) {
      return next();
    }
    const isMaintenance = await this.settingsService.isMaintenanceMode();
    if (isMaintenance) {
      throw new ServiceUnavailableException(
        'La plateforme est en cours de maintenance. Veuillez réessayer plus tard.'
      );
    }
    next();
  }
}
