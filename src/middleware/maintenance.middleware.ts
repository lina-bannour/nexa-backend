import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

@Injectable()
export class MaintenanceMiddleware implements NestMiddleware {
  constructor(
    private settingsService: AdminSettingsService,
    private jwtService: JwtService,
  ) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Login/password-reset/etc. must always work, even during maintenance —
    // otherwise nobody (including an admin) could ever authenticate to turn
    // maintenance mode back off.
    if (req.path.startsWith('/auth')) {
      return next();
    }

    // Admins bypass maintenance on every route, not just /admin/*. This
    // runs before route guards populate req.user, so we decode the JWT
    // directly here instead of relying on it.
    const authHeader = req.headers['authorization'];
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify(authHeader.slice(7));
        if (payload?.role === 'ADMIN') {
          return next();
        }
      } catch {
        // invalid/expired token — fall through to the normal maintenance check
      }
    }

    const isMaintenance = await this.settingsService.isMaintenanceMode();
    if (isMaintenance) {
      throw new ServiceUnavailableException(
        'La plateforme est en cours de maintenance. Veuillez réessayer plus tard.',
      );
    }
    next();
  }
}
