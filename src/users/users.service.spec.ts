import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
  };

  const baseUser = {
    id: 'user-1',
    email: 'etudiant@nexa.tn',
    nom: 'Bannour',
    prenom: 'Lina',
    filiere: 'MP',
    ecole: 'IPEIT',
    xpTotal: 120,
    role: 'STUDENT',
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 3.2.3 — Tests d'affichage des données du profil
  describe('getProfile', () => {
    it('returns the profile with attempts count for the given user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...baseUser,
        _count: { attempts: 8 },
      });

      const result = await service.getProfile('user-1');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: expect.objectContaining({
          xpTotal: true,
          filiere: true,
          ecole: true,
          _count: { select: { attempts: true } },
        }),
      });
      expect(result).toEqual(
        expect.objectContaining({ xpTotal: 120, filiere: 'MP' }),
      );
    });
  });

  describe('getLeaderboard', () => {
    it('returns the top users ordered by XP', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await service.getLeaderboard();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { xpTotal: 'desc' }, take: 50 }),
      );
      expect(result).toEqual([baseUser]);
    });

    it('filters by filiere when provided', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      await service.getLeaderboard('MP');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { filiere: 'MP' } }),
      );
    });
  });

  // 3.1.3 — Tests de la mise à jour du profil
  describe('updateProfile', () => {
    it('updates only the école when only école is provided', async () => {
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        ecole: 'IPEI Monastir',
      });

      await service.updateProfile('user-1', { ecole: 'IPEI Monastir' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { ecole: 'IPEI Monastir' },
        select: expect.any(Object),
      });
    });

    it('updates only the filière when only filière is provided', async () => {
      prisma.user.update.mockResolvedValue({ ...baseUser, filiere: 'PC' });

      await service.updateProfile('user-1', { filiere: 'PC' });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { filiere: 'PC' },
        select: expect.any(Object),
      });
    });

    it('updates both fields together', async () => {
      prisma.user.update.mockResolvedValue({
        ...baseUser,
        ecole: 'IPEIS',
        filiere: 'BIO',
      });

      const result = await service.updateProfile('user-1', {
        ecole: 'IPEIS',
        filiere: 'BIO',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { ecole: 'IPEIS', filiere: 'BIO' },
        select: expect.any(Object),
      });
      expect(result.ecole).toBe('IPEIS');
      expect(result.filiere).toBe('BIO');
    });

    it('sends an empty data payload when nothing is provided', async () => {
      prisma.user.update.mockResolvedValue(baseUser);

      await service.updateProfile('user-1', {});

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {},
        select: expect.any(Object),
      });
    });
  });
});
