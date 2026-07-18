import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AdminModerationService } from './admin-moderation.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminModerationService', () => {
  let service: AdminModerationService;
  let prisma: {
    forumPost: {
      count: jest.Mock;
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    forumLike: { count: jest.Mock };
  };

  const reportedPost = {
    id: 'post-1',
    titre: 'Signalé',
    status: 'REPORTED',
    author: {
      id: 'user-1',
      nom: 'Bannour',
      prenom: 'Lina',
      email: 'lina@nexa.tn',
    },
    _count: { likes: 2, replies: 1 },
  };

  beforeEach(async () => {
    prisma = {
      forumPost: {
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      forumLike: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminModerationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminModerationService>(AdminModerationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getForumStats', () => {
    it('aggregates counts by status plus total likes', async () => {
      prisma.forumPost.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // published
        .mockResolvedValueOnce(2) // reported
        .mockResolvedValueOnce(1); // removed
      prisma.forumLike.count.mockResolvedValue(42);

      const result = await service.getForumStats();

      expect(result).toEqual({
        total: 10,
        published: 7,
        reported: 2,
        removed: 1,
        totalLikes: 42,
      });
    });
  });

  // 11.1.3 — Tests de la liste des posts signalés
  describe('getReportedPosts', () => {
    it('only fetches posts with REPORTED status', async () => {
      prisma.forumPost.findMany.mockResolvedValue([reportedPost]);

      const result = await service.getReportedPosts();

      expect(prisma.forumPost.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'REPORTED' } }),
      );
      expect(result).toEqual([reportedPost]);
    });
  });

  // 11.2.3 — Tests des actions de modération (validation, suppression)
  describe('updatePostStatus', () => {
    it('throws NotFoundException for an unknown post', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePostStatus('missing', 'REMOVED'),
      ).rejects.toThrow(NotFoundException);
    });

    it('validates a reported post back to PUBLISHED', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(reportedPost);
      prisma.forumPost.update.mockResolvedValue({
        ...reportedPost,
        status: 'PUBLISHED',
      });

      const result = await service.updatePostStatus('post-1', 'PUBLISHED');

      expect(prisma.forumPost.update).toHaveBeenCalledWith({
        where: { id: 'post-1' },
        data: { status: 'PUBLISHED' },
      });
      expect(result.status).toBe('PUBLISHED');
    });

    it('removes a reported post', async () => {
      prisma.forumPost.findUnique.mockResolvedValue(reportedPost);
      prisma.forumPost.update.mockResolvedValue({
        ...reportedPost,
        status: 'REMOVED',
      });

      const result = await service.updatePostStatus('post-1', 'REMOVED');

      expect(result.status).toBe('REMOVED');
    });
  });
});
