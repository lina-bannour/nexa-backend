import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminContentService {
  constructor(private prisma: PrismaService) {}

  // ─── EXERCISES ─────────────────────────────────────────────────────────────

  async listExercises() {
    return this.prisma.exercise.findMany({
      include: { choix: true, _count: { select: { attempts: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateExercise(id: string, data: any) {
    const { choix, ...exerciseData } = data;
    const existing = await this.prisma.exercise.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Exercise not found');

    if (choix) {
      // Delete existing choices and recreate
      await this.prisma.exerciseChoice.deleteMany({ where: { exerciseId: id } });
      await this.prisma.exerciseChoice.createMany({
        data: choix.map((c: any) => ({ ...c, exerciseId: id })),
      });
    }

    return this.prisma.exercise.update({
      where: { id },
      data: {
        ...exerciseData,
        ...(exerciseData.matiere && { matiere: exerciseData.matiere as any }),
        ...(exerciseData.difficulte && { difficulte: exerciseData.difficulte as any }),
      },
      include: { choix: true },
    });
  }

  async deleteExercise(id: string) {
    const existing = await this.prisma.exercise.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Exercise not found');
    await this.prisma.exercise.delete({ where: { id } });
    return { message: 'Exercise deleted' };
  }

  // ─── CONTESTS ──────────────────────────────────────────────────────────────

  async listContests() {
    return this.prisma.contest.findMany({
      include: { _count: { select: { questions: true, sessions: true } } },
      orderBy: [{ annee: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async updateContest(id: string, data: any) {
    const existing = await this.prisma.contest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contest not found');
    const { questions, ...contestData } = data;
    return this.prisma.contest.update({
      where: { id },
      data: {
        ...contestData,
        ...(contestData.filiere && { filiere: contestData.filiere as any }),
        ...(contestData.matiere && { matiere: contestData.matiere as any }),
      },
    });
  }

  async deleteContest(id: string) {
    const existing = await this.prisma.contest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contest not found');
    await this.prisma.contest.delete({ where: { id } });
    return { message: 'Contest deleted' };
  }
}
