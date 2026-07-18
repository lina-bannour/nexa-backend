import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { user: { findUnique: jest.Mock } };

  const payload = { sub: 'user-1', email: 'eleve@nexa.tn', role: 'STUDENT' };

  beforeEach(async () => {
    prisma = { user: { findUnique: jest.fn() } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtStrategy, { provide: PrismaService, useValue: prisma }],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('accepts a token for an active user', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'ACTIVE' });

    const result = await strategy.validate(payload);

    expect(result).toEqual({
      userId: 'user-1',
      email: 'eleve@nexa.tn',
      role: 'STUDENT',
    });
  });

  // This is the check that was previously entirely absent — the strategy
  // used to trust the JWT payload alone and never looked the user up, so a
  // suspension/ban applied after a token was issued had no effect until
  // that token expired.
  it('rejects a token belonging to a suspended user', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'SUSPENDED' });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token belonging to a banned user', async () => {
    prisma.user.findUnique.mockResolvedValue({ status: 'BANNED' });
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token for a user that no longer exists', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
  });
});
