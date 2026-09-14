import type { FastifyInstance } from 'fastify';
import { env } from '../config/env.js';
import { authController } from '../controllers/auth.controller.js';
import { eventController } from '../controllers/event.controller.js';
import { guestController } from '../controllers/guest.controller.js';
import { invitationController } from '../controllers/invitation.controller.js';
import { checkInController } from '../controllers/checkin.controller.js';
import { publicController } from '../controllers/public.controller.js';

/**
 * Registro de todas as rotas da API.
 *
 * Convenções:
 *  - Rotas administrativas exigem autenticação e passam pelo guard de
 *    permissões (`authorize`) e/ou pelo `assertEventAccess` no controller.
 *  - Rotas públicas (`/public/*`) usam o token do convite como autorização.
 *  - O rate limit específico é aplicado por rota onde faz sentido.
 */
export async function registerRoutes(app: FastifyInstance): Promise<void> {
  const p = env.API_PREFIX;

  // -------------------------------------------------------------------------
  // Health & metadados
  // -------------------------------------------------------------------------
  app.get(`${p}/health`, async () => ({
    status: 'ok',
    service: 'celebrai-api',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  }));

  app.get(`${p}/meta`, async () => ({
    channels: {
      email: env.MAIL_DRIVER !== 'disabled',
      whatsapp: env.WHATSAPP_DRIVER !== 'disabled',
    },
    appUrl: env.APP_URL,
  }));

  // -------------------------------------------------------------------------
  // Autenticação
  // -------------------------------------------------------------------------
  app.register(
    async (auth) => {
      auth.post('/login', authController.login);
      auth.post('/refresh', authController.refresh);
      auth.post('/logout', authController.logout);

      auth.get('/me', { preHandler: [app.authenticate] }, authController.me);
      auth.get('/users', { preHandler: [app.authenticate] }, authController.listUsers);
      auth.post('/users', { preHandler: [app.authenticate] }, authController.createUser);
    },
    { prefix: `${p}/auth` },
  );

  // -------------------------------------------------------------------------
  // Rotas públicas (área do convidado)
  // -------------------------------------------------------------------------
  app.register(
    async (publicRoutes) => {
      publicRoutes.get('/invitations/:token', publicController.getInvitation);
      publicRoutes.get('/invitations/:token/status', publicController.status);
      publicRoutes.get('/invitations/:token/qrcode', publicController.getQrCode);

      // RSVP tem limite próprio para evitar abuso automatizado.
      publicRoutes.post(
        '/invitations/:token/rsvp',
        {
          config: {
            rateLimit: {
              max: 20,
              timeWindow: '1 minute',
            },
          },
        },
        publicController.confirm,
      );

      publicRoutes.post(
        '/invitations/:token/decline',
        {
          config: {
            rateLimit: {
              max: 20,
              timeWindow: '1 minute',
            },
          },
        },
        publicController.decline,
      );
    },
    { prefix: `${p}/public` },
  );

  // -------------------------------------------------------------------------
  // Eventos e sub-recursos (administrativo)
  // -------------------------------------------------------------------------
  app.register(
    async (events) => {
      events.addHook('preHandler', app.authenticate);

      events.get('/', eventController.list);
      events.post('/', { preHandler: [app.authorize('event:create')] }, eventController.create);

      events.get('/:id', eventController.get);
      events.patch('/:id', { preHandler: [app.authorize('event:update')] }, eventController.update);
      events.delete('/:id', { preHandler: [app.authorize('event:delete')] }, eventController.remove);

      events.put(
        '/:id/venue',
        { preHandler: [app.authorize('venue:update')] },
        eventController.upsertVenue,
      );

      events.get('/:id/dashboard', eventController.dashboard);
      events.get('/:id/audit', { preHandler: [app.authorize('audit:read')] }, eventController.audit);

      // -------- Convidados --------
      events.get('/:eventId/guests', guestController.list);
      events.post(
        '/:eventId/guests',
        { preHandler: [app.authorize('guest:create')] },
        guestController.create,
      );
      events.post(
        '/:eventId/guests/import',
        { preHandler: [app.authorize('guest:import')] },
        guestController.import,
      );
      events.get(
        '/:eventId/guests/export',
        { preHandler: [app.authorize('export:data')] },
        guestController.export,
      );
      events.get('/:eventId/guests/:id', guestController.get);
      events.patch(
        '/:eventId/guests/:id',
        { preHandler: [app.authorize('guest:update')] },
        guestController.update,
      );
      events.delete(
        '/:eventId/guests/:id',
        { preHandler: [app.authorize('guest:delete')] },
        guestController.remove,
      );

      // -------- Convites --------
      events.get('/:eventId/invitations', invitationController.list);
      events.post(
        '/:eventId/invitations/send',
        { preHandler: [app.authorize('invitation:send')] },
        invitationController.send,
      );
      events.get(
        '/:eventId/invitations/:id/link',
        { preHandler: [app.authorize('invitation:send')] },
        invitationController.reissueLink,
      );
      events.get('/:eventId/invitations/:id/qrcode', invitationController.issueQrCode);
      events.get(
        '/:eventId/invitations/:id/share-text',
        { preHandler: [app.authorize('invitation:send')] },
        invitationController.shareText,
      );
      events.post(
        '/:eventId/invitations/:id/cancel',
        { preHandler: [app.authorize('invitation:cancel')] },
        invitationController.cancel,
      );
      events.post(
        '/:eventId/invitations/:id/reopen',
        { preHandler: [app.authorize('invitation:cancel')] },
        invitationController.reopen,
      );

      // -------- Check-in --------
      events.get('/:eventId/check-in/stats', checkInController.stats);
      events.get('/:eventId/check-in/search', checkInController.search);
      events.post(
        '/:eventId/check-in/validate',
        {
          preHandler: [app.authorize('checkin:perform')],
          config: {
            rateLimit: {
              max: env.CHECKIN_RATE_LIMIT_MAX,
              timeWindow: '1 minute',
            },
          },
        },
        checkInController.validate,
      );
    },
    { prefix: `${p}/events` },
  );

  // -------------------------------------------------------------------------
  // Portaria (fora de um evento específico)
  // -------------------------------------------------------------------------
  app.register(
    async (checkIn) => {
      checkIn.addHook('preHandler', app.authenticate);
      checkIn.get('/events', checkInController.myEvents);
    },
    { prefix: `${p}/check-in` },
  );
}
