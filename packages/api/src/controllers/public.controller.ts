import type { FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { handleError, ok } from '../shared/http.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../shared/errors.js';
import { declineSchema, rsvpSchema } from '../schemas/index.js';
import { invitationService } from '../services/invitation.service.js';
import { recordAudit } from '../services/audit.service.js';
import { hashCpf, maskCpf } from '../shared/brazil.js';
import { daysUntil, isRsvpExpired } from '../shared/datetime.js';
import { fromStringListField, toJsonField } from '../shared/db-compat.js';
import { logNotification } from '../services/notification.service.js';
import { logger } from '../config/logger.js';

/**
 * Rotas PÚBLICAS da área do convidado.
 *
 * Nenhuma rota aqui exige login: o acesso é autorizado pelo próprio token do
 * convite (link exclusivo). Por isso:
 *  - a resposta NUNCA inclui dados sensíveis (CPF completo, outros convidados,
 *    listas do evento);
 *  - confirmações e recusas são registradas com IP/user-agent para auditoria;
 *  - o token não permite enumerar convidados: só existe um por link.
 */

/** Projeção pública do evento exibida no convite. */
function publicEvent(event: {
  id: string;
  title: string;
  hostsName: string | null;
  coupleNameA: string | null;
  coupleNameB: string | null;
  coverImageUrl: string | null;
  galleryImages: unknown;
  welcomeMessage: string | null;
  inviteMessage: string | null;
  couplesMessage: string | null;
  dressCode: string | null;
  giftListUrl: string | null;
  giftListNotes: string | null;
  ceremonyInfo: string | null;
  receptionInfo: string | null;
  eventDate: Date;
  startTime: string;
  endTime: string | null;
  rsvpDeadline: Date | null;
  allowCompanions: boolean;
  allowShareInvite: boolean;
  venue: {
    name: string;
    type: string | null;
    address: string;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string;
    state: string;
    zipCode: string | null;
    country: string;
    referencePoint: string | null;
    googleMapsUrl: string | null;
    wazeUrl: string | null;
    latitude: number | null;
    longitude: number | null;
    parkingInfo: string | null;
    extraInfo: string | null;
  } | null;
}) {
  return {
    id: event.id,
    title: event.title,
    hostsName: event.hostsName,
    coupleNameA: event.coupleNameA,
    coupleNameB: event.coupleNameB,
    coverImageUrl: event.coverImageUrl,
    galleryImages: fromStringListField(event.galleryImages),
    welcomeMessage: event.welcomeMessage,
    inviteMessage: event.inviteMessage,
    couplesMessage: event.couplesMessage,
    dressCode: event.dressCode,
    giftListUrl: event.giftListUrl,
    giftListNotes: event.giftListNotes,
    ceremonyInfo: event.ceremonyInfo,
    receptionInfo: event.receptionInfo,
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    rsvpDeadline: event.rsvpDeadline,
    allowCompanions: event.allowCompanions,
    allowShareInvite: event.allowShareInvite,
    daysUntil: daysUntil(event.eventDate),
    venue: event.venue,
    // A chave do Maps é opcional; sem ela o embed é omitido no front.
    mapsApiKey: env.GOOGLE_MAPS_API_KEY ?? null,
  };
}

/** Dados que o convidado pode ver sobre o próprio convite. */
function publicInvitation(invitation: {
  id: string;
  status: string;
  qrCodePrefix: string | null;
  respondedAt: Date | null;
  guest: { id: string; fullName: string; allowedCompanions: number };
  response: {
    fullName: string;
    cpfMasked: string | null;
    email: string | null;
    phone: string | null;
    attendingCount: number;
    companions: unknown;
    message: string | null;
    createdAt: Date;
  } | null;
}) {
  return {
    id: invitation.id,
    status: invitation.status,
    hasQrCode: Boolean(invitation.qrCodePrefix),
    respondedAt: invitation.respondedAt,
    guest: {
      id: invitation.guest.id,
      // O convidado vê o próprio nome completo (é o titular do convite).
      fullName: invitation.guest.fullName,
      allowedCompanions: invitation.guest.allowedCompanions,
    },
    response: invitation.response
      ? {
        fullName: invitation.response.fullName,
        // LGPD: apenas a máscara é retornada.
        cpfMasked: invitation.response.cpfMasked,
        email: invitation.response.email,
        phone: invitation.response.phone,
        attendingCount: invitation.response.attendingCount,
        companions: parseCompanions(invitation.response.companions),
        message: invitation.response.message,
        respondedAt: invitation.response.createdAt,
      }
      : null,
  };
}

function parseCompanions(value: unknown): Array<{ name: string; document?: string }> {
  if (!value) return [];
  if (Array.isArray(value)) return value as Array<{ name: string; document?: string }>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export const publicController = {
  /**
   * GET /public/invitations/:token
   * Carrega o convite. Não expõe CPF nem qualquer dado de terceiros.
   */
  async getInvitation(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.params as { token: string };

      const invitation = await invitationService.findByToken(token);
      if (!invitation) {
        return reply.status(404).send({
          error: {
            code: 'INVITATION_NOT_FOUND',
            message: 'Convite não encontrado ou link inválido.',
          },
        });
      }

      const guest = invitation.guest as unknown as {
        id: string;
        fullName: string;
        allowedCompanions: number;
        event: Parameters<typeof publicEvent>[0];
      };

      return ok(reply, {
        invitation: publicInvitation(invitation as never),
        event: publicEvent(guest.event),
        rsvpOpen: !isRsvpExpired(guest.event.rsvpDeadline) && invitation.status !== 'CANCELLED',
      });
    } catch (error) {
      return handleError(reply, error);
    }
  },

  /**
   * POST /public/invitations/:token/rsvp
   * Confirma presença. Valida CPF, telefone e o limite de acompanhantes.
   */
  async confirm(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.params as { token: string };
      const body = rsvpSchema.parse(request.body);

      const invitation = await invitationService.findByToken(token);
      if (!invitation) throw new NotFoundError('Convite não encontrado.');

      const guest = invitation.guest as unknown as {
        id: string;
        fullName: string;
        allowedCompanions: number;
        event: Parameters<typeof publicEvent>[0] & { slug: string };
      };

      // Regras de estado.
      if (invitation.status === 'CANCELLED') {
        throw new ForbiddenError('Este convite foi cancelado pelo organizador.');
      }

      if (isRsvpExpired(guest.event.rsvpDeadline)) {
        throw new ValidationError('O prazo para confirmação de presença expirou.');
      }

      // Limite de acompanhantes: nunca permite ultrapassar o autorizado.
      if (body.attendingCount > guest.allowedCompanions) {
        throw new ValidationError(
          `Você possui autorização para até ${guest.allowedCompanions} ${guest.allowedCompanions === 1 ? 'pessoa' : 'pessoas'
          }.`,
        );
      }

      // Acompanhantes nomeados não podem exceder attendingCount - 1.
      if (body.companions.length > body.attendingCount - 1) {
        throw new ValidationError(
          'A quantidade de acompanhantes informada é maior que o total de pessoas confirmadas.',
        );
      }

      // Impede confirmação duplicada inconsistente.
      if (invitation.status === 'CHECKED_IN') {
        throw new ConflictError(
          'Este convite já realizou check-in e não pode ser alterado no momento.',
        );
      }

      const cpfHashValue = hashCpf(body.cpf, env.INVITATION_TOKEN_SECRET);
      const cpfMaskedValue = maskCpf(body.cpf);

      const result = await prisma.$transaction(async (tx) => {
        // Registro de consentimento LGPD.
        await tx.dataConsent.create({
          data: {
            invitationId: invitation.id,
            guestId: guest.id,
            purpose: 'rsvp',
            granted: true,
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        const response = await tx.invitationResponse.upsert({
          where: { invitationId: invitation.id },
          create: {
            invitationId: invitation.id,
            fullName: body.fullName,
            cpfHash: cpfHashValue,
            cpfMasked: cpfMaskedValue,
            email: body.email,
            phone: body.phone,
            attendingCount: body.attendingCount,
            companions: toJsonField(body.companions ?? []) as never,
            message: body.message ?? null,
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
          update: {
            fullName: body.fullName,
            cpfHash: cpfHashValue,
            cpfMasked: cpfMaskedValue,
            email: body.email,
            phone: body.phone,
            attendingCount: body.attendingCount,
            companions: toJsonField(body.companions ?? []) as never,
            message: body.message ?? null,
            ip: request.ip,
            userAgent: request.headers['user-agent'] ?? null,
          },
        });

        const updated = await tx.invitation.update({
          where: { id: invitation.id },
          data: { status: 'CONFIRMED', respondedAt: new Date() },
        });

        return { response, invitation: updated };
      });

      // Emite o QR Code logo após a confirmação.
      const qr = await invitationService.issueQrCode(
        invitation.id,
        guest.event.slug ?? 'EVENT',
      );

      await recordAudit({
        action: 'rsvp.confirmed',
        eventId: guest.event.id,
        actorName: body.fullName,
        entity: 'Invitation',
        entityId: invitation.id,
        description: `Convidado "${body.fullName}" confirmou presença (${body.attendingCount} pessoa(s))`,
        metadata: { attendingCount: body.attendingCount, companions: body.companions.length },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      logger.info(`RSVP confirmado: ${body.fullName} (${body.attendingCount} pessoas)`);

      return ok(reply, {
        status: result.invitation.status,
        response: publicInvitation({
          ...invitation,
          status: result.invitation.status,
          respondedAt: result.invitation.respondedAt,
          qrCodePrefix: qr.prefix,
          response: result.response,
        } as never),
        qrCode: qr.code,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  },

  /**
   * POST /public/invitations/:token/decline
   * Registra que o convidado não poderá comparecer.
   */
  async decline(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.params as { token: string };
      const body = declineSchema.parse(request.body);

      const invitation = await invitationService.findByToken(token);
      if (!invitation) throw new NotFoundError('Convite não encontrado.');

      const guest = invitation.guest as unknown as {
        id: string;
        event: { id: string };
      };

      if (invitation.status === 'CANCELLED') {
        throw new ForbiddenError('Este convite foi cancelado pelo organizador.');
      }

      if (invitation.status === 'CHECKED_IN') {
        throw new ConflictError('Não é possível alterar a resposta após o check-in.');
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          status: 'DECLINED',
          respondedAt: new Date(),
          // Declínio invalida qualquer QR Code emitido anteriormente.
          qrCodeHash: null,
          qrCodePrefix: null,
          qrRevokedAt: new Date(),
        },
      });

      await recordAudit({
        action: 'rsvp.declined',
        eventId: guest.event.id,
        actorName: invitation.guest.fullName,
        entity: 'Invitation',
        entityId: invitation.id,
        description: `Convidado "${invitation.guest.fullName}" informou que não poderá comparecer`,
        metadata: { reason: body.reason ?? null },
        ip: request.ip,
        userAgent: request.headers['user-agent'] ?? null,
      });

      // Avisa o organizador (registro em notifications; envio real opcional).
      await logNotification({
        channel: 'EMAIL',
        eventId: guest.event.id,
        guestId: guest.id,
        invitationId: invitation.id,
        to: null,
        subject: `Recusa de presença: ${invitation.guest.fullName}`,
        body: body.reason ?? 'O convidado informou que não poderá comparecer.',
        provider: 'internal',
        status: 'SENT',
      });

      return ok(reply, { status: 'DECLINED' });
    } catch (error) {
      return handleError(reply, error);
    }
  },

  /**
   * GET /public/invitations/:token/qrcode
   * Exibe o QR Code após a confirmação. Reemite o código se necessário.
   */
  async getQrCode(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.params as { token: string };

      const invitation = await invitationService.findByToken(token);
      if (!invitation) throw new NotFoundError('Convite não encontrado.');

      const guest = invitation.guest as unknown as {
        id: string;
        fullName: string;
        allowedCompanions: number;
        event: Parameters<typeof publicEvent>[0] & { slug: string };
      };

      if (invitation.status === 'CANCELLED') {
        throw new ForbiddenError('Este convite foi cancelado pelo organizador.');
      }

      if (invitation.status !== 'CONFIRMED' && invitation.status !== 'CHECKED_IN') {
        throw new ValidationError('O QR Code é liberado após a confirmação de presença.');
      }

      // Credencial estável: devolve o mesmo código já emitido.
      const qr = await invitationService.getOrIssueQrCode(
        invitation.id,
        guest.event.slug ?? 'EVENT',
      );

      return ok(reply, {
        code: qr.code,
        issuedAt: qr.issuedAt,
        guest: {
          name: guest.fullName,
          allowedCompanions: guest.allowedCompanions,
          attendingCount: invitation.response?.attendingCount ?? null,
        },
        event: {
          title: guest.event.hostsName ?? guest.event.title,
          date: guest.event.eventDate,
          startTime: guest.event.startTime,
          venue: guest.event.venue
            ? {
              name: guest.event.venue.name,
              address: guest.event.venue.address,
              number: guest.event.venue.number,
              city: guest.event.venue.city,
              state: guest.event.venue.state,
            }
            : null,
        },
        alreadyCheckedIn: invitation.status === 'CHECKED_IN',
        lastCheckInAt: invitation.checkIns[0]?.createdAt ?? null,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  },

  /**
   * GET /public/invitations/:token/status
   * Leve, usada para polling do status (check-in em tempo real no convite).
   */
  async status(request: FastifyRequest, reply: FastifyReply) {
    try {
      const { token } = request.params as { token: string };

      const invitation = await invitationService.findByToken(token);
      if (!invitation) throw new NotFoundError('Convite não encontrado.');

      return ok(reply, {
        status: invitation.status,
        checkedInAt: invitation.checkIns[0]?.createdAt ?? null,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  },
};
