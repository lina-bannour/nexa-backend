import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

describe('AuthService — password reset & email verification', () => {
  let service: AuthService;
  let prisma: {
    user: { findUnique: jest.Mock; update: jest.Mock; create: jest.Mock };
    passwordResetToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    emailVerificationToken: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let mailService: {
    sendPasswordResetEmail: jest.Mock;
    sendVerificationEmail: jest.Mock;
  };

  const user = {
    id: 'user-1',
    email: 'etudiant@nexa.tn',
    role: 'STUDENT',
    emailVerified: false,
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
      passwordResetToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailVerificationToken: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((ops) => Promise.all(ops)),
    };
    mailService = {
      sendPasswordResetEmail: jest.fn(),
      sendVerificationEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: MailService, useValue: mailService },
        { provide: JwtService, useValue: { sign: () => 'signed.jwt.token' } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('forgotPassword', () => {
    it('creates a reset code and emails it when the user exists', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.create.mockResolvedValue({});

      const result = await service.forgotPassword({ email: user.email });

      expect(prisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id, used: false },
      });
      expect(prisma.passwordResetToken.create).toHaveBeenCalled();
      expect(mailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        user.email,
        expect.stringMatching(/^\d{6}$/),
      );
      expect(result.message).toMatch(/réinitialisation/i);
    });

    it('returns the same generic message for unknown emails (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'inconnu@nexa.tn' });

      expect(mailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result.message).toMatch(/réinitialisation/i);
    });
  });

  describe('resetPassword', () => {
    it('rejects an invalid or expired code', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.findUnique.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          email: user.email,
          code: '000000',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an expired code', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: user.id,
        used: false,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.resetPassword({
          email: user.email,
          code: '123456',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates the password and marks the code as used when valid', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'reset-1',
        userId: user.id,
        used: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });

      const result = await service.resetPassword({
        email: user.email,
        code: '123456',
        newPassword: 'newpass123',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.message).toMatch(/succès/i);
    });
  });

  describe('register', () => {
    it('creates the user as unverified and emails a verification code', async () => {
      prisma.user.findUnique.mockResolvedValue(null); // no existing account
      prisma.user.create.mockResolvedValue(user);
      prisma.emailVerificationToken.create.mockResolvedValue({});

      await service.register({
        email: user.email,
        password: 'password123',
        nom: 'Bannour',
        prenom: 'Lina',
      });

      expect(prisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: user.id, used: false },
      });
      expect(mailService.sendVerificationEmail).toHaveBeenCalledWith(
        user.email,
        expect.stringMatching(/^\d{6}$/),
      );
    });
  });

  describe('verifyEmail', () => {
    it('rejects an invalid or expired code', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerificationToken.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyEmail({ email: user.email, code: '000000' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks the user as verified when the code is valid', async () => {
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'verif-1',
        userId: user.id,
        used: false,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });

      const result = await service.verifyEmail({
        email: user.email,
        code: '123456',
      });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.message).toMatch(/vérifié/i);
    });

    it('short-circuits with a friendly message if already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        emailVerified: true,
      });

      const result = await service.verifyEmail({
        email: user.email,
        code: '123456',
      });

      expect(prisma.emailVerificationToken.findUnique).not.toHaveBeenCalled();
      expect(result.message).toMatch(/déjà vérifié/i);
    });
  });

  describe('resendVerification', () => {
    it('sends a new code for an unverified account', async () => {
      prisma.user.findUnique.mockResolvedValue(user);

      await service.resendVerification({ email: user.email });

      expect(mailService.sendVerificationEmail).toHaveBeenCalled();
    });

    it('does not send a code for an already-verified account (no-op, generic response)', async () => {
      prisma.user.findUnique.mockResolvedValue({
        ...user,
        emailVerified: true,
      });

      const result = await service.resendVerification({ email: user.email });

      expect(mailService.sendVerificationEmail).not.toHaveBeenCalled();
      expect(result.message).toMatch(/code a été envoyé/i);
    });
  });
});
