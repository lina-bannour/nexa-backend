import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

  async getLeaderboard(filiere?: string) {
    return this.prisma.user.findMany({
      where: {
        ...(filiere && { filiere: filiere as any }),
      },
      select: {
        id: true,
        nom: true,
        prenom: true,
        filiere: true,
        ecole: true,
        xpTotal: true,
      },
      orderBy: { xpTotal: 'desc' },
      take: 50,
    });
  }
}