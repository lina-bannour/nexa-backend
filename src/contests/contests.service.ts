import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContestDto, SubmitContestAnswerDto } from './dto/contest.dto';

@Injectable()
export class ContestsService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: Create contest with questions ────────────────────────────────
  async create(dto: CreateContestDto) {
    const { questions, ...contestData } = dto;
    return this.prisma.contest.create({
      data: {
        ...contestData,
        filiere: contestData.filiere as any,
        matiere: contestData.matiere as any,
        questions: {
          create: questions.map(({ choix, ...q }) => ({
            ...q,
            choix: { create: choix },
          })),
        },
      },
      include: { questions: { include: { choix: true } } },
    });
  }

  // ─── Student: List contests (grouped by year) ────────────────────────────
  async findAll(filiere?: string) {
    return this.prisma.contest.findMany({
      where: { ...(filiere && { filiere: filiere as any }) },
      select: {
        id: true,
        titre: true,
        annee: true,
        filiere: true,
        matiere: true,
        _count: { select: { questions: true } },
      },
      orderBy: { annee: 'desc' },
    });
  }

  // ─── Student: Get one contest with questions (no correct answers) ─────────
  async findOne(id: string) {
    const contest = await this.prisma.contest.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { ordre: 'asc' },
          include: {
            choix: { select: { id: true, label: true } },
          },
        },
      },
    });
    if (!contest) throw new NotFoundException('Contest not found');
    return contest;
  }

  // ─── Student: Start or resume session ────────────────────────────────────
  async startSession(contestId: string, userId: string) {
    const contest = await this.prisma.contest.findUnique({
      where: { id: contestId },
    });
    if (!contest) throw new NotFoundException('Contest not found');

    // Check existing incomplete session
    const existing = await this.prisma.contestSession.findFirst({
      where: { contestId, userId, isCompleted: false },
      include: { answers: true },
    });
    if (existing) return existing;

    return this.prisma.contestSession.create({
      data: { userId, contestId },
      include: { answers: true },
    });
  }

  // ─── Student: Submit answer for one question ──────────────────────────────
  async submitAnswer(
    sessionId: string,
    questionId: string,
    userId: string,
    dto: SubmitContestAnswerDto,
  ) {
    const session = await this.prisma.contestSession.findUnique({
      where: { id: sessionId },
      include: { contest: { include: { questions: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new BadRequestException('Unauthorized');
    if (session.isCompleted)
      throw new BadRequestException('Session already completed');

    const question = await this.prisma.contestQuestion.findUnique({
      where: { id: questionId },
      include: { choix: true },
    });
    if (!question) throw new NotFoundException('Question not found');

    const selectedChoice = question.choix.find((c) => c.id === dto.choiceId);
    if (!selectedChoice) throw new BadRequestException('Invalid choice');

    // Check not already answered
    const alreadyAnswered = await this.prisma.contestSessionAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });
    if (alreadyAnswered) throw new BadRequestException('Already answered');

    // Calculate XP with hint penalty (configurable via /admin/settings — feature 12.2)
    const penalties = await this.getHintPenalties();
    const penalty = penalties[dto.hintsUsed] ?? penalties[penalties.length - 1];
    const isCorrect = selectedChoice.isCorrect;
    const xpEarned = isCorrect
      ? Math.floor(question.xpBase * (1 - penalty / 100))
      : 0;

    // Save answer
    await this.prisma.contestSessionAnswer.create({
      data: {
        sessionId,
        questionId,
        selectedChoiceId: dto.choiceId,
        isCorrect,
        hintsUsed: dto.hintsUsed,
        xpEarned,
      },
    });

    // Update session progress
    const totalQuestions = session.contest.questions.length;
    const answeredCount = await this.prisma.contestSessionAnswer.count({
      where: { sessionId },
    });
    const isCompleted = answeredCount >= totalQuestions;

    await this.prisma.contestSession.update({
      where: { id: sessionId },
      data: {
        questionsCompleted: answeredCount,
        xpTotal: { increment: xpEarned },
        isCompleted,
        completedAt: isCompleted ? new Date() : undefined,
      },
    });

    // Update user XP
    if (xpEarned > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xpEarned } },
      });
    }

    return {
      isCorrect,
      xpEarned,
      solution: question.solutionDetaillee,
      correctChoiceId: question.choix.find((c) => c.isCorrect)?.id,
      questionsCompleted: answeredCount,
      totalQuestions,
      isCompleted,
    };
  }

  // ─── Student: Get session progress ───────────────────────────────────────
  async getSession(sessionId: string, userId: string) {
    const session = await this.prisma.contestSession.findUnique({
      where: { id: sessionId },
      include: { answers: true },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId)
      throw new BadRequestException('Unauthorized');
    return session;
  }

  // Reads the admin-configured hint penalties (feature 12.2). Falls back to
  // the previous hardcoded defaults if settings haven't been configured yet,
  // or if the settings row can't be reached.
  private async getHintPenalties(): Promise<number[]> {
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: 1 },
      });
      if (!settings) {
        return [0, 10, 20, 30, 40];
      }
      return [
        0,
        settings.hintPenaltyPercent1,
        settings.hintPenaltyPercent2,
        settings.hintPenaltyPercent3,
        settings.hintPenaltyPercent4,
      ];
    } catch {
      return [0, 10, 20, 30, 40];
    }
  }
}
