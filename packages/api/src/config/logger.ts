import { isDev, isTest } from '../config/env.js';

type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN: Level = isDev ? 'debug' : 'info';

function shouldLog(level: Level): boolean {
  return ORDER[level] >= ORDER[MIN];
}

function stamp(): string {
  return new Date().toISOString();
}

function emit(level: Level, msg: string, meta?: unknown): void {
  if (isTest) return;
  if (!shouldLog(level)) return;

  const prefix = `[${stamp()}] ${level.toUpperCase().padEnd(5)}`;
  // eslint-disable-next-line no-console
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;

  if (meta === undefined) sink(`${prefix} ${msg}`);
  else sink(`${prefix} ${msg}`, meta);
}

/**
 * Logger estruturado mínimo. Pode ser trocado por pino/winston em produção
 * sem alterar os pontos de chamada.
 */
export const logger = {
  debug: (msg: string, meta?: unknown) => emit('debug', msg, meta),
  info: (msg: string, meta?: unknown) => emit('info', msg, meta),
  warn: (msg: string, meta?: unknown) => emit('warn', msg, meta),
  error: (msg: string, meta?: unknown) => emit('error', msg, meta),
  /** Log de eventos de segurança/auditoria com destaque. */
  security: (msg: string, meta?: unknown) => emit('warn', `🔐 ${msg}`, meta),
};
