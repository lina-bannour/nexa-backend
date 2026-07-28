import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ExercisesService } from './exercises.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ExercisesService', () => {
  let service: ExercisesService;
  let prisma: {
    exercise: {
      create: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    exerciseAttempt: { create: jest.Mock };
    user: { update: jest.Mock };
    platformSettings: { findUnique: jest.Mock };
  };

  const exercise = {
    id: 'ex-1',
    titre: 'Limites',
    xpBase: 100,
    solutionDetaillee: 'La solution...',
    choix: [
      { id: 'choice-correct', label: 'A', isCorrect: true },
      { id: 'choice-wrong', label: 'B', isCorrect: false },
    ],
  };

  beforeEach(async () => {
    prisma = {
      exercise: {
        create: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      exerciseAttempt: { create: jest.fn() },
      user: { update: jest.fn() },
      platformSettings: { findUnique: jest.fn().mockResolvedValue(null) },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExercisesService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<ExercisesService>(ExercisesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Free-text "guess before you see the choices" phase
  describe('findOne', () => {
    it('never leaks the raw reponseTexte, only a boolean flag', async () => {
      prisma.exercise.findUnique.mockResolvedValue({
        ...exercise,
        reponseTexte: 'la bonne réponse',
        choix: [{ id: 'c1', label: 'A' }],
      });

      const result = await service.findOne('ex-1');

      expect(result).not.toHaveProperty('reponseTexte');
      expect(result.hasReponseTexte).toBe(true);
    });

    it('reports hasReponseTexte as false when none is configured', async () => {
      prisma.exercise.findUnique.mockResolvedValue({
        ...exercise,
        reponseTexte: null,
        choix: [],
      });

      const result = await service.findOne('ex-1');

      expect(result.hasReponseTexte).toBe(false);
    });
  });

  describe('checkTextAnswer', () => {
    const exerciseWithText = { ...exercise, reponseTexte: '  Racine de 2  ' };

    it('throws if the exercise has no free-text answer configured', async () => {
      prisma.exercise.findUnique.mockResolvedValue({ ...exercise, reponseTexte: null });

      await expect(service.checkTextAnswer('ex-1', 'user-1', 'anything')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('matches case- and whitespace-insensitively, awards full XP plus the direct-answer bonus, and records the attempt', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseWithText);

      const result = await service.checkTextAnswer('ex-1', 'user-1', 'racine   DE 2');

      // 100 (xpBase) + 10 (default xpPerDirectAnswer bonus, no settings configured)
      expect(result).toEqual({ correct: true, xpEarned: 110, solution: 'La solution...' });
      expect(prisma.exerciseAttempt.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1', exerciseId: 'ex-1',
          selectedChoiceId: null, isCorrect: true, hintsUsed: 0, xpEarned: 110,
        },
      });
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 110 } },
      });
    });

    it('records a failed guess without awarding XP, and never reveals the solution', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exerciseWithText);

      const result = await service.checkTextAnswer('ex-1', 'user-1', 'wrong guess');

      expect(result).toEqual({ correct: false });
      expect(prisma.exerciseAttempt.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1', exerciseId: 'ex-1',
          selectedChoiceId: null, isCorrect: false, hintsUsed: 0, xpEarned: 0,
        },
      });
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // 10.1.3 — Tests de la création d'exercice
  describe('create', () => {
    it('creates an exercise with its choices in one call', async () => {
      prisma.exercise.create.mockResolvedValue(exercise);

      await service.create({
        titre: 'Limites',
        matiere: 'MATHEMATIQUES',
        difficulte: 'DEUX_ETOILES',
        enonce: 'Calculez la limite...',
        solutionDetaillee: 'La solution...',
        xpBase: 100,
        choix: [
          { label: 'A', isCorrect: true },
          { label: 'B', isCorrect: false },
        ],
      });

      expect(prisma.exercise.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            titre: 'Limites',
            matiere: 'MATHEMATIQUES',
            difficulte: 'DEUX_ETOILES',
            choix: {
              create: [
                { label: 'A', isCorrect: true },
                { label: 'B', isCorrect: false },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('submitAnswer', () => {
    it('throws NotFoundException for an unknown exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.submitAnswer('missing', 'user-1', {
          choiceId: 'x',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when the choice does not belong to the exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);

      await expect(
        service.submitAnswer('ex-1', 'user-1', {
          choiceId: 'not-a-real-choice',
          hintsUsed: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('awards full XP plus the direct-answer bonus for a correct answer with no hints used', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 0,
      });

      expect(result.isCorrect).toBe(true);
      // 100 (xpBase) + 10 (default xpPerDirectAnswer bonus, no settings configured)
      expect(result.xpEarned).toBe(110);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 110 } },
      });
    });

    it('applies the admin-configured direct-answer bonus instead of the default', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});
      prisma.platformSettings.findUnique.mockResolvedValue({ xpPerDirectAnswer: 25 });

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 0,
      });

      expect(result.xpEarned).toBe(125); // 100 + 25
    });

    it('does not award the direct-answer bonus once any hint was used', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});
      prisma.platformSettings.findUnique.mockResolvedValue({
        xpPerDirectAnswer: 25,
        hintPenaltyPercent1: 10,
        hintPenaltyPercent2: 20,
        hintPenaltyPercent3: 30,
        hintPenaltyPercent4: 40,
      });

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 1,
      });

      expect(result.xpEarned).toBe(90); // 100 * (1 - 10/100), no bonus
    });

    it('awards 0 XP for an incorrect answer and does not touch user XP', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-wrong',
        hintsUsed: 0,
      });

      expect(result.isCorrect).toBe(false);
      expect(result.xpEarned).toBe(0);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    // 12.2.3 — la pénalité d'indice configurée en admin est bien appliquée
    it('applies the default hint penalties when no settings are configured', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});
      prisma.platformSettings.findUnique.mockResolvedValue(null);

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 2, // default penalty for hint 2 = 20%
      });

      expect(result.xpEarned).toBe(80); // 100 * (1 - 20/100)
    });

    it('applies the admin-configured hint penalties instead of the defaults', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});
      prisma.platformSettings.findUnique.mockResolvedValue({
        hintPenaltyPercent1: 5,
        hintPenaltyPercent2: 15,
        hintPenaltyPercent3: 25,
        hintPenaltyPercent4: 50,
      });

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 4,
      });

      expect(result.xpEarned).toBe(50); // 100 * (1 - 50/100)
    });

    it('falls back to the default penalties if the settings lookup fails', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});
      prisma.platformSettings.findUnique.mockRejectedValue(
        new Error('DB unreachable'),
      );

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-correct',
        hintsUsed: 1, // default penalty for hint 1 = 10%
      });

      expect(result.xpEarned).toBe(90);
    });

    it('reveals the solution and the correct choice id in the response', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exerciseAttempt.create.mockResolvedValue({});

      const result = await service.submitAnswer('ex-1', 'user-1', {
        choiceId: 'choice-wrong',
        hintsUsed: 0,
      });

      expect(result.solution).toBe('La solution...');
      expect(result.correctChoiceId).toBe('choice-correct');
    });
  });

  describe('remove', () => {
    it('throws NotFoundException for an unknown exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes an existing exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);

      const result = await service.remove('ex-1');

      expect(prisma.exercise.delete).toHaveBeenCalledWith({
        where: { id: 'ex-1' },
      });
      expect(result.message).toMatch(/deleted/i);
    });
  });
});
