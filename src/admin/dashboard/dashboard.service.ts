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
        SELECT DATE("createdAt") as date, COUNT(*) as count
        FROM exercise_attempts
        WHERE "createdAt" >= NOW() - INTERVAL '7 days'
        GROUP BY DATE("createdAt")
        ORDER BY date ASC
      `,

      // Registrations last 7 days
      this.prisma.$queryRaw<{ date: string; count: number }[]>`
        SELECT DATE("createdAt") as date, COUNT(*) as count
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
}
