import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const { MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS } = process.env;

    // If SMTP isn't configured (e.g. local dev), we fall back to logging the
    // email content instead of sending it, so the reset flow still works end
    // to end without requiring real mail credentials.
    if (MAIL_HOST && MAIL_USER && MAIL_PASS) {
      this.transporter = nodemailer.createTransport({
        host: MAIL_HOST,
        port: MAIL_PORT ? parseInt(MAIL_PORT, 10) : 587,
        secure: process.env.MAIL_SECURE === 'true',
        auth: { user: MAIL_USER, pass: MAIL_PASS },
      });
    }
  }

  async sendVerificationEmail(to: string, code: string) {
    const from = process.env.MAIL_FROM || 'NEXA <no-reply@nexa.app>';
    const subject = 'NEXA — Vérifiez votre adresse email';
    const text =
      `Bienvenue sur NEXA !\n\n` +
      `Voici votre code de vérification pour activer votre compte : ${code}\n\n` +
      `Ce code est valable 24 heures.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#0B1D3A;">Bienvenue sur NEXA !</h2>
        <p>Voici votre code pour activer votre compte :</p>
        <p style="font-size: 28px; font-weight: 800; letter-spacing: 4px; color:#126BFF;">${code}</p>
        <p>Ce code est valable <strong>24 heures</strong>.</p>
      </div>`;

    if (!this.transporter) {
      this.logger.warn(
        `MAIL_HOST not configured — logging verification email instead of sending it.`,
      );
      this.logger.log(`To: ${to}\nSubject: ${subject}\n${text}`);
      return;
    }

    await this.transporter.sendMail({ from, to, subject, text, html });
  }

  async sendPasswordResetEmail(to: string, code: string) {
    const from = process.env.MAIL_FROM || 'NEXA <no-reply@nexa.app>';
    const subject = 'NEXA — Réinitialisation de votre mot de passe';
    const text =
      `Vous avez demandé la réinitialisation de votre mot de passe NEXA.\n\n` +
      `Voici votre code de vérification : ${code}\n\n` +
      `Ce code est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
        <h2 style="color:#0B1D3A;">Réinitialisation de mot de passe</h2>
        <p>Vous avez demandé la réinitialisation de votre mot de passe NEXA.</p>
        <p style="font-size: 28px; font-weight: 800; letter-spacing: 4px; color:#126BFF;">${code}</p>
        <p>Ce code est valable <strong>1 heure</strong>.</p>
        <p style="color:#8FA3C0; font-size: 12px;">Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>`;

    if (!this.transporter) {
      this.logger.warn(
        `MAIL_HOST not configured — logging password reset email instead of sending it.`,
      );
      this.logger.log(`To: ${to}\nSubject: ${subject}\n${text}`);
      return;
    }

    await this.transporter.sendMail({ from, to, subject, text, html });
  }
}
