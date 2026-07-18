import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';

const RESET_CODE_TTL_MS = 60 * 60 * 1000; // 1 hour
const VERIFICATION_CODE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private mailService: MailService,
  ) {}

  async register(dto: RegisterDto) {
    // Check if email already exists
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        nom: dto.nom,
        prenom: dto.prenom,
        ecole: dto.ecole,
        filiere: dto.filiere as any,
      },
    });

    await this.sendVerificationCode(user.id, user.email);

    // Return JWT. The account is created as unverified (emailVerified:
    // false); we still sign the user in immediately so the mobile app's
    // existing register → auto-login flow keeps working, and prompt for
    // the verification code from within the app afterwards.
    return this.signToken(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check password
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === 'SUSPENDED') {
      throw new UnauthorizedException('Ce compte est actuellement suspendu.');
    }
    if (user.status === 'BANNED') {
      throw new UnauthorizedException('Ce compte a été banni.');
    }

    // Return JWT
    return this.signToken(user.id, user.email, user.role);
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const genericResponse = {
      message:
        'Si un compte existe pour cet email, un code de réinitialisation a été envoyé.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // Always return the same generic message so we don't leak which emails
    // are registered (avoids account enumeration).
    if (!user) {
      return genericResponse;
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = this.hashCode(dto.email, code);

    // Invalidate any previous outstanding codes for this user.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, used: false },
    });

    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
      },
    });

    await this.mailService.sendPasswordResetEmail(user.email, code);

    return genericResponse;
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    const tokenHash = this.hashCode(dto.email, dto.code);
    const resetToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (
      !resetToken ||
      resetToken.userId !== user.id ||
      resetToken.used ||
      resetToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Mot de passe réinitialisé avec succès.' };
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) {
      throw new BadRequestException('Code invalide ou expiré');
    }
    if (user.emailVerified) {
      return { message: 'Email déjà vérifié.' };
    }

    const tokenHash = this.hashCode(dto.email, dto.code);
    const verificationToken =
      await this.prisma.emailVerificationToken.findUnique({
        where: { tokenHash },
      });

    if (
      !verificationToken ||
      verificationToken.userId !== user.id ||
      verificationToken.used ||
      verificationToken.expiresAt < new Date()
    ) {
      throw new BadRequestException('Code invalide ou expiré');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      this.prisma.emailVerificationToken.update({
        where: { id: verificationToken.id },
        data: { used: true },
      }),
    ]);

    return { message: 'Email vérifié avec succès.' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const genericResponse = {
      message:
        'Si un compte non vérifié existe pour cet email, un nouveau code a été envoyé.',
    };

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user || user.emailVerified) {
      return genericResponse;
    }

    await this.sendVerificationCode(user.id, user.email);
    return genericResponse;
  }

  private async sendVerificationCode(userId: string, email: string) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const tokenHash = this.hashCode(email, code);

    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId, used: false },
    });

    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
      },
    });

    await this.mailService.sendVerificationEmail(email, code);
  }

  // Codes are hashed (rather than stored in clear text) the same way we'd
  // treat any other credential, and scoped to the email so a code can't be
  // replayed against a different account.
  private hashCode(email: string, code: string) {
    return crypto
      .createHash('sha256')
      .update(`${email.toLowerCase()}:${code}`)
      .digest('hex');
  }

  private signToken(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
