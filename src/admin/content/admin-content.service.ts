import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateExerciseDto, UpdateContestDto } from './dto/update-content.dto';

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

  async updateExercise(id: string, dto: UpdateExerciseDto) {
    const { choix, ...exerciseData } = dto;
    const existing = await this.prisma.exercise.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Exercise not found');

    return this.prisma.$transaction(async (tx) => {
      if (choix) {
        // Replace choices atomically with the exercise update so a failed
        // write can't leave the exercise with no choices attached.
        await tx.exerciseChoice.deleteMany({ where: { exerciseId: id } });
      }
      return tx.exercise.update({
        where: { id },
        data: {
          ...exerciseData,
          ...(exerciseData.matiere && { matiere: exerciseData.matiere as any }),
          ...(exerciseData.difficulte && { difficulte: exerciseData.difficulte as any }),
          ...(choix && { choix: { create: choix } }),
        },
        include: { choix: true },
      });
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

  async updateContest(id: string, dto: UpdateContestDto) {
    const existing = await this.prisma.contest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contest not found');
    const { questions, ...contestData } = dto;

    return this.prisma.$transaction(async (tx) => {
      if (questions) {
        // Replace the question set atomically with the rest of the update.
        await tx.contestQuestion.deleteMany({ where: { contestId: id } });
      }
      return tx.contest.update({
        where: { id },
        data: {
          ...contestData,
          ...(contestData.filiere && { filiere: contestData.filiere as any }),
          ...(contestData.matiere && { matiere: contestData.matiere as any }),
          ...(questions && {
            questions: {
              create: questions.map(({ choix, ...q }) => ({
                ...q,
                choix: { create: choix },
              })),
            },
          }),
        },
        include: { questions: { include: { choix: true } } },
      });
    });
  }

  async deleteContest(id: string) {
    const existing = await this.prisma.contest.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Contest not found');
    await this.prisma.contest.delete({ where: { id } });
    return { message: 'Contest deleted' };
  }
}
