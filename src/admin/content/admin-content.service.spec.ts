import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminContentService } from './admin-content.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminContentService', () => {
  let service: AdminContentService;
  let prisma: {
    exercise: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    exerciseChoice: { deleteMany: jest.Mock };
    contest: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
    };
    contestQuestion: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
  };

  const exercise = {
    id: 'ex-1',
    titre: 'Limites',
    matiere: 'MATHEMATIQUES',
    difficulte: 'DEUX_ETOILES',
    enonce: '...',
  };

  const contest = {
    id: 'contest-1',
    titre: 'Concours 2025',
    annee: 2025,
    filiere: 'MP',
  };

  beforeEach(async () => {
    prisma = {
      exercise: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      exerciseChoice: { deleteMany: jest.fn() },
      contest: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      contestQuestion: { deleteMany: jest.fn() },
      // $transaction runs the callback against the same mocked prisma object,
      // matching how the real PrismaService's interactive transaction works.
      $transaction: jest.fn((fn) => fn(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminContentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminContentService>(AdminContentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 10.1.3 / 10.2.3 — Tests de modification / suppression d'exercice
  describe('updateExercise', () => {
    it('throws NotFoundException for an unknown exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(
        service.updateExercise('missing', { titre: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates scalar fields without touching choices when none are provided', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exercise.update.mockResolvedValue({
        ...exercise,
        titre: 'Limites et continuité',
      });

      await service.updateExercise('ex-1', { titre: 'Limites et continuité' });

      expect(prisma.exerciseChoice.deleteMany).not.toHaveBeenCalled();
      expect(prisma.exercise.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ex-1' },
          data: expect.objectContaining({ titre: 'Limites et continuité' }),
        }),
      );
    });

    it('replaces all choices atomically when choix is provided', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);
      prisma.exercise.update.mockResolvedValue(exercise);

      const choix = [
        { label: 'A', isCorrect: false },
        { label: 'B', isCorrect: true },
      ];
      await service.updateExercise('ex-1', { choix });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.exerciseChoice.deleteMany).toHaveBeenCalledWith({
        where: { exerciseId: 'ex-1' },
      });
      // Choices are replaced via a nested create on the exercise update
      // (not a separate createMany), so the delete + the nested write both
      // happen inside the same transaction and can't leave the exercise
      // with zero choices if one half fails.
      expect(prisma.exercise.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ choix: { create: choix } }),
        }),
      );
    });
  });

  describe('deleteExercise', () => {
    it('throws NotFoundException for an unknown exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(null);

      await expect(service.deleteExercise('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes an existing exercise', async () => {
      prisma.exercise.findUnique.mockResolvedValue(exercise);

      const result = await service.deleteExercise('ex-1');

      expect(prisma.exercise.delete).toHaveBeenCalledWith({
        where: { id: 'ex-1' },
      });
      expect(result.message).toMatch(/deleted/i);
    });
  });

  // 10.3.4 — Tests CRUD sur les sujets de concours
  describe('updateContest', () => {
    it('throws NotFoundException for an unknown contest', async () => {
      prisma.contest.findUnique.mockResolvedValue(null);

      await expect(
        service.updateContest('missing', { titre: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the contest fields without touching questions when none are provided', async () => {
      prisma.contest.findUnique.mockResolvedValue(contest);
      prisma.contest.update.mockResolvedValue({
        ...contest,
        titre: 'Concours 2026',
      });

      await service.updateContest('contest-1', {
        titre: 'Concours 2026',
        filiere: 'PC',
      });

      expect(prisma.contestQuestion.deleteMany).not.toHaveBeenCalled();
      expect(prisma.contest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'contest-1' },
          data: expect.objectContaining({
            titre: 'Concours 2026',
            filiere: 'PC',
          }),
        }),
      );
    });

    // This is the one case the other implementation actually got wrong: its
    // UpdateContestDto had no `questions` field at all, so a contest's
    // questions could never be edited through this endpoint.
    it('replaces the question set atomically when questions are provided', async () => {
      prisma.contest.findUnique.mockResolvedValue(contest);
      prisma.contest.update.mockResolvedValue(contest);

      const questions = [
        {
          ordre: 1,
          enonce: 'Calculez...',
          solutionDetaillee: '...',
          xpBase: 10,
          choix: [
            { label: 'A', isCorrect: true },
            { label: 'B', isCorrect: false },
          ],
        },
      ];
      await service.updateContest('contest-1', { questions });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.contestQuestion.deleteMany).toHaveBeenCalledWith({
        where: { contestId: 'contest-1' },
      });
      expect(prisma.contest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            questions: {
              create: [
                {
                  ordre: 1,
                  enonce: 'Calculez...',
                  solutionDetaillee: '...',
                  xpBase: 10,
                  choix: { create: questions[0].choix },
                },
              ],
            },
          }),
        }),
      );
    });
  });

  describe('deleteContest', () => {
    it('throws NotFoundException for an unknown contest', async () => {
      prisma.contest.findUnique.mockResolvedValue(null);

      await expect(service.deleteContest('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes an existing contest', async () => {
      prisma.contest.findUnique.mockResolvedValue(contest);

      const result = await service.deleteContest('contest-1');

      expect(prisma.contest.delete).toHaveBeenCalledWith({
        where: { id: 'contest-1' },
      });
      expect(result.message).toMatch(/deleted/i);
    });
  });
});
