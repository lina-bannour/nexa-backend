import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, CreateReplyDto } from './dto/forum.dto';

@Injectable()
export class ForumService {
  constructor(private prisma: PrismaService) {}

  // 7.1 — List posts with optional matiere filter
  async listPosts(matiere: string | undefined, userId: string) {
    const posts = await this.prisma.forumPost.findMany({
      where: {
        status: 'PUBLISHED',
        ...(matiere && { matiere: matiere as any }),
      },
      include: {
        author: {
          select: { id: true, nom: true, prenom: true, filiere: true },
        },
        _count: { select: { likes: true, replies: true } },
        likes: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return posts.map(({ likes, ...post }) => ({
      ...post,
      likedByMe: likes.length > 0,
    }));
  }

  // Get one post with replies
  async getPost(id: string, userId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, nom: true, prenom: true, filiere: true },
        },
        replies: {
          include: {
            author: { select: { id: true, nom: true, prenom: true } },
            _count: { select: { likes: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { likes: true, replies: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    const { likes, ...rest } = post;
    return { ...rest, likedByMe: likes.length > 0 };
  }

  // Reads the admin-configured forum XP rewards (feature 12.2). Falls back to
  // the previous implicit default (0 — no reward) if settings can't be
  // reached — creating a post or reply should never fail because of the
  // config lookup.
  private async getForumXpRewards(): Promise<{ post: number; reply: number }> {
    try {
      const settings = await this.prisma.platformSettings.findUnique({
        where: { id: 1 },
      });
      if (!settings) return { post: 0, reply: 0 };
      return {
        post: settings.xpPerForumPost ?? 0,
        reply: settings.xpPerForumReply ?? 0,
      };
    } catch {
      return { post: 0, reply: 0 };
    }
  }

  // 7.2 — Create post
  async createPost(dto: CreatePostDto, userId: string) {
    const post = await this.prisma.forumPost.create({
      data: {
        titre: dto.titre,
        contenu: dto.contenu,
        matiere: dto.matiere as any,
        authorId: userId,
      },
      include: {
        author: { select: { id: true, nom: true, prenom: true } },
      },
    });

    const { post: xpEarned } = await this.getForumXpRewards();
    if (xpEarned > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xpEarned } },
      });
    }

    return { ...post, xpEarned };
  }

  // 7.3 — Add reply
  async createReply(postId: string, dto: CreateReplyDto, userId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');

    const reply = await this.prisma.forumReply.create({
      data: { contenu: dto.contenu, postId, authorId: userId },
      include: { author: { select: { id: true, nom: true, prenom: true } } },
    });

    const { reply: xpEarned } = await this.getForumXpRewards();
    if (xpEarned > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xpEarned } },
      });
    }

    return { ...reply, xpEarned };
  }

  // 7.3 — Toggle like on post
  async togglePostLike(postId: string, userId: string) {
    const existing = await this.prisma.forumLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await this.prisma.forumLike.delete({
        where: { userId_postId: { userId, postId } },
      });
      return { liked: false };
    }
    await this.prisma.forumLike.create({ data: { userId, postId } });
    return { liked: true };
  }

  // Report a post
  async reportPost(postId: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id: postId },
    });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({
      where: { id: postId },
      data: { status: 'REPORTED' },
    });
  }
}
