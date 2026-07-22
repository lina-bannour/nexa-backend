import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateUserDto,
  UpdateUserStatusDto,
  UpdateUserRoleDto,
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
  ) {
    const safePage = page > 0 ? page : 1;
    const safePageSize = pageSize > 0 && pageSize <= 100 ? pageSize : 20;

    const where = {
      role: 'STUDENT' as const,
      ...(status && { status: status as any }),
      ...(ecole && { ecole }),
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

    const exercisesSolved = await this.prisma.exerciseAttempt.count({
      where: { userId: id, isCorrect: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash, ...safe } = user;
    return {
      ...safe,
      exercisesAttempted: user._count.attempts,
      exercisesSolved,
    };
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
}
