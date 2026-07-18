import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: {
    getProfile: jest.Mock;
    updateProfile: jest.Mock;
    getLeaderboard: jest.Mock;
    getMyRank: jest.Mock;
  };

  const req = { user: { userId: 'user-1' } };

  beforeEach(async () => {
    usersService = {
      getProfile: jest.fn(),
      updateProfile: jest.fn(),
      getLeaderboard: jest.fn(),
      getMyRank: jest.fn(),
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

  it('getLeaderboard forwards the optional filiere query param with the default global period', async () => {
    usersService.getLeaderboard.mockResolvedValue([]);

    await controller.getLeaderboard('MP');

    expect(usersService.getLeaderboard).toHaveBeenCalledWith('MP', 'global');
  });

  it('getLeaderboard forwards an explicit period', async () => {
    usersService.getLeaderboard.mockResolvedValue([]);

    await controller.getLeaderboard(undefined, 'semaine');

    expect(usersService.getLeaderboard).toHaveBeenCalledWith(undefined, 'semaine');
  });

  // 6.2.3 — Tests de l'affichage du rang personnel
  it('getMyRank delegates to the service with the authenticated user id, filiere, and period', async () => {
    usersService.getMyRank.mockResolvedValue({ rank: 3, xpTotal: 90, total: 20, period: 'mois', filiere: 'MP' });

    const result = await controller.getMyRank(req, 'MP', 'mois');

    expect(usersService.getMyRank).toHaveBeenCalledWith('user-1', 'MP', 'mois');
    expect(result.rank).toBe(3);
  });

  it('getMyRank defaults period to global when not provided', async () => {
    usersService.getMyRank.mockResolvedValue({ rank: 1, xpTotal: 100, total: 5, period: 'global', filiere: null });

    await controller.getMyRank(req);

    expect(usersService.getMyRank).toHaveBeenCalledWith('user-1', undefined, 'global');
  });
});
