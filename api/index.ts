import type { VercelRequest, VercelResponse } from '@vercel/node';
import type { buildServer } from '../packages/api/src/app.js';

/**
 * O `import()` dinâmico é obrigatório aqui.
 *
 * `api/` é compilado como CommonJS pela Vercel (o `package.json` da raiz não
 * declara `"type": "module"`), enquanto `packages/api` é ESM. Um `import`
 * estático de `../packages/api/dist/app.js` vira `require('...app.js')` e falha
 * com `ERR_REQUIRE_ESM`, porque `require()` não consegue carregar um módulo ES.
 *
 * A forma dinâmica funciona nos dois formatos e é resolvida em runtime.
 *
 * O caminho aponta para `dist/` (JS já compilado) e não para `src/`: o build
 * da Vercel roda `tsc` do workspace da API antes de empacotar a função, então
 * não dependemos de a Vercel transpilar TS de outro workspace por conta própria.
 */
const loadApp = () =>
  import('../packages/api/dist/app.js') as Promise<{ buildServer: typeof buildServer }>;

/**
 * Entrypoint da API na Vercel.
 *
 * A instância do Fastify é criada UMA vez por container e reaproveitada entre
 * invocações (`appPromise`) — recriar a cada request desperdiça o pool de
 * conexões do Prisma e provoca cold start em toda chamada.
 *
 * O roteamento chega aqui via `rewrites` do vercel.json: `/api/:path*` → esta
 * função (declarada ANTES do fallback da SPA). Sem essa ordem o Vercel serviria
 * `/index.html` (arquivo estático) e um POST receberia 405 Method Not Allowed.
 */
let appPromise: Promise<Awaited<ReturnType<typeof buildServer>>> | undefined;

/**
 * Reconstrói a URL original que o Fastify espera.
 *
 * O `rewrite` do vercel.json aponta `/api/:path*` para esta função. Com a
 * sintaxe de parâmetro nomeado, a Vercel entrega o trecho capturado como query
 * string (`?path=auth/login`), então `req.url` pode chegar como `/api/index`
 * em vez de `/api/auth/login`. O Fastify registra as rotas JÁ com o prefixo
 * `/api` (ver `registerRoutes`), então precisa enxergar o caminho completo.
 *
 * Se a Vercel já entregar o caminho original (`/api/auth/login`, comportamento
 * padrão para functions), não existe o parâmetro `path` e a função não altera
 * nada — é seguro chamá-la sempre.
 */
function restoreOriginalPath(req: VercelRequest): void {
  const prefix = '/api';
  const rawUrl = req.url ?? '';

  const [, search = ''] = rawUrl.split('?');
  const params = new URLSearchParams(search);
  const captured = params.get('path');

  // Sem `path` capturado, a URL já veio no formato original esperado pelo
  // Fastify (`/api/...`) e não há nada a corrigir.
  if (!captured) return;

  params.delete('path');

  const restored = `${prefix}/${captured.replace(/^\/+/, '')}`;

  // Preserva a query string original da chamada, se houver.
  const rest = params.toString();

  req.url = rest ? `${restored}?${rest}` : restored;
}

/** Constrói (ou reutiliza) a instância do Fastify já pronta para uso. */
function getApp() {
  appPromise ??= loadApp().then(async ({ buildServer }) => {
    const app = await buildServer();
    await app.ready();
    return app;
  });
  return appPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const app = await getApp();

    restoreOriginalPath(req);

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