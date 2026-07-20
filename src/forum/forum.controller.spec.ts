import { Test, TestingModule } from '@nestjs/testing';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

describe('ForumController', () => {
  let controller: ForumController;
  let forumService: {
    listPosts: jest.Mock;
    getPost: jest.Mock;
    createPost: jest.Mock;
    createReply: jest.Mock;
    togglePostLike: jest.Mock;
    reportPost: jest.Mock;
  };

  const req = { user: { userId: 'user-1' } };

  beforeEach(async () => {
    forumService = {
      listPosts: jest.fn(),
      getPost: jest.fn(),
      createPost: jest.fn(),
      createReply: jest.fn(),
      togglePostLike: jest.fn(),
      reportPost: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ForumController],
      providers: [{ provide: ForumService, useValue: forumService }],
    }).compile();

    controller = module.get<ForumController>(ForumController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('listPosts forwards the optional matiere filter and authenticated user id', async () => {
    forumService.listPosts.mockResolvedValue([]);
    await controller.listPosts('MATHEMATIQUES', req);
    expect(forumService.listPosts).toHaveBeenCalledWith(
      'MATHEMATIQUES',
      'user-1',
    );
  });

  it('getPost delegates to the service with the post id and authenticated user id', async () => {
    forumService.getPost.mockResolvedValue({ id: 'post-1' });
    const result = await controller.getPost('post-1', req);
    expect(forumService.getPost).toHaveBeenCalledWith('post-1', 'user-1');
    expect(result).toEqual({ id: 'post-1' });
  });

  it('createPost delegates to the service with the dto and authenticated user id', async () => {
    const dto = { titre: 'Aide', contenu: '...', matiere: 'MATHEMATIQUES' };
    forumService.createPost.mockResolvedValue({ id: 'post-1', xpEarned: 3 });

    const result = await controller.createPost(dto, req);

    expect(forumService.createPost).toHaveBeenCalledWith(dto, 'user-1');
    expect(result.xpEarned).toBe(3);
  });

  it('createReply delegates to the service with the post id, dto, and authenticated user id', async () => {
    const dto = { contenu: 'Merci' };
    forumService.createReply.mockResolvedValue({ id: 'reply-1', xpEarned: 1 });

    await controller.createReply('post-1', dto, req);

    expect(forumService.createReply).toHaveBeenCalledWith(
      'post-1',
      dto,
      'user-1',
    );
  });

  it('toggleLike delegates to the service with the post id and authenticated user id', async () => {
    forumService.togglePostLike.mockResolvedValue({ liked: true });

    const result = await controller.toggleLike('post-1', req);

    expect(forumService.togglePostLike).toHaveBeenCalledWith(
      'post-1',
      'user-1',
    );
    expect(result).toEqual({ liked: true });
  });

  it('reportPost delegates to the service with the post id', async () => {
    forumService.reportPost.mockResolvedValue({
      id: 'post-1',
      status: 'REPORTED',
    });

    const result = await controller.reportPost('post-1');

    expect(forumService.reportPost).toHaveBeenCalledWith('post-1');
    expect(result.status).toBe('REPORTED');
  });
});
