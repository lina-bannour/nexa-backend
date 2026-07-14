import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePostDto, CreateReplyDto } from './dto/forum.dto';

@Injectable()
export class ForumService {
  constructor(private prisma: PrismaService) {}

  // 7.1 — List posts with optional matiere filter
  async listPosts(matiere?: string) {
    return this.prisma.forumPost.findMany({
      where: {
        status: 'PUBLISHED',
        ...(matiere && { matiere: matiere as any }),
      },
      include: {
        author: { select: { id: true, nom: true, prenom: true, filiere: true } },
        _count: { select: { likes: true, replies: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Get one post with replies
  async getPost(id: string) {
    const post = await this.prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, nom: true, prenom: true, filiere: true } },
        replies: {
          include: {
            author: { select: { id: true, nom: true, prenom: true } },
            _count: { select: { likes: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        _count: { select: { likes: true, replies: true } },
      },
    });
    if (!post) throw new NotFoundException('Post not found');
    return post;
  }

  // 7.2 — Create post
  async createPost(dto: CreatePostDto, userId: string) {
    return this.prisma.forumPost.create({
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
  }

  // 7.3 — Add reply
  async createReply(postId: string, dto: CreateReplyDto, userId: string) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumReply.create({
      data: { contenu: dto.contenu, postId, authorId: userId },
      include: { author: { select: { id: true, nom: true, prenom: true } } },
    });
  }

  // 7.3 — Toggle like on post
  async togglePostLike(postId: string, userId: string) {
    const existing = await this.prisma.forumLike.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) {
      await this.prisma.forumLike.delete({ where: { userId_postId: { userId, postId } } });
      return { liked: false };
    }
    await this.prisma.forumLike.create({ data: { userId, postId } });
    return { liked: true };
  }

  // Report a post
  async reportPost(postId: string) {
    const post = await this.prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw new NotFoundException('Post not found');
    return this.prisma.forumPost.update({
      where: { id: postId },
      data: { status: 'REPORTED' },
    });
  }
}
