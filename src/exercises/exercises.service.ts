import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateExerciseDto } from './dto/create-exercise.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';

@Injectable()
export class ExercisesService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: Create exercise ───────────────────────────────────────────────
  async create(dto: CreateExerciseDto) {
    const { choix, ...exerciseData } = dto;
    return this.prisma.exercise.create({
      data: {
        ...exerciseData,
        matiere: exerciseData.matiere as any,
        difficulte: exerciseData.difficulte as any,
        choix: {
          create: choix,
        },
      },
      include: { choix: true },
    });
  }

  // ─── Student: List exercises (with filters) ───────────────────────────────
  async findAll(matiere?: string, difficulte?: string) {
    return this.prisma.exercise.findMany({
      where: {
        ...(matiere && { matiere: matiere as any }),
        ...(difficulte && { difficulte: difficulte as any }),
      },
      select: {
        id: true,
        titre: true,
        matiere: true,
        difficulte: true,
        xpBase: true,
        // Don't expose solution or correct answers in list
        _count: { select: { attempts: true } },
      },
    });
  }

  // ─── Student: Get one exercise (with hints, without revealing correct answer) ─
  async findOne(id: string) {
    const exercise = await this.prisma.exercise.findUnique({
      where: { id },
      include: {
        choix: {
          select: {
            id: true,
            label: true,
            // isCorrect intentionally excluded — revealed only after submission
          },
        },
      },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');
    return exercise;
  }

  // ─── Student: Submit answer ───────────────────────────────────────────────
  async submitAnswer(exerciseId: string, userId: string, dto: SubmitAnswerDto) {
    // Load exercise with correct answer
    const exercise = await this.prisma.exercise.findUnique({
      where: { id: exerciseId },
      include: { choix: true },
    });
    if (!exercise) throw new NotFoundException('Exercise not found');

    // Validate the submitted choice belongs to this exercise
    const selectedChoice = exercise.choix.find(c => c.id === dto.choiceId);
    if (!selectedChoice) throw new BadRequestException('Invalid choice');

    // Calculate XP with hint penalty
    // Get penalty percentages from a simple config (can be made dynamic later)
    const penalties = [0, 10, 20, 30, 40];
    const penaltyPercent = penalties[dto.hintsUsed] ?? 40;
    const isCorrect = selectedChoice.isCorrect;
    const xpEarned = isCorrect
      ? Math.floor(exercise.xpBase * (1 - penaltyPercent / 100))
      : 0;

    // Save attempt
    const attempt = await this.prisma.exerciseAttempt.create({
      data: {
        userId,
        exerciseId,
        selectedChoiceId: dto.choiceId,
        isCorrect,
        hintsUsed: dto.hintsUsed,
        xpEarned,
      },
    });

    // Update user XP if correct
    if (isCorrect && xpEarned > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xpEarned } },
      });
    }

    // Return result with solution revealed
    return {
      isCorrect,
      xpEarned,
      solution: exercise.solutionDetaillee,
      correctChoiceId: exercise.choix.find(c => c.isCorrect)?.id,
    };
  }

  // ─── Admin: Delete exercise ───────────────────────────────────────────────
  async remove(id: string) {
    const exercise = await this.prisma.exercise.findUnique({ where: { id } });
    if (!exercise) throw new NotFoundException('Exercise not found');
    await this.prisma.exercise.delete({ where: { id } });
    return { message: 'Exercise deleted' };
  }
}
