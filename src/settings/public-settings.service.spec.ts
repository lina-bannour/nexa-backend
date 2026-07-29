import { Test, TestingModule } from '@nestjs/testing';
import { PublicSettingsService } from './public-settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PublicSettingsService', () => {
  let service: PublicSettingsService;
  let prisma: { platformSettings: { upsert: jest.Mock } };

  beforeEach(async () => {
    prisma = { platformSettings: { upsert: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PublicSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PublicSettingsService>(PublicSettingsService);
  });

  it('returns only the gamification-related fields, never platform name/support email/maintenance', async () => {
    prisma.platformSettings.upsert.mockResolvedValue({
      id: 1,
      platformName: 'NEXA',
      supportEmail: 'support@nexa.tn',
      websiteUrl: 'https://nexa.tn',
      maintenanceMode: true,
      xpPerDirectAnswer: 10,
      hintPenaltyPercent1: 10,
      hintPenaltyPercent2: 20,
      hintPenaltyPercent3: 30,
      hintPenaltyPercent4: 40,
      xpPerForumPost: 3,
      xpPerForumReply: 1,
    });

    const result = await service.getBareme();

    expect(result).toEqual({
      xpPerDirectAnswer: 10,
      hintPenaltyPercent1: 10,
      hintPenaltyPercent2: 20,
      hintPenaltyPercent3: 30,
      hintPenaltyPercent4: 40,
      xpPerForumPost: 3,
      xpPerForumReply: 1,
    });
    expect(result).not.toHaveProperty('maintenanceMode');
    expect(result).not.toHaveProperty('supportEmail');
    expect(result).not.toHaveProperty('platformName');
  });

  it('creates a default settings row if none exists yet', async () => {
    prisma.platformSettings.upsert.mockResolvedValue({
      id: 1,
      xpPerDirectAnswer: 10,
      hintPenaltyPercent1: 10,
      hintPenaltyPercent2: 20,
      hintPenaltyPercent3: 30,
      hintPenaltyPercent4: 40,
      xpPerForumPost: 3,
      xpPerForumReply: 1,
    });

    await service.getBareme();

    expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
      where: { id: 1 },
      update: {},
      create: { id: 1 },
    });
  });
});
