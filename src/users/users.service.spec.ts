import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; findMany: jest.Mock };
    $queryRaw: jest.Mock;
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
      $queryRaw: jest.fn(),
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

  // 6.1 — Tests du classement et des filtres
  describe('getLeaderboard', () => {
    it('returns the top students ordered by XP for the global period', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      const result = await service.getLeaderboard();

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'STUDENT' },
          orderBy: { xpTotal: 'desc' },
        }),
      );
      expect(result).toEqual([baseUser]);
    });

    it('filters by filiere when provided (global period)', async () => {
      prisma.user.findMany.mockResolvedValue([baseUser]);

      await service.getLeaderboard('MP');

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { role: 'STUDENT', filiere: 'MP' } }),
      );
    });

    it('caps the global leaderboard at 50 entries', async () => {
      const many = Array.from({ length: 80 }, (_, i) => ({ ...baseUser, id: `u${i}` }));
      prisma.user.findMany.mockResolvedValue(many);

      const result = await service.getLeaderboard();

      expect(result).toHaveLength(50);
    });

    // Previously the only supported filter was filiere — week/month didn't
    // exist at all, so this branch (raw SQL summing XP earned since the
    // period start) is new.
    it('uses the raw period query when period is "semaine"', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'user-1', nom: 'Bannour', prenom: 'Lina', filiere: 'MP', ecole: 'IPEIT', periodXp: 42n },
      ]);

      const result = await service.getLeaderboard(undefined, 'semaine');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(prisma.user.findMany).not.toHaveBeenCalled();
      expect(result[0]).toEqual(
        expect.objectContaining({ id: 'user-1', xpTotal: 42 }),
      );
    });

    it('uses the raw period query when period is "mois"', async () => {
      prisma.$queryRaw.mockResolvedValue([]);

      await service.getLeaderboard('PC', 'mois');

      expect(prisma.$queryRaw).toHaveBeenCalled();
    });
  });

  // 6.2 — Tests de l'affichage du rang personnel
  describe('getMyRank', () => {
    it('returns the rank, xp, and total for a student in the global ranking', async () => {
      prisma.user.findMany.mockResolvedValue([
        { ...baseUser, id: 'user-0', xpTotal: 500 },
        { ...baseUser, id: 'user-1', xpTotal: 120 },
        { ...baseUser, id: 'user-2', xpTotal: 10 },
      ]);

      const result = await service.getMyRank('user-1');

      expect(result).toEqual({
        rank: 2,
        xpTotal: 120,
        total: 3,
        period: 'global',
        filiere: null,
      });
    });

    it('returns rank null when the user is not in the ranking (e.g. filtered out by filiere)', async () => {
      prisma.user.findMany.mockResolvedValue([{ ...baseUser, id: 'someone-else' }]);

      const result = await service.getMyRank('user-1', 'PC');

      expect(result.rank).toBeNull();
      expect(result.total).toBe(1);
      expect(result.filiere).toBe('PC');
    });

    it('uses the period ranking when a period is given', async () => {
      prisma.$queryRaw.mockResolvedValue([
        { id: 'user-1', nom: 'Bannour', prenom: 'Lina', filiere: 'MP', ecole: 'IPEIT', periodXp: 15n },
      ]);

      const result = await service.getMyRank('user-1', undefined, 'semaine');

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual({
        rank: 1,
        xpTotal: 15,
        total: 1,
        period: 'semaine',
        filiere: null,
      });
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
