import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

describe('MaintenanceMiddleware', () => {
  let middleware: MaintenanceMiddleware;
  let settingsService: { isMaintenanceMode: jest.Mock };
  let jwtService: { verify: jest.Mock };
  let next: jest.Mock;

  beforeEach(async () => {
    settingsService = { isMaintenanceMode: jest.fn() };
    jwtService = { verify: jest.fn() };
    next = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceMiddleware,
        { provide: AdminSettingsService, useValue: settingsService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    middleware = module.get<MaintenanceMiddleware>(MaintenanceMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('always lets /auth routes through, even during maintenance', async () => {
    const req: any = { path: '/auth/login', headers: {} };

    await middleware.use(req, {} as any, next);

    expect(settingsService.isMaintenanceMode).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('lets an admin through on any route during maintenance (decoded from the JWT)', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', role: 'ADMIN' });
    const req: any = {
      path: '/users/me',
      headers: { authorization: 'Bearer valid.admin.token' },
    };

    await middleware.use(req, {} as any, next);

    expect(jwtService.verify).toHaveBeenCalledWith('valid.admin.token');
    expect(settingsService.isMaintenanceMode).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('does not bypass maintenance for a non-admin JWT', async () => {
    jwtService.verify.mockReturnValue({ sub: 'user-1', role: 'STUDENT' });
    settingsService.isMaintenanceMode.mockResolvedValue(true);
    const req: any = {
      path: '/users/me',
      headers: { authorization: 'Bearer valid.student.token' },
    };

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('falls back to the normal maintenance check on an invalid/expired token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('jwt expired');
    });
    settingsService.isMaintenanceMode.mockResolvedValue(true);
    const req: any = {
      path: '/exercises',
      headers: { authorization: 'Bearer garbage' },
    };

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      ServiceUnavailableException,
    );
  });

  it('lets other routes through when maintenance mode is off', async () => {
    settingsService.isMaintenanceMode.mockResolvedValue(false);
    const req: any = { path: '/exercises', headers: {} };

    await middleware.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks unauthenticated requests with 503 when maintenance mode is on', async () => {
    settingsService.isMaintenanceMode.mockResolvedValue(true);
    const req: any = { path: '/exercises', headers: {} };

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
