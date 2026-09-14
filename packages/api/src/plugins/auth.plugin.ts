import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { ForbiddenError, UnauthorizedError } from '../shared/errors.js';
import { prisma } from '../config/prisma.js';
import type { Permission } from '../config/permissions.js';
import { can } from '../config/permissions.js';

/**
 * Plugin de autenticação.
 *
 * Registra @fastify/jwt + @fastify/cookie e expõe decorators:
 *  - `request.user`           → payload do access token
 *  - `app.authenticate`       → guard de rota autenticada
 *  - `app.authorize(perm)`    → guard por permissão do papel
 *  - `app.assertEventAccess`  → garante que o usuário acessa apenas eventos
 *    aos quais pertence (ADMIN dono ou RECEPTIONIST membro).
 */

export interface AccessTokenPayload {
  sub: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST';
  name: string;
  email: string;
  typ: 'access';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authorize: (permission: Permission) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    assertEventAccess: (
      user: AccessTokenPayload,
      eventId: string,
    ) => Promise<{ ownerId: string }>;
  }
}

export default fp(
  async (app) => {
    await app.register(fastifyCookie, { secret: env.JWT_ACCESS_SECRET });

    // @fastify/jwt v8: apenas `secret` + `verify` no registro.
    await app.register(fastifyJwt, {
      secret: env.JWT_ACCESS_SECRET,
      verify: {
        allowedIss: 'celebrai',
        allowedAud: 'celebrai-app',
      },
    });

    app.decorate('authenticate', async (request: FastifyRequest) => {
      try {
        await request.jwtVerify();
      } catch {
        throw new UnauthorizedError('Sessão expirada ou inválida. Faça login novamente.');
      }

      if (request.user?.typ !== 'access') {
        throw new UnauthorizedError('Token inválido para esta operação.');
      }
    });

    app.decorate(
      'authorize',
      (permission: Permission) => async (request: FastifyRequest) => {
        await app.authenticate(request, {} as FastifyReply);
        const role = request.user.role;
        if (!can(role, permission)) {
          throw new ForbiddenError('Seu perfil não possui permissão para esta ação.');
        }
      },
    );

    /**
     * Verifica se o usuário pode acessar o evento.
     * SUPER_ADMIN enxerga tudo; ADMIN precisa ser o dono; RECEPTIONIST precisa
     * estar vinculado via EventMember.
     */
    app.decorate(
      'assertEventAccess',
      async (user: AccessTokenPayload, eventId: string) => {
        const event = await prisma.event.findUnique({
          where: { id: eventId },
          select: { id: true, ownerId: true },
        });

        if (!event) throw new UnauthorizedError('Evento não encontrado.');

        if (user.role === 'SUPER_ADMIN') return { ownerId: event.ownerId };

        if (user.role === 'ADMIN') {
          if (event.ownerId !== user.sub) {
            throw new ForbiddenError('Você não tem acesso a este evento.');
          }
          return { ownerId: event.ownerId };
        }

        // RECEPTIONIST
        const membership = await prisma.eventMember.findUnique({
          where: { eventId_userId: { eventId, userId: user.sub } },
          select: { id: true },
        });

        if (!membership) {
          throw new ForbiddenError('Você não está vinculado a este evento.');
        }

        return { ownerId: event.ownerId };
      },
    );
  },
  { name: 'auth-plugin' },
);
