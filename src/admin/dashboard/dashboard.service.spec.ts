import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('DashboardService', () => {
  let service: DashboardService;
  let prisma: {
    user: { count: jest.Mock; groupBy: jest.Mock };
    exercise: { count: jest.Mock };
    contest: { count: jest.Mock };
    exerciseAttempt: { aggregate: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn(), groupBy: jest.fn() },
      exercise: { count: jest.fn() },
      contest: { count: jest.fn() },
      exerciseAttempt: { aggregate: jest.fn(), count: jest.fn() },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 8.1.6 — Tests du dashboard et des graphiques
  describe('getStats', () => {
    it('assembles KPIs, filière breakdown, and activity charts', async () => {
      prisma.user.count.mockResolvedValueOnce(120).mockResolvedValueOnce(80); // total, active
      prisma.exercise.count.mockResolvedValue(45);
      prisma.contest.count.mockResolvedValue(6);
      prisma.exerciseAttempt.aggregate.mockResolvedValue({
        _sum: { xpEarned: 340 },
      });
      prisma.exerciseAttempt.count.mockResolvedValue(212);
      prisma.user.groupBy.mockResolvedValue([
        { filiere: 'MP', _count: { filiere: 50 } },
        { filiere: 'PC', _count: { filiere: 30 } },
      ]);
      prisma.$queryRaw
        .mockResolvedValueOnce([{ date: '2026-07-10', count: 12 }]) // dailyActivity
        .mockResolvedValueOnce([{ date: '2026-07-10', count: 3 }]); // recentRegistrations

      const result = await service.getStats();

      expect(result.kpis).toEqual({
        totalStudents: 120,
        activeStudents: 80,
        totalExercises: 45,
        totalContests: 6,
        xpToday: 340,
        exercisesThisWeek: 212,
      });
      expect(result.studentsByFiliere).toEqual([
        { filiere: 'MP', count: 50 },
        { filiere: 'PC', count: 30 },
      ]);
      expect(result.dailyActivity).toEqual([{ date: '2026-07-10', count: 12 }]);
      expect(result.recentRegistrations).toEqual([
        { date: '2026-07-10', count: 3 },
      ]);
    });

    it('defaults xpToday to 0 when there is no XP-earning activity yet', async () => {
      prisma.user.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.exercise.count.mockResolvedValue(0);
      prisma.contest.count.mockResolvedValue(0);
      prisma.exerciseAttempt.aggregate.mockResolvedValue({
        _sum: { xpEarned: null },
      });
      prisma.exerciseAttempt.count.mockResolvedValue(0);
      prisma.user.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      const result = await service.getStats();

      expect(result.kpis.xpToday).toBe(0);
    });

    it('counts a student as active only if they have at least one exercise attempt', async () => {
      prisma.user.count.mockResolvedValueOnce(120).mockResolvedValueOnce(80);
      prisma.exercise.count.mockResolvedValue(45);
      prisma.contest.count.mockResolvedValue(6);
      prisma.exerciseAttempt.aggregate.mockResolvedValue({
        _sum: { xpEarned: 0 },
      });
      prisma.exerciseAttempt.count.mockResolvedValue(0);
      prisma.user.groupBy.mockResolvedValue([]);
      prisma.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.getStats();

      expect(prisma.user.count).toHaveBeenNthCalledWith(2, {
        where: { role: 'STUDENT', attempts: { some: {} } },
      });
    });
  });
});
