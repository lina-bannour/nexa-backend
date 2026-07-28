import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    const [
      totalStudents,
      activeStudents,
      totalExercises,
      totalContests,
      xpToday,
      exercisesThisWeek,
      studentsByFiliere,
      dailyActivity,
      recentRegistrations,
    ] = await Promise.all([
      // Total students
      this.prisma.user.count({ where: { role: 'STUDENT' } }),

      // Active students (solved at least one exercise)
      this.prisma.user.count({
        where: { role: 'STUDENT', attempts: { some: {} } },
      }),

      // Total exercises
      this.prisma.exercise.count(),

      // Total contests
      this.prisma.contest.count(),

      // XP distributed today
      this.prisma.exerciseAttempt.aggregate({
        where: { createdAt: { gte: startOfDay }, isCorrect: true },
        _sum: { xpEarned: true },
      }),

      // Exercises solved this week
      this.prisma.exerciseAttempt.count({
        where: { createdAt: { gte: startOfWeek } },
      }),

      // Students by filière
      this.prisma.user.groupBy({
        by: ['filiere'],
        where: { role: 'STUDENT', filiere: { not: null } },
        _count: { filiere: true },
      }),

      // Daily activity last 7 days
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM exercise_attempts
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Registrations last 7 days
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM users
        WHERE role = 'STUDENT' AND "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
    ]);

    return {
      kpis: {
        totalStudents,
        activeStudents,
        totalExercises,
        totalContests,
        xpToday: xpToday._sum.xpEarned ?? 0,
        exercisesThisWeek,
      },
      studentsByFiliere: studentsByFiliere.map(f => ({
        filiere: f.filiere,
        count: f._count.filiere,
      })),
      dailyActivity,
      recentRegistrations,
    };
  }

  /**
   * Deeper analytics beyond the top-level KPIs: exercise performance,
   * contest engagement, forum activity, and student retention.
   */
  async getAnalytics() {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [
      exercisesByMatiere,
      exercisesByDifficulte,
      hardestExercises,
      totalContestSessions,
      completedContestSessions,
      contestXpAvg,
      contestsByFiliere,
      totalPosts,
      totalReplies,
      totalLikes,
      postsThisWeek,
      reportedPosts,
      streakBuckets,
      usersByStatus,
      monthlyActiveResult,
    ] = await Promise.all([
      // Success rate per matière
      this.prisma.$queryRaw<
        { matiere: string; total: number; correct: number }[]
      >`
        SELECT e.matiere as matiere,
               COUNT(a.id)::int as total,
               COUNT(*) FILTER (WHERE a."isCorrect")::int as correct
        FROM exercises e
        LEFT JOIN exercise_attempts a ON a."exerciseId" = e.id
        GROUP BY e.matiere
      `,

      // Success rate per difficulté
      this.prisma.$queryRaw<
        { difficulte: string; total: number; correct: number }[]
      >`
        SELECT e.difficulte as difficulte,
               COUNT(a.id)::int as total,
               COUNT(*) FILTER (WHERE a."isCorrect")::int as correct
        FROM exercises e
        LEFT JOIN exercise_attempts a ON a."exerciseId" = e.id
        GROUP BY e.difficulte
      `,

      // Top 5 hardest exercises (lowest success rate, at least 3 attempts)
      this.prisma.$queryRaw<
        {
          id: string;
          titre: string;
          matiere: string;
          difficulte: string;
          attempts: number;
          successRate: number;
        }[]
      >`
        SELECT e.id as id, e.titre as titre, e.matiere as matiere, e.difficulte as difficulte,
               COUNT(a.id)::int as attempts,
               ROUND(COUNT(*) FILTER (WHERE a."isCorrect")::numeric / NULLIF(COUNT(a.id), 0) * 100)::int as "successRate"
        FROM exercises e
        JOIN exercise_attempts a ON a."exerciseId" = e.id
        GROUP BY e.id, e.titre, e.matiere, e.difficulte
        HAVING COUNT(a.id) >= 3
        ORDER BY "successRate" ASC, attempts DESC
        LIMIT 5
      `,

      // Contest engagement
      this.prisma.contestSession.count(),
      this.prisma.contestSession.count({ where: { isCompleted: true } }),
      this.prisma.contestSession.aggregate({ _avg: { xpTotal: true } }),
      this.prisma.$queryRaw<
        { filiere: string; sessions: number; avgXp: number }[]
      >`
        SELECT c.filiere as filiere,
               COUNT(s.id)::int as sessions,
               ROUND(AVG(s."xpTotal"))::int as "avgXp"
        FROM contest_sessions s
        JOIN contests c ON c.id = s."contestId"
        GROUP BY c.filiere
      `,

      // Forum activity
      this.prisma.forumPost.count(),
      this.prisma.forumReply.count(),
      this.prisma.forumLike.count(),
      this.prisma.forumPost.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.forumPost.count({ where: { status: 'REPORTED' } }),

      // Retention: streak distribution
      this.prisma.$queryRaw<{ bucket: string; count: number }[]>`
        SELECT
          CASE
            WHEN streak = 0 THEN '0'
            WHEN streak BETWEEN 1 AND 3 THEN '1-3'
            WHEN streak BETWEEN 4 AND 7 THEN '4-7'
            WHEN streak BETWEEN 8 AND 14 THEN '8-14'
            ELSE '15+'
          END as bucket,
          COUNT(*)::int as count
        FROM users
        WHERE role = 'STUDENT'
        GROUP BY bucket
      `,

      // Students by account status
      this.prisma.user.groupBy({
        by: ['status'],
        where: { role: 'STUDENT' },
        _count: { status: true },
      }),

      // Monthly active students (distinct users with an attempt in last 30 days)
      this.prisma.$queryRaw<{ count: number }[]>`
        SELECT COUNT(DISTINCT "userId")::int as count
        FROM exercise_attempts
        WHERE "createdAt" >= NOW() - INTERVAL '30 days'
      `,
    ]);

    const withRate = <T extends { total: number; correct: number }>(rows: T[]) =>
      rows.map(r => ({
        ...r,
        successRate: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0,
      }));

    const streakOrder = ['0', '1-3', '4-7', '8-14', '15+'];

    return {
      exercisePerformance: {
        byMatiere: withRate(exercisesByMatiere),
        byDifficulte: withRate(exercisesByDifficulte),
        hardestExercises,
      },
      contests: {
        totalSessions: totalContestSessions,
        completedSessions: completedContestSessions,
        completionRate:
          totalContestSessions > 0
            ? Math.round((completedContestSessions / totalContestSessions) * 100)
            : 0,
        avgXpPerSession: Math.round(contestXpAvg._avg.xpTotal ?? 0),
        byFiliere: contestsByFiliere,
      },
      forum: {
        totalPosts,
        totalReplies,
        totalLikes,
        postsThisWeek,
        reportedPosts,
      },
      retention: {
        streakBuckets: streakBuckets.sort(
          (a, b) => streakOrder.indexOf(a.bucket) - streakOrder.indexOf(b.bucket),
        ),
        usersByStatus: usersByStatus.map(s => ({
          status: s.status,
          count: s._count.status,
        })),
        monthlyActiveStudents: monthlyActiveResult[0]?.count ?? 0,
      },
    };
  }
}
