import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from '../packages/api/src/app.js';

let appPromise: ReturnType<typeof buildServer> | undefined;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const app = await (appPromise ??= buildServer());

    await app.ready();

    app.server.emit('request', req, res);
  } catch (error) {
    console.error('Erro ao iniciar API:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Erro interno do servidor.',
      },
    });
  }
}
