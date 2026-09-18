import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { appUrl } from '../config/env.js';
import {
  generateInvitationCode,
  generateInvitationToken,
  hashToken,
  tokenPrefix,
} from '../shared/tokens.js';
import { logger } from '../config/logger.js';

/**
 * Serviço central do convite: emissão de token, geração de QR Code e
 * transições de estado.
 *
 * Decisões de segurança:
 *  - O token público e o código do QR Code existem em claro apenas na resposta
 *    imediata ao consumidor legítimo (admin copia o link, convidado vê o QR).
 *    No banco ficam somente hashes SHA-256.
 *  - O QR Code carrega APENAS um identificador opaco — nunca CPF nem qualquer
 *    dado pessoal —, permitindo que a validação aconteça 100% no servidor.
 */

/** Inclusões padrão ao carregar um convite completo. */
export const invitationInclude = {
  guest: {
    include: {
      party: true,
      event: { include: { venue: true } },
    },
  },
  response: true,
  checkIns: {
    orderBy: { createdAt: 'desc' },
    include: {
      operator: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.InvitationInclude;

export type FullInvitation = Prisma.InvitationGetPayload<{
  include: typeof invitationInclude;
}>;

/** Prefixo legível do código do QR, derivado do slug do evento. */
function qrPrefixFromSlug(slug: string): string {
  const cleaned = slug.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return cleaned.slice(0, 8) || 'CELEBRAI';
}

/**
 * Monta a URL pública do convite.
 *
 * Usa `appUrl`, que resolve para o domínio **estável** do projeto mesmo quando
 * `APP_URL` foi configurado com um host de deployment efêmero da Vercel (ver
 * `resolveAppUrl` em config/env.ts) — caso contrário o convite morreria com
 * `404 DEPLOYMENT_NOT_FOUND` no próximo deploy.
 */
export function buildInviteLink(token: string): string {
  return `${appUrl}/convite/${token}`;
}

export const invitationService = {
  /**
   * Cria o convite de um convidado, gerando um token único e imprevisível.
   */
  async createForGuest(guestId: string): Promise<{ id: string; token: string; link: string }> {
    const token = generateInvitationToken();
    const tokenHash = hashToken(token);

    const collision = await prisma.invitation.findUnique({ where: { tokenHash } });
    if (collision) {
      logger.warn('Colisão de token de convite detectada — regerando');
      return this.createForGuest(guestId);
    }

    const invitation = await prisma.invitation.create({
      data: {
        guestId,
        tokenHash,
        tokenPrefix: tokenPrefix(token, 8),
        status: 'PENDING',
      },
      select: { id: true },
    });

    return { id: invitation.id, token, link: buildInviteLink(token) };
  },

  /** Busca o convite pelo token em claro (lookup via hash). */
  async findByToken(token: string): Promise<FullInvitation | null> {
    return prisma.invitation.findUnique({
      where: { tokenHash: hashToken(token) },
      include: invitationInclude,
    });
  },

  /** Busca o convite pelo id. */
  async findById(id: string): Promise<FullInvitation | null> {
    return prisma.invitation.findUnique({ where: { id }, include: invitationInclude });
  },

  /** Localiza o convite a partir do código lido no scanner de QR Code. */
  async findByQrCode(code: string): Promise<FullInvitation | null> {
    const normalized = code.trim().toUpperCase();
    return prisma.invitation.findUnique({
      where: { qrCodeHash: hashToken(normalized) },
      include: invitationInclude,
    });
  },

  /**
   * Emite o QR Code do convite.
   *
   * O código é uma credencial estável: uma vez emitido, é reutilizado nas
   * leituras seguintes (`getOrIssueQrCode`). Isso é essencial para o fluxo do
   * convidado — ele salva o QR Code no celular e o apresenta no evento; se cada
   * leitura gerasse um código novo, o código salvo deixaria de funcionar.
   *
   * A regeneração existe como ação explícita (`regenerateQrCode`) para quando o
   * convidado perde o acesso ou o código precisa ser invalidado.
   */
  async issueQrCode(
    invitationId: string,
    eventSlug: string,
  ): Promise<{ code: string; issuedAt: Date; prefix: string }> {
    const code = generateInvitationCode(qrPrefixFromSlug(eventSlug));
    const issuedAt = new Date();

    await prisma.invitation.update({
      where: { id: invitationId },
      data: {
        qrCodeValue: code,
        qrCodeHash: hashToken(code),
        qrCodePrefix: code,
        qrCodeIssuedAt: issuedAt,
        qrRevokedAt: null,
      },
    });

    return { code, issuedAt, prefix: code };
  },

  /**
   * Retorna o QR Code do convite de forma ESTÁVEL.
   *
   * Se já existe um código emitido e válido, devolve o mesmo valor — assim o
   * QR Code que o convidado salvou continua funcionando. Só emite um novo
   * quando ainda não houver nenhum.
   */
  async getOrIssueQrCode(
    invitationId: string,
    eventSlug: string,
  ): Promise<{ code: string | null; issuedAt: Date | null; prefix: string | null }> {
    const invitation = await prisma.invitation.findUnique({
      where: { id: invitationId },
      select: {
        qrCodeValue: true,
        qrCodePrefix: true,
        qrCodeIssuedAt: true,
        qrRevokedAt: true,
        status: true,
      },
    });

    if (!invitation) return { code: null, issuedAt: null, prefix: null };

    if (invitation.status === 'DECLINED' || invitation.status === 'CANCELLED') {
      return { code: null, issuedAt: null, prefix: null };
    }

    // Código existente e não revogado: reutiliza (credencial estável).
    if (invitation.qrCodeValue && !invitation.qrRevokedAt) {
      return {
        code: invitation.qrCodeValue,
        issuedAt: invitation.qrCodeIssuedAt,
        prefix: invitation.qrCodePrefix,
      };
    }

    const issued = await this.issueQrCode(invitationId, eventSlug);
    return { code: issued.code, issuedAt: issued.issuedAt, prefix: issued.prefix };
  },

  /**
   * Regenera o QR Code intencionalmente (perda de acesso ou revogação de
   * segurança). O código anterior deixa de funcionar imediatamente.
   */
  async regenerateQrCode(invitationId: string, eventSlug: string) {
    return this.issueQrCode(invitationId, eventSlug);
  },

  /** Cancela o convite (ação administrativa). */
  async cancel(invitationId: string, reason?: string) {
    return prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledReason: reason ?? null,
        qrRevokedAt: new Date(),
        qrCodeHash: null,
        qrCodeValue: null,
        qrCodePrefix: null,
      },
    });
  },

  /** Reabre um convite cancelado/recusado para permitir novo RSVP. */
  async reopen(invitationId: string) {
    return prisma.invitation.update({
      where: { id: invitationId },
      data: {
        status: 'PENDING',
        cancelledAt: null,
        cancelledReason: null,
        respondedAt: null,
        qrCodeHash: null,
        qrCodeValue: null,
        qrCodePrefix: null,
        qrCodeIssuedAt: null,
        qrRevokedAt: new Date(),
      },
    });
  },

  /** Marca o envio do convite (e-mail/WhatsApp/link). */
  async markSent(invitationId: string, via: string) {
    return prisma.invitation.update({
      where: { id: invitationId },
      data: { sentAt: new Date(), sentVia: via },
    });
  },

  /** Reemissão do token do convite (quando o link vazou). */
  async rotateToken(invitationId: string): Promise<{ token: string; link: string }> {
    const token = generateInvitationToken();
    await prisma.invitation.update({
      where: { id: invitationId },
      data: { tokenHash: hashToken(token), tokenPrefix: tokenPrefix(token, 8) },
    });
    return { token, link: buildInviteLink(token) };
  },

  /** Contagem de status por evento (usada no dashboard). */
  async statusCounts(eventId: string) {
    const grouped = await prisma.invitation.groupBy({
      by: ['status'],
      where: { guest: { eventId } },
      _count: { _all: true },
    });

    const counters = {
      total: 0,
      pending: 0,
      confirmed: 0,
      declined: 0,
      checkedIn: 0,
      cancelled: 0,
    };

    for (const row of grouped) {
      const count = row._count._all;
      counters.total += count;
      if (row.status === 'PENDING') counters.pending = count;
      if (row.status === 'CONFIRMED') counters.confirmed = count;
      if (row.status === 'DECLINED') counters.declined = count;
      if (row.status === 'CHECKED_IN') counters.checkedIn = count;
      if (row.status === 'CANCELLED') counters.cancelled = count;
    }

    return counters;
  },
};
