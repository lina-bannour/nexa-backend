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
      findMany: jest.Mock;
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
        findMany: jest.fn(),
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

  describe('findOne', () => {
    it('never leaks raw reponseTexte, only a boolean flag per question', async () => {
      prisma.contest.findUnique.mockResolvedValue({
        id: 'contest-1',
        questions: [{ ...question, reponseTexte: 'answer text' }],
      });

      const result = await service.findOne('contest-1');

      expect(result.questions[0]).not.toHaveProperty('reponseTexte');
      expect(result.questions[0].hasReponseTexte).toBe(true);
    });
  });

  describe('checkTextAnswer', () => {
    const questionWithText = { ...question, reponseTexte: '  Racine de 2  ' };

    it('throws NotFoundException for an unknown session', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(null);
      await expect(
        service.checkTextAnswer('missing', 'q-1', 'user-1', 'x'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if the question has no free-text answer configured', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue({ ...question, reponseTexte: null });

      await expect(
        service.checkTextAnswer('session-1', 'q-1', 'user-1', 'x'),
      ).rejects.toThrow(BadRequestException);
    });

    it('does not write any row for a wrong guess (would block the real submission)', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(questionWithText);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);

      const result = await service.checkTextAnswer('session-1', 'q-1', 'user-1', 'wrong');

      expect(result).toEqual({ correct: false });
      expect(prisma.contestSessionAnswer.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('records the answer and awards full XP plus the direct-answer bonus on a correct guess, matching normal submission bookkeeping', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(questionWithText);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1);

      const result = await service.checkTextAnswer('session-1', 'q-1', 'user-1', 'racine   DE 2');

      // 100 (xpBase) + 10 (default xpPerDirectAnswer bonus, no settings configured)
      expect(result).toEqual({
        correct: true, xpEarned: 110, solution: 'La solution...',
        questionsCompleted: 1, totalQuestions: 1, isCompleted: true,
      });
      expect(prisma.contestSessionAnswer.create).toHaveBeenCalledWith({
        data: {
          sessionId: 'session-1', questionId: 'q-1',
          selectedChoiceId: null, isCorrect: true, hintsUsed: 0, xpEarned: 110,
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 110 } },
      });
    });
  });

  // Spec: returning to the contest list should show how many questions the
  // student has already completed on each contest they've started.
  describe('findAll', () => {
    const contests = [
      { id: 'contest-1', titre: 'A', annee: 2025, filiere: 'MP', matiere: 'MATHEMATIQUES', _count: { questions: 5 } },
      { id: 'contest-2', titre: 'B', annee: 2024, filiere: 'MP', matiere: 'MATHEMATIQUES', _count: { questions: 3 } },
    ];

    it('returns contests without myProgress when no user id is given', async () => {
      prisma.contest.findMany.mockResolvedValue(contests);

      const result = await service.findAll();

      expect(prisma.contestSession.findMany).not.toHaveBeenCalled();
      expect(result).toEqual(contests);
    });

    it("attaches the caller's own session progress per contest", async () => {
      prisma.contest.findMany.mockResolvedValue(contests);
      prisma.contestSession.findMany.mockResolvedValue([
        { contestId: 'contest-1', questionsCompleted: 2, xpTotal: 40, isCompleted: false },
      ]);

      const result = await service.findAll(undefined, 'user-1');

      expect(result[0].myProgress).toEqual({
        contestId: 'contest-1', questionsCompleted: 2, xpTotal: 40, isCompleted: false,
      });
      expect(result[1].myProgress).toBeNull();
    });
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

    it('awards full XP plus the direct-answer bonus and marks the session completed when it was the last question', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1); // 1 of 1 questions

      const result = await service.submitAnswer('session-1', 'q-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 0,
      });

      expect(result.isCorrect).toBe(true);
      // 100 (xpBase) + 10 (default xpPerDirectAnswer bonus, no settings configured)
      expect(result.xpEarned).toBe(110);
      expect(result.isCompleted).toBe(true);
      expect(prisma.contestSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'session-1' },
          data: expect.objectContaining({ isCompleted: true }),
        }),
      );
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 110 } },
      });
    });

    it('does not award the direct-answer bonus once any hint was used', async () => {
      prisma.contestSession.findUnique.mockResolvedValue(session);
      prisma.contestQuestion.findUnique.mockResolvedValue(question);
      prisma.contestSessionAnswer.findUnique.mockResolvedValue(null);
      prisma.contestSessionAnswer.count.mockResolvedValue(1);
      prisma.platformSettings.findUnique.mockResolvedValue({
        xpPerDirectAnswer: 25,
        hintPenaltyPercent1: 10,
        hintPenaltyPercent2: 20,
        hintPenaltyPercent3: 30,
        hintPenaltyPercent4: 40,
      });

      const result = await service.submitAnswer('session-1', 'q-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 1,
      });

      expect(result.xpEarned).toBe(90); // 100 * (1 - 10/100), no bonus
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
