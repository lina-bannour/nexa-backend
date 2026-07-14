import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, UpdateUserStatusDto } from './dto/admin-user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private prisma: PrismaService) {}

  // 9.1 — List all students with filters
  async findAll(search?: string, status?: string, ecole?: string) {
    return this.prisma.user.findMany({
      where: {
        role: 'STUDENT',
        ...(status && { status: status as any }),
        ...(ecole && { ecole }),
        ...(search && {
          OR: [
            { nom: { contains: search, mode: 'insensitive' } },
            { prenom: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
          ],
        }),
      },
      select: {
        id: true, email: true, nom: true, prenom: true,
        role: true, status: true, ecole: true, filiere: true,
        xpTotal: true, streak: true, createdAt: true,
        _count: { select: { attempts: true } },
      },
      orderBy: { xpTotal: 'desc' },
    });
  }

  // 9.2 — Get one student detail
  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { attempts: true, contestSessions: true, posts: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, ...safe } = user;
    return safe;
  }

  // 9.3.1 — Update user info
  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, filiere: dto.filiere as any },
      select: { id: true, nom: true, prenom: true, email: true, status: true, filiere: true, ecole: true },
    });
  }

  // 9.3.2 — Suspend or ban
  async updateStatus(id: string, dto: UpdateUserStatusDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.user.update({
      where: { id },
      data: { status: dto.status as any },
      select: { id: true, nom: true, prenom: true, email: true, status: true },
    });
  }
}
