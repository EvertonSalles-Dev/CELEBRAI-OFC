/**
 * Servidor estático mínimo para validar o build de produção do Celebrai Web.
 *
 * - Serve `dist/` com fallback SPA (rotas do React Router funcionam no refresh).
 * - Faz proxy de `/api` para a API local, replicando o que o Nginx/Docker faz.
 *
 * Uso: node tools/static-server.mjs [porta]
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = Number(process.argv[2] ?? 4173);
const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:3333';
const ROOT = process.env.STATIC_ROOT ?? 'packages/web/dist';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

/** Encaminha /api/* para o backend mantendo método, headers e corpo. */
async function proxyApi(req, res) {
  const target = new URL(req.url, API_TARGET);

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;

  const forwardedHeaders = { ...req.headers };
  delete forwardedHeaders.host;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: forwardedHeaders,
      body,
      redirect: 'manual',
    });

    const responseHeaders = {};
    upstream.headers.forEach((value, key) => {
      // `set-cookie` precisa ser preservado individualmente.
      if (key.toLowerCase() === 'set-cookie') return;
      responseHeaders[key] = value;
    });

    const cookies = upstream.headers.getSetCookie?.() ?? [];
    res.writeHead(upstream.status, {
      ...responseHeaders,
      ...(cookies.length > 0 ? { 'set-cookie': cookies } : {}),
    });

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.end(buffer);
  } catch (error) {
    res.writeHead(502, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        error: { code: 'BAD_GATEWAY', message: `API indisponível: ${error.message}` },
      }),
    );
  }
}

const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/api/')) {
    await proxyApi(req, res);
    return;
  }

  // Resolve o arquivo pedido, protegendo contra path traversal.
  const url = (req.url ?? '/').split('?')[0];
  const safePath = normalize(url).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, safePath);

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch {
    // Arquivo não existe: cai no fallback SPA abaixo.
    filePath = join(ROOT, 'index.html');
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'content-type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'cache-control': extname(filePath) === '.html' ? 'no-cache' : 'public, max-age=31536000',
    });
    res.end(content);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[celebrai] Frontend servido em http://127.0.0.1:${PORT}`);
  console.log(`[celebrai] Proxy /api -> ${API_TARGET}`);
});
