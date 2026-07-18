import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { MaintenanceMiddleware } from './maintenance.middleware';
import { AdminSettingsService } from '../admin/settings/admin-settings.service';

describe('MaintenanceMiddleware', () => {
  let middleware: MaintenanceMiddleware;
  let settingsService: { isMaintenanceMode: jest.Mock };
  let next: jest.Mock;

  beforeEach(async () => {
    settingsService = { isMaintenanceMode: jest.fn() };
    next = jest.fn();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceMiddleware,
        { provide: AdminSettingsService, useValue: settingsService },
      ],
    }).compile();

    middleware = module.get<MaintenanceMiddleware>(MaintenanceMiddleware);
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('always lets /admin routes through, even during maintenance', async () => {
    const req: any = { path: '/admin/settings' };

    await middleware.use(req, {} as any, next);

    expect(settingsService.isMaintenanceMode).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('always lets /auth routes through, even during maintenance', async () => {
    const req: any = { path: '/auth/login' };

    await middleware.use(req, {} as any, next);

    expect(settingsService.isMaintenanceMode).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('lets other routes through when maintenance mode is off', async () => {
    settingsService.isMaintenanceMode.mockResolvedValue(false);
    const req: any = { path: '/exercises' };

    await middleware.use(req, {} as any, next);

    expect(next).toHaveBeenCalled();
  });

  it('blocks other routes with 503 when maintenance mode is on', async () => {
    settingsService.isMaintenanceMode.mockResolvedValue(true);
    const req: any = { path: '/exercises' };

    await expect(middleware.use(req, {} as any, next)).rejects.toThrow(
      ServiceUnavailableException,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
