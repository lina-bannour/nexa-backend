import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prisma: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    exerciseAttempt: { count: jest.Mock };
  };

  const student = {
    id: 'user-1',
    email: 'eleve@nexa.tn',
    nom: 'Ben Ali',
    prenom: 'Sami',
    role: 'STUDENT',
    status: 'ACTIVE',
  };

  const admin = { ...student, id: 'admin-1', role: 'ADMIN' };

  beforeEach(async () => {
    prisma = {
      user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      exerciseAttempt: { count: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 9.2.3 — Tests de la page de détail utilisateur
  describe('findOne', () => {
    it('throws NotFoundException for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns exercisesAttempted/exercisesSolved without the password hash', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...student,
        passwordHash: 'hashed',
        _count: { attempts: 12, contestSessions: 2, posts: 3 },
      });
      prisma.exerciseAttempt.count.mockResolvedValue(7);

      const result = await service.findOne('user-1');

      expect(prisma.exerciseAttempt.count).toHaveBeenCalledWith({
        where: { userId: 'user-1', isCorrect: true },
      });
      expect(result).not.toHaveProperty('passwordHash');
      expect(result.exercisesAttempted).toBe(12);
      expect(result.exercisesSolved).toBe(7);
    });
  });

  describe('updateStatus', () => {
    it('throws NotFoundException for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('missing', { status: 'SUSPENDED' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('suspends a student', async () => {
      prisma.user.findUnique.mockResolvedValue(student);
      prisma.user.update.mockResolvedValue({ ...student, status: 'SUSPENDED' });

      const result = await service.updateStatus('user-1', {
        status: 'SUSPENDED',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { status: 'SUSPENDED' },
        }),
      );
      expect(result.status).toBe('SUSPENDED');
    });

    // An admin account reaching this method at all would mean the RolesGuard
    // was bypassed or a caller passed an admin's id directly — refuse either way.
    it('refuses to change status of an admin account', async () => {
      prisma.user.findUnique.mockResolvedValue(admin);

      await expect(
        service.updateStatus('admin-1', { status: 'BANNED' }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('refuses to let an admin change their own role', async () => {
      await expect(
        service.updateRole('admin-1', 'admin-1', { role: 'STUDENT' }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an unknown user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updateRole('missing', 'admin-1', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('promotes a student to admin', async () => {
      prisma.user.findUnique.mockResolvedValue(student);
      prisma.user.update.mockResolvedValue({ ...student, role: 'ADMIN' });

      const result = await service.updateRole('user-1', 'admin-1', {
        role: 'ADMIN',
      });

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: { role: 'ADMIN' },
        }),
      );
      expect(result.role).toBe('ADMIN');
    });
  });
});
