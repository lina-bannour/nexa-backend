import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface MatiereBreakdown {
  matiere: string;
  total: number;
  successRate: number;
}

export interface DifficulteBreakdown {
  difficulte: string;
  total: number;
  successRate: number;
}

export interface HardestExercise {
  id: string;
  titre: string;
  matiere: string;
  difficulte: string;
  attempts: number;
  successRate: number;
}

export interface FiliereSessions {
  filiere: string;
  sessions: number;
  avgXp: number;
}

export interface StreakBucket {
  bucket: string;
  count: number;
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getStats() {
    // ... inchangé
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
      this.prisma.user.count({ where: { role: 'STUDENT' } }),
      this.prisma.user.count({
        where: { role: 'STUDENT', attempts: { some: {} } },
      }),
      this.prisma.exercise.count(),
      this.prisma.contest.count(),
      this.prisma.exerciseAttempt.aggregate({
        where: { createdAt: { gte: startOfDay }, isCorrect: true },
        _sum: { xpEarned: true },
      }),
      this.prisma.exerciseAttempt.count({
        where: { createdAt: { gte: startOfWeek } },
      }),
      this.prisma.user.groupBy({
        by: ['filiere'],
        where: { role: 'STUDENT', filiere: { not: null } },
        _count: { filiere: true },
      }),
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt") as date, COUNT(*)::int as count
        FROM exercise_attempts
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,
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

  // 8.1.7 — Analytics détaillées : performance par exercice, concours, forum, rétention
  async getAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      byMatiere,
      byDifficulte,
      hardestExercises,
      totalSessions,
      completedSessions,
      avgXpAgg,
      contestsByFiliere,
      totalPosts,
      totalReplies,
      totalLikes,
      reportedPosts,
      monthlyActiveStudents,
      streakBuckets,
      usersByStatus,
    ] = await Promise.all([
      // Taux de réussite par matière
      this.prisma.$queryRaw<MatiereBreakdown[]>`
        SELECT e.matiere as matiere,
               COUNT(a.id)::int as total,
               ROUND(100.0 * SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END) / COUNT(a.id))::int as "successRate"
        FROM exercise_attempts a
        JOIN exercises e ON e.id = a."exerciseId"
        GROUP BY e.matiere
        ORDER BY e.matiere ASC
      `,

      // Taux de réussite par difficulté
      this.prisma.$queryRaw<DifficulteBreakdown[]>`
        SELECT e.difficulte as difficulte,
               COUNT(a.id)::int as total,
               ROUND(100.0 * SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END) / COUNT(a.id))::int as "successRate"
        FROM exercise_attempts a
        JOIN exercises e ON e.id = a."exerciseId"
        GROUP BY e.difficulte
        ORDER BY e.difficulte ASC
      `,

      // Exercices les plus difficiles (min. 3 tentatives, pire taux de réussite d'abord)
      this.prisma.$queryRaw<HardestExercise[]>`
        SELECT e.id as id,
               e.titre as titre,
               e.matiere as matiere,
               e.difficulte as difficulte,
               COUNT(a.id)::int as attempts,
               ROUND(100.0 * SUM(CASE WHEN a."isCorrect" THEN 1 ELSE 0 END) / COUNT(a.id))::int as "successRate"
        FROM exercises e
        JOIN exercise_attempts a ON a."exerciseId" = e.id
        GROUP BY e.id, e.titre, e.matiere, e.difficulte
        HAVING COUNT(a.id) >= 3
        ORDER BY "successRate" ASC, attempts DESC
        LIMIT 5
      `,

      // Sessions de concours démarrées
      this.prisma.contestSession.count(),

      // Sessions terminées
      this.prisma.contestSession.count({ where: { isCompleted: true } }),

      // XP moyen par session
      this.prisma.contestSession.aggregate({ _avg: { xpTotal: true } }),

      // Sessions par filière
      this.prisma.$queryRaw<FiliereSessions[]>`
        SELECT c.filiere as filiere,
               COUNT(s.id)::int as sessions,
               ROUND(AVG(s."xpTotal"))::int as "avgXp"
        FROM contest_sessions s
        JOIN contests c ON c.id = s."contestId"
        GROUP BY c.filiere
        ORDER BY c.filiere ASC
      `,

      // Discussions du forum
      this.prisma.forumPost.count(),

      // Réponses du forum
      this.prisma.forumReply.count(),

      // J'aime du forum
      this.prisma.forumLike.count(),

      // Discussions signalées
      this.prisma.forumPost.count({ where: { status: 'REPORTED' } }),

      // Étudiants actifs sur les 30 derniers jours
      this.prisma.user.count({
        where: {
          role: 'STUDENT',
          attempts: { some: { createdAt: { gte: thirtyDaysAgo } } },
        },
      }),

      // Répartition des séries (streak)
      this.prisma.$queryRaw<StreakBucket[]>`
        SELECT
          CASE
            WHEN streak = 0 THEN '0'
            WHEN streak BETWEEN 1 AND 3 THEN '1-3'
            WHEN streak BETWEEN 4 AND 7 THEN '4-7'
            WHEN streak BETWEEN 8 AND 14 THEN '8-14'
            WHEN streak BETWEEN 15 AND 29 THEN '15-29'
            ELSE '30+'
          END as bucket,
          COUNT(*)::int as count
        FROM users
        WHERE role = 'STUDENT'
        GROUP BY bucket
        ORDER BY MIN(streak) ASC
      `,

      // Statut des comptes
      this.prisma.user.groupBy({
        by: ['status'],
        where: { role: 'STUDENT' },
        _count: { status: true },
      }),
    ]);

    return {
      exercisePerformance: {
        byMatiere,
        byDifficulte,
        hardestExercises,
      },
      contests: {
        totalSessions,
        completedSessions,
        completionRate:
          totalSessions === 0
            ? 0
            : Math.round((completedSessions / totalSessions) * 100),
        avgXpPerSession: Math.round(avgXpAgg._avg.xpTotal ?? 0),
        byFiliere: contestsByFiliere,
      },
      forum: {
        totalPosts,
        totalReplies,
        totalLikes,
        reportedPosts,
      },
      retention: {
        monthlyActiveStudents,
        streakBuckets,
        usersByStatus: usersByStatus.map(s => ({
          status: s.status,
          count: s._count.status,
        })),
      },
    };
  }
}