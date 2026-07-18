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
    return this.prisma.user.findUnique({
      where: { id: userId },
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
        _count: { select: { attempts: true } },
      },
    });
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
}
