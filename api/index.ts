import type { VercelRequest, VercelResponse } from '@vercel/node';
import { buildServer } from '../packages/api/src/app.js';

/**
 * Entrypoint da API na Vercel.
 *
 * A instância do Fastify é criada UMA vez por container e reaproveitada entre
 * invocações (`appPromise`) — recriar a cada request desperdiça o pool de
 * conexões do Prisma e provoca cold start em toda chamada.
 *
 * O roteamento chega aqui via `rewrites` do vercel.json: `/api/(.*)` → esta
 * função. Sem esse rewrite o Vercel serviria `/index.html` (arquivo estático)
 * e um POST receberia 405 Method Not Allowed.
 */
let appPromise: Promise<Awaited<ReturnType<typeof buildServer>>> | undefined;

/** Constrói (ou reutiliza) a instância do Fastify já pronta para uso. */
function getApp() {
  appPromise ??= buildServer().then(async (app) => {
    await app.ready();
    return app;
  });
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();

    // `app.server` é o servidor HTTP do Node; emitir `request` entrega o par
    // req/res do Vercel direto ao roteador do Fastify (padrão recomendado para
    // ambientes serverless — ver guia "Serverless" do Fastify).
    app.server.emit('request', req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    // eslint-disable-next-line no-console
    console.error('[celebrai] Falha ao inicializar/atender na Vercel:', message, stack);

    // Se o erro veio da validação de ambiente, expor a causa real é essencial
    // para diagnosticar (variável faltando no painel da Vercel).
    const isEnvError = message.includes('[celebrai]');

    if (!res.headersSent) {
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: isEnvError ? message : 'Erro interno do servidor.',
        },
      });
    }
  }
}