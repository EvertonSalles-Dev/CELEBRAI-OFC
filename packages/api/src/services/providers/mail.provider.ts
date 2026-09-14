import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Provedor de e-mail transacional.
 *
 * Driver `smtp`: envio real via nodemailer.
 * Driver `disabled`: não envia — apenas retorna `skipped`, permitindo rodar
 * o sistema sem credenciais configuradas (os e-mails ficam registrados na
 * tabela `notifications` e podem ser reenviados depois).
 */
export interface SendMailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendMailResult {
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  provider: string;
  messageId?: string;
  error?: string;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (env.MAIL_DRIVER !== 'smtp') return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT ?? 587,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
  });

  return transporter;
}

export const mailProvider = {
  isEnabled(): boolean {
    return env.MAIL_DRIVER === 'smtp' && Boolean(env.SMTP_HOST);
  },

  async send(input: SendMailInput): Promise<SendMailResult> {
    const tx = getTransporter();

    if (!tx) {
      logger.info(`[mail:disabled] Simulando envio para ${input.to}: ${input.subject}`);
      return { status: 'SKIPPED', provider: 'disabled' };
    }

    try {
      const info = await tx.sendMail({
        from: env.MAIL_FROM,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: input.replyTo,
      });
      return { status: 'SENT', provider: 'smtp', messageId: info.messageId };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido no envio';
      logger.error('Falha ao enviar e-mail', { to: input.to, error: message });
      return { status: 'FAILED', provider: 'smtp', error: message };
    }
  },
};
