import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

type RankedUser = {
  id: string;
  nom: string;
  prenom: string;
  filiere: string | null;
  ecole: string | null;
  xpTotal: number;
};

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async getProfile(userId: string) {
    const [user, contestsCompleted, exercisesSolved] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          filiere: true,
          ecole: true,
          xpTotal: true,
          streak: true,
          role: true,
          createdAt: true,
          _count: { select: { attempts: true, posts: true } },
        },
      }),
      // Used by the "Progression" checklist on the profile screen — has the
      // student ever finished a contest, not just started one.
      this.prisma.contestSession.count({
        where: { userId, isCompleted: true },
      }),
      // Used for the "QCM Expert" badge (real success rate, not attempt count).
      this.prisma.exerciseAttempt.count({
        where: { userId, isCorrect: true },
      }),
    ]);
    if (!user) return null;
    return { ...user, contestsCompleted, exercisesSolved };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.ecole !== undefined && { ecole: dto.ecole }),
        ...(dto.filiere !== undefined && { filiere: dto.filiere as any }),
      },
      select: {
        id: true,
        email: true,
        nom: true,
        prenom: true,
        filiere: true,
        ecole: true,
        xpTotal: true,
        role: true,
        createdAt: true,
      },
    });
  }

  private getPeriodStart(period: string): Date | null {
    if (period !== 'semaine' && period !== 'mois') return null;
    const now = new Date();
    if (period === 'semaine') {
      const day = now.getDay();
      const diffToMonday = day === 0 ? 6 : day - 1;
      return new Date(now.getFullYear(), now.getMonth(), now.getDate() - diffToMonday);
    }
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  // Shared ranking used by both the leaderboard and the personal-rank lookup,
  // so the two always agree on ordering and filters.
  //
  // Note: "semaine"/"mois" only sum XP from exercise attempts and contest
  // answers, since those are the only XP sources with a timestamp to filter
  // by — forum XP is added straight to xpTotal with no dated ledger. Global
  // ranking uses xpTotal directly and so includes everything.
  private async getRanking(filiere?: string, period: string = 'global'): Promise<RankedUser[]> {
    const since = this.getPeriodStart(period);

    if (!since) {
      return this.prisma.user.findMany({
        where: { role: 'STUDENT', ...(filiere && { filiere: filiere as any }) },
        select: { id: true, nom: true, prenom: true, filiere: true, ecole: true, xpTotal: true },
        orderBy: { xpTotal: 'desc' },
      });
    }

    const filiereClause = filiere
      ? Prisma.sql`AND u.filiere = ${filiere}::"Filiere"`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        nom: string;
        prenom: string;
        filiere: string | null;
        ecole: string | null;
        periodXp: bigint | number | null;
      }>
    >(Prisma.sql`
      SELECT u.id, u.nom, u.prenom, u.filiere, u.ecole,
        COALESCE(ex.xp, 0) + COALESCE(co.xp, 0) AS "periodXp"
      FROM users u
      LEFT JOIN (
        SELECT "userId", SUM("xpEarned") AS xp FROM exercise_attempts
        WHERE "createdAt" >= ${since} GROUP BY "userId"
      ) ex ON ex."userId" = u.id
      LEFT JOIN (
        SELECT cs."userId" AS "userId", SUM(csa."xpEarned") AS xp
        FROM contest_session_answers csa
        JOIN contest_sessions cs ON cs.id = csa."sessionId"
        WHERE csa."answeredAt" >= ${since}
        GROUP BY cs."userId"
      ) co ON co."userId" = u.id
      WHERE u.role = 'STUDENT' ${filiereClause}
      ORDER BY "periodXp" DESC
    `);

    return rows.map((r) => ({
      id: r.id,
      nom: r.nom,
      prenom: r.prenom,
      filiere: r.filiere,
      ecole: r.ecole,
      xpTotal: Number(r.periodXp ?? 0),
    }));
  }

  // 6.1 — Leaderboard: global / by filière / by week / by month
  async getLeaderboard(filiere?: string, period: string = 'global') {
    const ranking = await this.getRanking(filiere, period);
    return ranking.slice(0, 50);
  }

  // 6.2 — Personal rank within the current leaderboard view
  async getMyRank(userId: string, filiere?: string, period: string = 'global') {
    const ranking = await this.getRanking(filiere, period);
    const index = ranking.findIndex((u) => u.id === userId);
    if (index === -1) {
      return { rank: null, xpTotal: 0, total: ranking.length, period, filiere: filiere ?? null };
    }
    return {
      rank: index + 1,
      xpTotal: ranking[index].xpTotal,
      total: ranking.length,
      period,
      filiere: filiere ?? null,
    };
  }

  // ─── "Missions du jour" (daily missions) ──────────────────────────────
  // Distinct from the lifetime "Progression" checklist above: these reset
  // every calendar day and grant a one-time bonus XP the first time each
  // is completed that day. Awarding happens here, lazily, whenever this
  // is called (e.g. on profile load) rather than being hooked into every
  // action — the unique (userId, missionKey, day) constraint on
  // DailyMissionClaim makes this idempotent even if called concurrently.
  //
  // "Utiliser l'IA NEXA" is intentionally left out of MISSIONS below: that
  // feature doesn't exist on the backend yet (see the profile Progression
  // checklist, where it's shown as "Bientôt" for the same reason), so it
  // can never actually be completed or awarded.
  private static readonly DAILY_MISSIONS = [
    { key: 'EXERCISES', label: '3 exercices complétés', xp: 30, threshold: 3 },
    { key: 'FORUM', label: 'Publier sur le forum', xp: 15, threshold: 1 },
    { key: 'CONTEST', label: 'Compléter un concours', xp: 50, threshold: 1 },
  ];

  async getDailyMissions(userId: string) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const [exercisesToday, forumPostsToday, contestsToday, claims] =
      await Promise.all([
        this.prisma.exerciseAttempt.count({
          where: {
            userId,
            isCorrect: true,
            createdAt: { gte: today, lt: tomorrow },
          },
        }),
        this.prisma.forumPost.count({
          where: { authorId: userId, createdAt: { gte: today, lt: tomorrow } },
        }),
        this.prisma.contestSession.count({
          where: {
            userId,
            isCompleted: true,
            completedAt: { gte: today, lt: tomorrow },
          },
        }),
        this.prisma.dailyMissionClaim.findMany({
          where: { userId, day: today },
        }),
      ]);

    const progressByKey: Record<string, number> = {
      EXERCISES: exercisesToday,
      FORUM: forumPostsToday,
      CONTEST: contestsToday,
    };
    const claimedKeys = new Set(claims.map((c) => c.missionKey));

    for (const mission of UsersService.DAILY_MISSIONS) {
      const alreadyClaimed = claimedKeys.has(mission.key);
      const nowQualifies = progressByKey[mission.key] >= mission.threshold;
      if (alreadyClaimed || !nowQualifies) continue;

      try {
        await this.prisma.dailyMissionClaim.create({
          data: {
            userId,
            missionKey: mission.key,
            day: today,
            xpAwarded: mission.xp,
          },
        });
        await this.prisma.user.update({
          where: { id: userId },
          data: { xpTotal: { increment: mission.xp } },
        });
        claimedKeys.add(mission.key);
      } catch {
        // Unique constraint hit — a concurrent request already claimed
        // this mission for today. Nothing to do.
      }
    }

    return {
      missions: UsersService.DAILY_MISSIONS.map((mission) => ({
        key: mission.key,
        label: mission.label,
        xp: mission.xp,
        threshold: mission.threshold,
        progress: progressByKey[mission.key] ?? 0,
        completed: claimedKeys.has(mission.key),
      })),
    };
  }
}
