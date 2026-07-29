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

  // ─── Student: List contests (grouped by year), with the caller's own
  // progress on each one if they've started it ────────────────────────────
  async findAll(filiere?: string, userId?: string) {
    const contests = await this.prisma.contest.findMany({
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

    if (!userId) return contests;

    const sessions = await this.prisma.contestSession.findMany({
      where: { userId, contestId: { in: contests.map((c) => c.id) } },
      select: { contestId: true, questionsCompleted: true, xpTotal: true, isCompleted: true },
    });
    const byContest = new Map(sessions.map((s) => [s.contestId, s]));

    return contests.map((c) => ({
      ...c,
      myProgress: byContest.get(c.id) ?? null,
    }));
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
    // Never send the actual free-text answer to the client — only whether
    // one exists, per question.
    return {
      ...contest,
      questions: contest.questions.map(({ reponseTexte, ...q }) => ({
        ...q,
        hasReponseTexte: !!reponseTexte,
      })),
    };
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

  // ─── Student: Free-text guess, checked before choices are ever shown ──────
  // Only writes a ContestSessionAnswer row on a correct guess — a wrong
  // guess must NOT be recorded, since sessionId+questionId is unique and
  // would otherwise permanently block the real (QCM) submission for this
  // question.
  async checkTextAnswer(
    sessionId: string,
    questionId: string,
    userId: string,
    text: string,
  ) {
    const session = await this.prisma.contestSession.findUnique({
      where: { id: sessionId },
      include: { contest: { include: { questions: true } } },
    });
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new BadRequestException('Unauthorized');
    if (session.isCompleted) throw new BadRequestException('Session already completed');

    const question = await this.prisma.contestQuestion.findUnique({
      where: { id: questionId },
    });
    if (!question) throw new NotFoundException('Question not found');
    if (!question.reponseTexte) {
      throw new BadRequestException('This question has no free-text answer configured');
    }

    const alreadyAnswered = await this.prisma.contestSessionAnswer.findUnique({
      where: { sessionId_questionId: { sessionId, questionId } },
    });
    if (alreadyAnswered) throw new BadRequestException('Already answered');

    const normalize = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const isCorrect = normalize(text) === normalize(question.reponseTexte);

    if (!isCorrect) {
      return { correct: false };
    }

    // Correct — record it exactly like submitAnswer would, with full XP
    // since no hints have been shown yet, plus the configurable "direct
    // answer" bonus (feature 12.2).
    const directBonus = await this.getDirectAnswerBonus();
    const xpEarned = question.xpBase + directBonus;

    await this.prisma.contestSessionAnswer.create({
      data: {
        sessionId,
        questionId,
        selectedChoiceId: null,
        isCorrect: true,
        hintsUsed: 0,
        xpEarned,
      },
    });

    const totalQuestions = session.contest.questions.length;
    const answeredCount = await this.prisma.contestSessionAnswer.count({ where: { sessionId } });
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { xpTotal: { increment: xpEarned } },
    });

    return {
      correct: true,
      xpEarned,
      solution: question.solutionDetaillee,
      questionsCompleted: answeredCount,
      totalQuestions,
      isCompleted,
    };
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
    // A zero-hint correct answer also earns the configurable "direct
    // answer" bonus, on top of the question's own XP barème.
    const directBonus =
      isCorrect && dto.hintsUsed === 0 ? await this.getDirectAnswerBonus() : 0;
    const xpEarned = isCorrect
      ? Math.floor(question.xpBase * (1 - penalty / 100)) + directBonus
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

  // ─── "Solve on paper, submit a photo" mode (alternative to the QCM) ──────
  // The student solves the whole contest offline, then uploads a photo of
  // their work here. This just stores the submission as PENDING — the
  // actual review/grading workflow (an admin screen to look at the photo
  // and mark it reviewed, with a score/note) is a separate piece of work,
  // not built here.

  async createPhotoSubmission(
    contestId: string,
    userId: string,
    imageBase64: string,
  ) {
    const contest = await this.prisma.contest.findUnique({
      where: { id: contestId },
    });
    if (!contest) throw new NotFoundException('Contest not found');

    // Stored inline as a data URL for now — swapping this for a real
    // object-storage upload (S3 / Cloud Storage) and storing just the
    // resulting URL is a natural next step, but out of scope here.
    const imageUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:image/jpeg;base64,${imageBase64}`;

    return this.prisma.contestPhotoSubmission.create({
      data: { contestId, userId, imageUrl },
    });
  }

  async getMyPhotoSubmission(contestId: string, userId: string) {
    return this.prisma.contestPhotoSubmission.findFirst({
      where: { contestId, userId },
      orderBy: { submittedAt: 'desc' },
    });
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

  // Reads the admin-configured "direct answer" XP bonus (feature 12.2) —
  // awarded on top of the question's own barème when a student answers
  // correctly with zero hints used. Mirrors exercises.service.ts.
  private async getDirectAnswerBonus(): Promise<number> {
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: 1 },
      });
      return settings?.xpPerDirectAnswer ?? 10;
    } catch {
      return 10;
    }
  }
}
