import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
  SendMessageDto,
} from './dto/admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  // 9.1 — List all students with filters + pagination
  async findAll(
    search?: string,
    status?: string,
    ecole?: string,
    page = 1,
    pageSize = 20,
    filiere?: string,
  ) {
    const safePage = page > 0 ? page : 1;
    const safePageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

    const where = {
      role: 'STUDENT' as const,
      ...(status && { status: status as any }),
      ...(ecole && { ecole }),
      ...(filiere && { filiere: filiere as any }),
      ...(search && {
        OR: [
          { nom: { contains: search, mode: 'insensitive' as const } },
          { prenom: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };

    const [total, data] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          nom: true,
          prenom: true,
          role: true,
          status: true,
          ecole: true,
          filiere: true,
          xpTotal: true,
          streak: true,
          createdAt: true,
          _count: { select: { attempts: true } },
        },
        orderBy: { xpTotal: 'desc' },
        skip: (safePage - 1) * safePageSize,
        take: safePageSize,
      }),
    ]);

    return {
      data,
      pagination: {
        page: safePage,
        pageSize: safePageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / safePageSize)),
      },
    };
  }

  // 9.2 — Get one student detail
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: {
          select: { attempts: true, contestSessions: true, posts: true },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found');

    const [exercisesSolved, lastActivityAt, xpProgression] =
      await Promise.all([
        this.prisma.exerciseAttempt.count({
          where: { userId: id, isCorrect: true },
        }),
        this.getLastActivityAt(id),
        this.getXpProgression(id),
      ]);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      exercisesAttempted: user._count.attempts,
      exercisesSolved,
      lastActivityAt,
      xpProgression,
    };
  }

  // Most recent timestamp across the (dated) activity sources we track:
  // exercise attempts, contest QCM answers, forum posts. No dedicated
  // "last seen" column on User — computed on demand since this is only
  // read one user at a time, from the admin detail panel.
  private async getLastActivityAt(userId: string): Promise<Date | null> {
    const [lastAttempt, lastContestAnswer, lastPost] = await Promise.all([
      this.prisma.exerciseAttempt.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.contestSessionAnswer.findFirst({
        where: { session: { userId } },
        orderBy: { answeredAt: 'desc' },
        select: { answeredAt: true },
      }),
      this.prisma.forumPost.findFirst({
        where: { authorId: userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const dates = [
      lastAttempt?.createdAt,
      lastContestAnswer?.answeredAt,
      lastPost?.createdAt,
    ].filter((d): d is Date => d != null);

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map((d) => d.getTime())));
  }

  // Cumulative XP by month for the last 12 months, for the "Progression
  // XP" chart. Only sources with a timestamp are included (exercise
  // attempts + contest QCM answers) — forum/daily-mission bonus XP is
  // added straight to xpTotal with no dated ledger (same limitation noted
  // on the leaderboard's weekly/monthly view), so this slightly undercounts
  // versus the student's live xpTotal shown elsewhere on the panel.
  private async getXpProgression(
    userId: string,
  ): Promise<Array<{ month: string; xp: number }>> {
    const rows = await this.prisma.$queryRaw<
      Array<{ month: string; xp: bigint | number }>
    >(Prisma.sql`
      WITH months AS (
        SELECT date_trunc('month', now()) - (n || ' months')::interval AS month_start
        FROM generate_series(11, 0, -1) AS n
      ),
      dated_xp AS (
        SELECT "createdAt" AS ts, "xpEarned" AS xp
        FROM exercise_attempts WHERE "userId" = ${userId}
        UNION ALL
        SELECT csa."answeredAt" AS ts, csa."xpEarned" AS xp
        FROM contest_session_answers csa
        JOIN contest_sessions cs ON cs.id = csa."sessionId"
        WHERE cs."userId" = ${userId}
      )
      SELECT
        to_char(m.month_start, 'YYYY-MM') AS month,
        COALESCE(
          (SELECT SUM(xp) FROM dated_xp WHERE ts < m.month_start + interval '1 month'),
          0
        ) AS xp
      FROM months m
      ORDER BY m.month_start ASC
    `);

    return rows.map((r) => ({ month: r.month, xp: Number(r.xp) }));
  }

  // 9.3.1 — Update user info
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, filiere: dto.filiere as any },
      select: {
        id: true,
        nom: true,
        prenom: true,
        email: true,
        status: true,
        filiere: true,
        ecole: true,
      },
    });
  }

  // 9.3.2 — Suspend or ban
  // Admin accounts can't be suspended/banned through this route — this
  // endpoint only ever operates on STUDENT accounts (see findAll above),
  // but we double-check here too since /admin/users/:id/status accepts any
  // id in its path.
  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    if (user.role === 'ADMIN') {
      throw new BadRequestException('Cannot change status of an admin account');
    }
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status as any },
      select: { id: true, nom: true, prenom: true, email: true, status: true },
    });
  }

  // 9.3.3 — Promote a student to admin, or demote an admin back to student.
  async updateRole(
    id: string,
    requestingAdminId: string,
    dto: UpdateUserRoleDto,
  ) {
    if (id === requestingAdminId) {
      throw new ForbiddenException(
        'Vous ne pouvez pas modifier votre propre rôle.',
      );
    }
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return this.prisma.user.update({
      where: { id },
      data: { role: dto.role as any },
      select: { id: true, nom: true, prenom: true, email: true, role: true },
    });
  }

  // 9.3.4 — Send a one-off message from an admin to a student (persisted,
  // no reply/thread UI — that's separate future work if it's ever needed).
  async sendMessage(id: string, adminId: string, dto: SendMessageDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.adminMessage.create({
      data: {
        userId: id,
        adminId,
        subject: dto.subject,
        message: dto.message,
      },
      select: { id: true, subject: true, message: true, createdAt: true },
    });
  }
}
