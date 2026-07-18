import { Test, TestingModule } from '@nestjs/testing';
import { AdminSettingsService } from './admin-settings.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let prisma: {
    platformSettings: { upsert: jest.Mock; findUnique: jest.Mock };
  };

  const settings = {
    id: 1,
    platformName: 'NEXA',
    supportEmail: 'support@nexa.tn',
    websiteUrl: 'https://nexa.tn',
    xpPerDirectAnswer: 10,
    xpPerForumPost: 3,
    xpPerForumReply: 1,
    hintPenaltyPercent1: 10,
    hintPenaltyPercent2: 20,
    hintPenaltyPercent3: 30,
    hintPenaltyPercent4: 40,
    maintenanceMode: false,
  };

  beforeEach(async () => {
    prisma = {
      platformSettings: { upsert: jest.fn(), findUnique: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminSettingsService>(AdminSettingsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('gets-or-creates the single settings row (id: 1)', async () => {
      prisma.platformSettings.upsert.mockResolvedValue(settings);

      const result = await service.getSettings();

      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: {},
        create: { id: 1 },
      });
      expect(result).toEqual(settings);
    });
  });

  // 12.1.3 — Tests de la mise à jour des paramètres généraux
  describe('updateSettings — general params', () => {
    it('updates the platform name / support email / website url', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({
        ...settings,
        platformName: 'NEXA Prépa',
      });

      await service.updateSettings({ platformName: 'NEXA Prépa' });

      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: { platformName: 'NEXA Prépa' },
        create: { id: 1, platformName: 'NEXA Prépa' },
      });
    });
  });

  // 12.2.3 — Tests de la configuration de gamification
  describe('updateSettings — gamification params', () => {
    it('updates XP and hint-penalty values', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({
        ...settings,
        xpPerDirectAnswer: 15,
        hintPenaltyPercent1: 5,
      });

      await service.updateSettings({
        xpPerDirectAnswer: 15,
        hintPenaltyPercent1: 5,
      });

      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: { xpPerDirectAnswer: 15, hintPenaltyPercent1: 5 },
        }),
      );
    });
  });

  // 12.3.4 — Tests du mode maintenance
  describe('updateMaintenance', () => {
    it('turns maintenance mode on', async () => {
      prisma.platformSettings.upsert.mockResolvedValue({
        ...settings,
        maintenanceMode: true,
      });

      const result = await service.updateMaintenance({ maintenanceMode: true });

      expect(prisma.platformSettings.upsert).toHaveBeenCalledWith({
        where: { id: 1 },
        update: { maintenanceMode: true },
        create: { id: 1, maintenanceMode: true },
      });
      expect(result.maintenanceMode).toBe(true);
    });
  });

  describe('isMaintenanceMode', () => {
    it('returns true when maintenance mode is on', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue({
        maintenanceMode: true,
      });

      await expect(service.isMaintenanceMode()).resolves.toBe(true);
    });

    it('returns false when the settings row does not exist yet', async () => {
      prisma.platformSettings.findUnique.mockResolvedValue(null);

      await expect(service.isMaintenanceMode()).resolves.toBe(false);
    });

    it('fails open (returns false) if the database call throws', async () => {
      prisma.platformSettings.findUnique.mockRejectedValue(
        new Error('DB unreachable'),
      );

      await expect(service.isMaintenanceMode()).resolves.toBe(false);
    });
  });
});
