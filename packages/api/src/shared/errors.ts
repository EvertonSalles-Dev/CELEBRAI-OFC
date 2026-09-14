/**
 * Erros de domínio da aplicação.
 *
 * O handler global converte estas classes em respostas JSON consistentes,
 * sem vazar detalhes internos.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(
    message: string,
    statusCode = 400,
    code = 'BAD_REQUEST',
    details?: unknown,
    expose = true,
  ) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
    Error.captureStackTrace?.(this, new.target);
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Requisição inválida', details?: unknown) {
    super(message, 400, 'BAD_REQUEST', details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Dados inválidos', details?: unknown) {
    super(message, 422, 'VALIDATION_ERROR', details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(message, 403, 'FORBIDDEN');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso não encontrado') {
    super(message, 404, 'NOT_FOUND');
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflito de dados', details?: unknown) {
    super(message, 409, 'CONFLICT', details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(message = 'Muitas requisições. Tente novamente em instantes.') {
    super(message, 429, 'TOO_MANY_REQUESTS');
  }
}

export class InternalError extends AppError {
  constructor(message = 'Erro interno do servidor') {
    super(message, 500, 'INTERNAL_ERROR', undefined, false);
  }
}
