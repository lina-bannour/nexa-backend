import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ContestsService } from './contests.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ContestsService', () => {
  let service: ContestsService;
  let prisma: {
    contest: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
    contestSession: {
      findFirst: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    contestQuestion: { findUnique: jest.Mock };
    contestSessionAnswer: {
      findUnique: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
    user: { update: jest.Mock };
    platformSettings: { findUnique: jest.Mock };
  };

  const question = {
    id: 'q-1',
    xpBase: 100,
    solutionDetaillee: 'La solution...',
    choix: [
      { id: 'choice-correct', label: 'A', isCorrect: true },
      { id: 'choice-wrong', label: 'B', isCorrect: false },
    ],
  };

  const session = {
    id: 'session-1',
    userId: 'user-1',
    contestId: 'contest-1',
    isCompleted: false,
    contest: { questions: [question] },
  };

  beforeEach(async () => {
    prisma = {
      contest: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      contestSession: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      contestQuestion: { findUnique: jest.fn() },
      contestSessionAnswer: {
        findUnique: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
      user: { update: jest.fn() },
      platformSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContestsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ContestsService>(ContestsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('creates a contest with its nested questions and choices', async () => {
      prisma.contest.create.mockResolvedValue({ id: 'contest-1' });

      await service.create({
        titre: 'Concours 2026',
        annee: 2026,
        filiere: 'MP',
        questions: [
          {
            ordre: 1,
            enonce: '...',
            solutionDetaillee: '...',
            xpBase: 100,
            choix: [{ label: 'A', isCorrect: true }],
          },
        ],
      });

      expect(prisma.contest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titre: 'Concours 2026',
            filiere: 'MP',
            questions: {
              create: [
                expect.objectContaining({
                  ordre: 1,
                  choix: { create: [{ label: 'A', isCorrect: true }] },
                }),
              ],
            },
          }),
        }),
      );
    });
  });

  describe('startSession', () => {
    it('throws NotFoundException for an unknown contest', async () => {
      prisma.contest.findUnique.mockResolvedValue(null);

      await expect(service.startSession('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('resumes an existing incomplete session instead of creating a new one', async () => {
      prisma.contest.findUnique.mockResolvedValue({ id: 'contest-1' });
      prisma.contestSession.findFirst.mockResolvedValue(session);

      const result = await service.startSession('contest-1', 'user-1');

      expect(prisma.contestSession.create).not.toHaveBeenCalled();
      expect(result).toBe(session);
    });

    it('creates a new session when there is no incomplete one', async () => {
      prisma.contest.findUnique.mockResolvedValue({ id: 'contest-1' });
      prisma.contestSession.findFirst.mockResolvedValue(null);
      prisma.contestSession.create.mockResolvedValue(session);

      await service.startSession('contest-1', 'user-1');

      expect(prisma.contestSession.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', contestId: 'contest-1' },
        include: { answers: true },
      });
    });
  });

  describe('submitAnswer', () => {
    it('throws NotFoundException for an unknown session', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(null);

      await expect(
        service.submitAnswer('missing', 'q-1', 'user-1', {
          choiceId: 'x',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if the session belongs to another user', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);

      await expect(
        service.submitAnswer('session-1', 'q-1', 'someone-else', {
          choiceId: 'choice-correct',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if the session is already completed', async () => {
      prisma.contestSession.findUnique.mockResolvedValue({
        ...session,
        isCompleted: true,
      });

      await expect(
        service.submitAnswer('session-1', 'q-1', 'user-1', {
          choiceId: 'choice-correct',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if the question was already answered', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue({
        id: 'existing-answer',
      });

      await expect(
        service.submitAnswer('session-1', 'q-1', 'user-1', {
          choiceId: 'choice-correct',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('awards XP for a correct answer and marks the session completed when it was the last question', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1); // 1 of 1 questions

      const result = await service.submitAnswer('session-1', 'q-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 0,
      });

      expect(result.isCorrect).toBe(true);
      expect(result.xpEarned).toBe(100);
      expect(result.isCompleted).toBe(true);
      expect(prisma.contestSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({ isCompleted: true }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 100 } },
      });
    });

    it('does not award XP for an incorrect answer', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1);

      const result = await service.submitAnswer('session-1', 'q-1', 'user-1', {
        choiceId: 'choice-wrong',
        hintsUsed: 0,
      });

      expect(result.xpEarned).toBe(0);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // 12.2.3 — la pénalité d'indice configurée en admin s'applique aussi aux concours
    it('applies the admin-configured hint penalties', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1);
      prisma.platformSettings.findUnique.mockResolvedValue({
        hintPenaltyPercent1: 5,
        hintPenaltyPercent2: 15,
        hintPenaltyPercent3: 25,
        hintPenaltyPercent4: 50,
      });

      const result = await service.submitAnswer('session-1', 'q-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 3,
      });

      expect(result.xpEarned).toBe(75); // 100 * (1 - 25/100)
    });
  });

  describe('getSession', () => {
    it('throws NotFoundException for an unknown session', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(null);

      await expect(service.getSession('missing', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it("throws BadRequestException for another user's session", async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);

      await expect(
        service.getSession('session-1', 'someone-else'),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns the session for its owner', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);

      const result = await service.getSession('session-1', 'user-1');

      expect(result).toBe(session);
    });
  });
});
