import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    getLeaderboard: jest.Mock;
  };

  const req = { user: { userId: 'user-1' } };

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getLeaderboard: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: usersService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('getProfile delegates to the service with the authenticated user id', async () => {
    usersService.getProfile.mockResolvedValue({ id: 'user-1' });

    const result = await controller.getProfile(req);

    expect(usersService.getProfile).toHaveBeenCalledWith('user-1');
    expect(result).toEqual({ id: 'user-1' });
  });

  it('updateProfile delegates to the service with the authenticated user id and dto', async () => {
    usersService.updateProfile.mockResolvedValue({
      id: 'user-1',
      ecole: 'IPEIT',
    });

    const result = await controller.updateProfile(req, { ecole: 'IPEIT' });

    expect(usersService.updateProfile).toHaveBeenCalledWith('user-1', {
      ecole: 'IPEIT',
    });
    expect(result).toEqual({ id: 'user-1', ecole: 'IPEIT' });
  });

  it('getLeaderboard forwards the optional filiere query param', async () => {
    usersService.getLeaderboard.mockResolvedValue([]);

    await controller.getLeaderboard('MP');

    expect(usersService.getLeaderboard).toHaveBeenCalledWith('MP');
  });
});
