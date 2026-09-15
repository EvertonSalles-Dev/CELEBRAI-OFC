import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from '../packages/api/src/app.js';

let appPromise: ReturnType<typeof buildServer> | undefined;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    console.log('[API] 1 - Iniciando handler');

    console.log('[API] 2 - Chamando buildServer()');
    const app = await (appPromise ??= buildServer());
    console.log('[API] 3 - buildServer() concluído');

    console.log('[API] 4 - Chamando app.ready()');
    await app.ready();
    console.log('[API] 5 - app.ready() concluído');

    console.log('[API] 6 - Enviando request para Fastify');
    app.server.emit('request', req, res);
    console.log('[API] 7 - Request enviado');
  } catch (error) {
    console.error('[API] ERRO FATAL:', error);

    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const stack =
      error instanceof Error
        ? error.stack
        : undefined;

    console.error('[API] MESSAGE:', message);
    console.error('[API] STACK:', stack);

    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
        debug: message,
      },
    });
  }
}