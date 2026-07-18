import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ForumService } from './forum.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ForumService', () => {
  let service: ForumService;
  let prisma: {
    forumPost: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    forumReply: { create: jest.Mock };
    forumLike: { findUnique: jest.Mock; create: jest.Mock; delete: jest.Mock };
    platformSettings: { findUnique: jest.Mock };
    user: { update: jest.Mock };
  };

  const post = { id: 'post-1', titre: 'Aide', contenu: '...', matiere: 'MATHEMATIQUES', status: 'PUBLISHED' };

  beforeEach(async () => {
    prisma = {
      forumPost: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      forumReply: { create: jest.fn() },
      forumLike: { findUnique: jest.fn(), create: jest.fn(), delete: jest.fn() },
      platformSettings: { findUnique: jest.fn() },
      user: { update: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ForumService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<ForumService>(ForumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 7.1.3 — Tests d'affichage et de filtrage des posts
  describe('listPosts', () => {
    it('only returns published posts when no matiere filter is given', async () => {
      prisma.forumPost.findMany.mockResolvedValue([post]);

      const result = await service.listPosts();

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PUBLISHED' } }),
      );
      expect(result).toEqual([post]);
    });

    it('filters by matiere when provided', async () => {
      prisma.forumPost.findMany.mockResolvedValue([post]);

      await service.listPosts('MATHEMATIQUES');

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'PUBLISHED', matiere: 'MATHEMATIQUES' },
        }),
      );
    });
  });

  describe('getPost', () => {
    it('throws NotFoundException for an unknown post', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(null);
      await expect(service.getPost('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns the post with its replies', async () => {
      prisma.forumPost.findUnique.mockResolvedValue({ ...post, replies: [] });
      const result = await service.getPost('post-1');
      expect(result).toEqual(expect.objectContaining({ id: 'post-1' }));
    });
  });

  // 7.2.3 — Tests de la création de post
  describe('createPost', () => {
    it('creates the post and awards no XP when settings are absent', async () => {
      prisma.forumPost.create.mockResolvedValue(post);
      prisma.platformSettings.findUnique.mockResolvedValue(null);

      const result = await service.createPost(
        { titre: 'Aide', contenu: '...', matiere: 'MATHEMATIQUES' },
        'user-1',
      );

      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.xpEarned).toBe(0);
    });

    it('awards the configured XP for a new post', async () => {
      prisma.forumPost.create.mockResolvedValue(post);
      prisma.platformSettings.findUnique.mockResolvedValue({
        xpPerForumPost: 3,
        xpPerForumReply: 1,
      });

      const result = await service.createPost(
        { titre: 'Aide', contenu: '...', matiere: 'MATHEMATIQUES' },
        'user-1',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 3 } },
      });
      expect(result.xpEarned).toBe(3);
    });

    // Settings lookup failing should never block the post itself.
    it('still creates the post if the settings lookup throws', async () => {
      prisma.forumPost.create.mockResolvedValue(post);
      prisma.platformSettings.findUnique.mockRejectedValue(new Error('db down'));

      const result = await service.createPost(
        { titre: 'Aide', contenu: '...', matiere: 'MATHEMATIQUES' },
        'user-1',
      );

      expect(result.xpEarned).toBe(0);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // 7.3.4 — Tests des interactions (réponses, likes)
  describe('createReply', () => {
    it('throws NotFoundException for an unknown post', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(null);
      await expect(
        service.createReply('missing', { contenu: 'Merci' }, 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates the reply and awards the configured XP', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(post);
      prisma.forumReply.create.mockResolvedValue({ id: 'reply-1', contenu: 'Merci' });
      prisma.platformSettings.findUnique.mockResolvedValue({
        xpPerForumPost: 3,
        xpPerForumReply: 1,
      });

      const result = await service.createReply('post-1', { contenu: 'Merci' }, 'user-1');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { xpTotal: { increment: 1 } },
      });
      expect(result.xpEarned).toBe(1);
    });
  });

  describe('togglePostLike', () => {
    it('likes a post that was not previously liked', async () => {
      prisma.forumLike.findUnique.mockResolvedValue(null);

      const result = await service.togglePostLike('post-1', 'user-1');

      expect(prisma.forumLike.create).toHaveBeenCalledWith({
        data: { userId: 'user-1', postId: 'post-1' },
      });
      expect(result).toEqual({ liked: true });
    });

    it('unlikes a post that was already liked', async () => {
      prisma.forumLike.findUnique.mockResolvedValue({ id: 'like-1' });

      const result = await service.togglePostLike('post-1', 'user-1');

      expect(prisma.forumLike.delete).toHaveBeenCalledWith({
        where: { userId_postId: { userId: 'user-1', postId: 'post-1' } },
      });
      expect(result).toEqual({ liked: false });
    });
  });

  describe('reportPost', () => {
    it('throws NotFoundException for an unknown post', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(null);
      await expect(service.reportPost('missing')).rejects.toThrow(NotFoundException);
    });

    it('marks the post as reported', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(post);
      prisma.forumPost.update.mockResolvedValue({ ...post, status: 'REPORTED' });

      const result = await service.reportPost('post-1');

      expect(prisma.forumPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: 'REPORTED' },
      });
      expect(result.status).toBe('REPORTED');
    });
  });
});
