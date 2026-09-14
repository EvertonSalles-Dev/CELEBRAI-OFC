import type { FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { AppError, ValidationError } from './errors.js';

/**
 * Envelope padrão de resposta da API.
 *   sucesso → { data, meta? }
 *   erro    → { error: { code, message, details? } }
 */
export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
  [key: string]: unknown;
}

export function ok<T>(reply: FastifyReply, data: T, meta?: ApiMeta, status = 200): FastifyReply {
  return reply.status(status).send(meta ? { data, meta } : { data });
}

export function created<T>(reply: FastifyReply, data: T, meta?: ApiMeta): FastifyReply {
  return ok(reply, data, meta, 201);
}

export function noContent(reply: FastifyReply): FastifyReply {
  return reply.status(204).send();
}

export function fail(
  reply: FastifyReply,
  message: string,
  status = 400,
  code = 'BAD_REQUEST',
  details?: unknown,
): FastifyReply {
  return reply.status(status).send({ error: { code, message, details } });
}

/** Converte qualquer exceção em uma resposta de erro consistente. */
export function handleError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ZodError) {
    return fail(
      reply,
      'Dados inválidos',
      422,
      'VALIDATION_ERROR',
      error.issues.map((issue) => ({
        field: issue.path.join('.') || undefined,
        message: issue.message,
      })),
    );
  }

  if (error instanceof ValidationError) {
    return fail(reply, error.message, error.statusCode, error.code, error.details);
  }

  if (error instanceof AppError) {
    return fail(reply, error.message, error.statusCode, error.code, error.details);
  }

  // Erros não previstos: loga no servidor, resposta genérica ao cliente.
  // eslint-disable-next-line no-console
  console.error('[celebrai] Erro não tratado:', error);
  return fail(reply, 'Erro interno do servidor', 500, 'INTERNAL_ERROR');
}

/** Paginação a partir de page/perPage. */
export function toSkipTake(page: number, perPage: number): { skip: number; take: number } {
  return { skip: (page - 1) * perPage, take: perPage };
}

export function paginationMeta(page: number, perPage: number, total: number): ApiMeta {
  return { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) };
}
