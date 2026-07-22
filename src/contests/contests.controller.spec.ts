import { Test, TestingModule } from '@nestjs/testing';
import { ContestsController } from './contests.controller';
import { ContestsService } from './contests.service';

describe('ContestsController', () => {
  let controller: ContestsController;
  let service: {
    create: jest.Mock;
    findAll: jest.Mock;
    findOne: jest.Mock;
    startSession: jest.Mock;
    submitAnswer: jest.Mock;
    getSession: jest.Mock;
  };

  const req = { user: { userId: 'user-1', role: 'STUDENT' } };

  beforeEach(async () => {
    service = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      startSession: jest.fn(),
      submitAnswer: jest.fn(),
      getSession: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContestsController],
      providers: [{ provide: ContestsService, useValue: service }],
    }).compile();

    controller = module.get<ContestsController>(ContestsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('findAll forwards the filière filter and authenticated user id', async () => {
    service.findAll.mockResolvedValue([]);

    await controller.findAll('MP', req);

    expect(service.findAll).toHaveBeenCalledWith('MP', 'user-1');
  });

  it('startSession passes the authenticated user id', async () => {
    service.startSession.mockResolvedValue({ id: 'session-1' });

    await controller.startSession('contest-1', req);

    expect(service.startSession).toHaveBeenCalledWith('contest-1', 'user-1');
  });

  it('submitAnswer passes the authenticated user id', async () => {
    service.submitAnswer.mockResolvedValue({ isCorrect: true });

    await controller.submitAnswer(
      'session-1',
      'question-1',
      { choiceId: 'c-1' } as any,
      req,
    );

    expect(service.submitAnswer).toHaveBeenCalledWith(
      'session-1',
      'question-1',
      'user-1',
      { choiceId: 'c-1' },
    );
  });

  it('getSession passes the authenticated user id', async () => {
    service.getSession.mockResolvedValue({ id: 'session-1' });

    await controller.getSession('session-1', req);

    expect(service.getSession).toHaveBeenCalledWith('session-1', 'user-1');
  });

  it('create delegates to the service', async () => {
    service.create.mockResolvedValue({ id: 'contest-1' });

    await controller.create({ titre: 'Concours 2026' } as any);

    expect(service.create).toHaveBeenCalled();
  });
});
