import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AdminModerationService {
  constructor(private prisma: PrismaService) {}

  // 11.1 — Stats + list reported posts
  async getForumStats() {
    const [total, published, reported, removed, totalLikes] = await Promise.all([
      this.prisma.forumPost.count(),
      this.prisma.forumPost.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.forumPost.count({ where: { status: 'REPORTED' } }),
      this.prisma.forumPost.count({ where: { status: 'REMOVED' } }),
      this.prisma.forumLike.count({ where: { postId: { not: null } } }),
    ]);
    return { total, published, reported, removed, totalLikes };
  }

  async getReportedPosts() {
    return this.prisma.forumPost.findMany({
      where: { status: 'REPORTED' },
      include: {
        author: { select: { id: true, nom: true, prenom: true, email: true } },
        _count: { select: { likes: true, replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllPosts() {
    return this.prisma.forumPost.findMany({
      include: {
        author: { select: { id: true, nom: true, prenom: true } },
        _count: { select: { likes: true, replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 11.2 — Validate or remove a post
  async updatePostStatus(id: string, status: 'PUBLISHED' | 'REMOVED') {
    const post = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({
      where: { id },
      data: { status },
    });
  }

  // Report a post (student action)
  async reportPost(id: string) {
    const post = await this.prisma.forumPost.findUnique({ where: { id } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({
      where: { id },
      data: { status: 'REPORTED' },
    });
  }
}
