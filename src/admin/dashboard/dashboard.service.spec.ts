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
    contestSession: { count: jest.Mock; aggregate: jest.Mock };
    forumPost: { count: jest.Mock };
    forumReply: { count: jest.Mock };
    forumLike: { count: jest.Mock };
    $queryRaw: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      user: { count: jest.fn(), groupBy: jest.fn() },
      exercise: { count: jest.fn() },
      contest: { count: jest.fn() },
      exerciseAttempt: { aggregate: jest.fn(), count: jest.fn() },
      contestSession: { count: jest.fn(), aggregate: jest.fn() },
      forumPost: { count: jest.fn() },
      forumReply: { count: jest.fn() },
      forumLike: { count: jest.fn() },
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

  // 8.1.7 — Tests de l'onglet Analytics (performance exercices, concours,
  // forum, rétention)
  describe('getAnalytics', () => {
    it('assembles exercise performance, contests, forum, and retention data', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { matiere: 'MATHEMATIQUES', total: 100, successRate: 63 },
        ]) // byMatiere
        .mockResolvedValueOnce([
          { difficulte: 'DEUX_ETOILES', total: 40, successRate: 55 },
        ]) // byDifficulte
        .mockResolvedValueOnce([
          {
            id: 'ex-1',
            titre: 'Intégrales délicates',
            matiere: 'MATHEMATIQUES',
            difficulte: 'TROIS_ETOILES',
            attempts: 9,
            successRate: 22,
          },
        ]) // hardestExercises
        .mockResolvedValueOnce([
          { filiere: 'MP', sessions: 30, avgXp: 45 },
        ]) // contestsByFiliere
        .mockResolvedValueOnce([{ bucket: '1-3', count: 20 }]); // streakBuckets

      prisma.contestSession.count
        .mockResolvedValueOnce(80) // totalSessions
        .mockResolvedValueOnce(60); // completedSessions
      prisma.contestSession.aggregate.mockResolvedValue({
        _avg: { xpTotal: 37.4 },
      });

      prisma.forumPost.count
        .mockResolvedValueOnce(15) // totalPosts
        .mockResolvedValueOnce(2); // reportedPosts
      prisma.forumReply.count.mockResolvedValue(48);
      prisma.forumLike.count.mockResolvedValue(120);

      prisma.user.count.mockResolvedValue(57); // monthlyActiveStudents
      prisma.user.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: { status: 90 } },
        { status: 'SUSPENDED', _count: { status: 3 } },
      ]);

      const result = await service.getAnalytics();

      expect(result.exercisePerformance.byMatiere).toEqual([
        { matiere: 'MATHEMATIQUES', total: 100, successRate: 63 },
      ]);
      expect(result.exercisePerformance.hardestExercises[0].titre).toBe(
        'Intégrales délicates',
      );
      expect(result.contests).toEqual({
        totalSessions: 80,
        completedSessions: 60,
        completionRate: 75,
        avgXpPerSession: 37,
        byFiliere: [{ filiere: 'MP', sessions: 30, avgXp: 45 }],
      });
      expect(result.forum).toEqual({
        totalPosts: 15,
        totalReplies: 48,
        totalLikes: 120,
        reportedPosts: 2,
      });
      expect(result.retention.monthlyActiveStudents).toBe(57);
      expect(result.retention.streakBuckets).toEqual([
        { bucket: '1-3', count: 20 },
      ]);
      expect(result.retention.usersByStatus).toEqual([
        { status: 'ACTIVE', count: 90 },
        { status: 'SUSPENDED', count: 3 },
      ]);
    });

    it('defaults completionRate and avgXpPerSession to 0 with no contest sessions yet', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      prisma.contestSession.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);
      prisma.contestSession.aggregate.mockResolvedValue({
        _avg: { xpTotal: null },
      });
      prisma.forumPost.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      prisma.forumReply.count.mockResolvedValue(0);
      prisma.forumLike.count.mockResolvedValue(0);
      prisma.user.count.mockResolvedValue(0);
      prisma.user.groupBy.mockResolvedValue([]);

      const result = await service.getAnalytics();

      expect(result.contests.completionRate).toBe(0);
      expect(result.contests.avgXpPerSession).toBe(0);
    });
  });
});