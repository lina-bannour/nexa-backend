import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Deliberately separate from AdminSettingsService: this only ever exposes
// the subset of PlatformSettings that's safe and useful for students to
// see (the XP barème shown on the profile's Progression screen) — never
// platform name/support email/maintenance flag, which stay admin-only.
@Injectable()
export class PublicSettingsService {
  constructor(private prisma: PrismaService) {}

  async getBareme() {
    const settings = await this.prisma.platformSettings.upsert({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });

    return {
      xpPerDirectAnswer: settings.xpPerDirectAnswer,
      hintPenaltyPercent1: settings.hintPenaltyPercent1,
      hintPenaltyPercent2: settings.hintPenaltyPercent2,
      hintPenaltyPercent3: settings.hintPenaltyPercent3,
      hintPenaltyPercent4: settings.hintPenaltyPercent4,
      xpPerForumPost: settings.xpPerForumPost,
      xpPerForumReply: settings.xpPerForumReply,
    };
  }
}
