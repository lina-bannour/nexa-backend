import { Test, TestingModule } from '@nestjs/testing';
import { ExercisesController } from './exercises.controller';
import { ExercisesService } from './exercises.service';

describe('ExercisesController', () => {
  let controller: ExercisesController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    submitAnswer: jest.Mock;
    remove: jest.Mock;
  };

  const req = { user: { userId: 'user-1', role: 'STUDENT' } };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      submitAnswer: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ExercisesController],
      providers: [{ provide: ExercisesService, useValue: service }],
    }).compile();

    controller = module.get<ExercisesController>(ExercisesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll forwards matiere/difficulte filters', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll('MATHEMATIQUES', 'UN_ETOILE');

    expect(service.findAll).toHaveBeenCalledWith('MATHEMATIQUES', 'UN_ETOILE');
  });

  it('submitAnswer passes the authenticated user id', async () => {
    service.submitAnswer.mockResolvedValue({ isCorrect: true, xpEarned: 100 });

    await controller.submitAnswer(
      'ex-1',
      { choiceId: 'c-1', hintsUsed: 0 },
      req,
    );

    expect(service.submitAnswer).toHaveBeenCalledWith('ex-1', 'user-1', {
      choiceId: 'c-1',
      hintsUsed: 0,
    });
  });

  it('create delegates to the service', async () => {
    service.create.mockResolvedValue({ id: 'ex-1' });

    await controller.create({
      titre: 'Limites',
      matiere: 'MATHEMATIQUES',
      difficulte: 'UN_ETOILE',
      enonce: '...',
      solutionDetaillee: '...',
      xpBase: 100,
      choix: [],
    });

    expect(service.create).toHaveBeenCalled();
  });

  it('remove delegates to the service', async () => {
    service.remove.mockResolvedValue({ message: 'Exercise deleted' });

    await controller.remove('ex-1');

    expect(service.remove).toHaveBeenCalledWith('ex-1');
  });
});
