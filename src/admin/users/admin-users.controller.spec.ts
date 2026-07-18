import { Test, TestingModule } from '@nestjs/testing';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from './admin-users.service';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let service: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    updateStatus: jest.Mock;
    updateRole: jest.Mock;
  };

  const req = { user: { userId: 'admin-1', role: 'ADMIN' } };

  beforeEach(async () => {
    service = {
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      updateStatus: jest.fn(),
      updateRole: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [{ provide: AdminUsersService, useValue: service }],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll forwards search/status/ecole query params', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll('lina', 'ACTIVE', 'IPEIT');

    expect(service.findAll).toHaveBeenCalledWith('lina', 'ACTIVE', 'IPEIT');
  });

  it('updateRole passes the requesting admin id for the self-demotion check', async () => {
    service.updateRole.mockResolvedValue({ id: 'user-1', role: 'ADMIN' });

    const result = await controller.updateRole(
      'user-1',
      { role: 'ADMIN' },
      req,
    );

    expect(service.updateRole).toHaveBeenCalledWith('user-1', 'admin-1', {
      role: 'ADMIN',
    });
    expect(result).toEqual({ id: 'user-1', role: 'ADMIN' });
  });

  it('updateStatus delegates to the service', async () => {
    service.updateStatus.mockResolvedValue({ id: 'user-1', status: 'BANNED' });

    await controller.updateStatus('user-1', { status: 'BANNED' });

    expect(service.updateStatus).toHaveBeenCalledWith('user-1', {
      status: 'BANNED',
    });
  });
});
