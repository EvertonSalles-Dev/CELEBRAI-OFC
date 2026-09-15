#!/usr/bin/env node
/**
 * Verificação ponta a ponta dos fluxos principais do Celebrai.
 * Usa o proxy do Vite (http://localhost:5173) quando disponível, senão a API direta.
 *
 * Uso: node packages/api/scripts/smoke-e2e.mjs
 */
const WEB = process.env.WEB_URL ?? 'http://localhost:5173';
const API_DIRETA = process.env.API_URL ?? 'http://localhost:3333';

/**
 * Descobre a base que responde pelo proxy do front. Testar pelo proxy é o que
 * importa, porque é exatamente o caminho que o navegador usa (mesmo origin).
 */
async function escolherBase() {
  try {
    const r = await fetch(`${WEB}/api/health`);
    if (r.ok) return { base: WEB, rotulo: `proxy Vite (${WEB})` };
  } catch {
    /* proxy indisponível */
  }
  return { base: API_DIRETA, rotulo: `API direta (${API_DIRETA})` };
}

let falhas = 0;
const resultados = [];

function checar(nome, condicao, detalhe) {
  const ok = Boolean(condicao);
  if (!ok) falhas += 1;
  resultados.push({ ok, nome, detalhe });
  console.log(`${ok ? '✓' : '✗'} ${nome.padEnd(46)} ${detalhe ?? ''}`);
}

const { base, rotulo } = await escolherBase();
console.log(`\nBase: ${rotulo}\n${'─'.repeat(78)}`);

// --------------------------------------------------------------------------
// 1. Health & meta
// --------------------------------------------------------------------------
const health = await fetch(`${base}/api/health`).then((r) => r.json());
checar('GET /api/health', health.status === 'ok', `service=${health.service} env=${health.environment}`);

const meta = await fetch(`${base}/api/meta`).then((r) => r.json());
checar('GET /api/meta', meta.appUrl !== undefined, `appUrl=${meta.appUrl}`);

// --------------------------------------------------------------------------
// 2. Login + sessão
// --------------------------------------------------------------------------
const loginRes = await fetch(`${base}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@celebrai.app', password: 'Admin@12345' }),
});
const login = await loginRes.json();
const token = login.data?.accessToken;
const setCookie = loginRes.headers.get('set-cookie') ?? '';
checar('POST /api/auth/login (ADMIN)', loginRes.status === 200 && Boolean(token), `role=${login.data?.user?.role}`);
checar('Cookie de refresh httpOnly', setCookie.includes('HttpOnly') && setCookie.includes('celebrai_refresh'));

const auth = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const me = await fetch(`${base}/api/auth/me`, { headers: auth }).then((r) => r.json());
checar('GET /api/auth/me', me.data?.email === 'admin@celebrai.app', `${me.data?.email} [${me.data?.role}]`);

// Sem token deve ser 401 — confere que o guard está protegendo a rota.
const semToken = await fetch(`${base}/api/auth/me`);
checar('GET /api/auth/me sem token → 401', semToken.status === 401, `status=${semToken.status}`);

// --------------------------------------------------------------------------
// 3. Eventos
// --------------------------------------------------------------------------
const eventos = await fetch(`${base}/api/events`, { headers: auth }).then((r) => r.json());
const evento = eventos.data?.[0];
checar('GET /api/events', eventos.data?.length >= 1, `${eventos.data?.length} evento(s)`);
checar('Evento do seed presente', evento?.title?.includes('João'), `"${evento?.title}"`);

const detalhe = await fetch(`${base}/api/events/${evento.id}`, { headers: auth }).then((r) => r.json());
checar('GET /api/events/:id', detalhe.data?.id === evento.id, `venue=${detalhe.data?.venue?.name ?? 'n/a'}`);

const dash = await fetch(`${base}/api/events/${evento.id}/dashboard`, { headers: auth }).then((r) => r.json());
checar('GET /api/events/:id/dashboard', dash.data !== undefined, JSON.stringify(dash.data)?.slice(0, 90));

// --------------------------------------------------------------------------
// 4. Convidados e convites (dados do seed)
// --------------------------------------------------------------------------
const convidados = await fetch(`${base}/api/events/${evento.id}/guests`, { headers: auth }).then((r) => r.json());
checar('GET .../guests', convidados.data?.length >= 1, `${convidados.data?.length} convidado(s): ${convidados.data?.[0]?.fullName}`);

const convites = await fetch(`${base}/api/events/${evento.id}/invitations`, { headers: auth }).then((r) => r.json());
const convite = convites.data?.[0] ?? convites.data?.items?.[0];
checar('GET .../invitations', Boolean(convite), `status=${convite?.status}`);

// --------------------------------------------------------------------------
// 5. Check-in (leitura do QR de um convite confirmado)
// --------------------------------------------------------------------------
const confirmado = (convites.data ?? []).find((c) => c.status === 'CONFIRMED') ?? convite;
if (confirmado?.id) {
  const qr = await fetch(`${base}/api/events/${evento.id}/invitations/${confirmado.id}/qrcode`, { headers: auth });
  const qrBody = await qr.json().catch(() => ({}));
  checar('GET .../invitations/:id/qrcode', qr.status === 200, `code=${qrBody.data?.code ?? qrBody.data?.prefix ?? 'n/a'}`);
}

const stats = await fetch(`${base}/api/events/${evento.id}/check-in/stats`, { headers: auth }).then((r) => r.json());
checar('GET .../check-in/stats', stats.data !== undefined, JSON.stringify(stats.data)?.slice(0, 90));

// --------------------------------------------------------------------------
// 6. Área pública do convidado (token do convite)
// --------------------------------------------------------------------------
// Reemite o link de um convite para obter o token em claro e testar o fluxo
// público. O endpoint devolve `{ link }` — o token é o último segmento da URL
// (`/convite/:token`), nunca um campo separado.
if (confirmado?.id) {
  const linkRes = await fetch(`${base}/api/events/${evento.id}/invitations/${confirmado.id}/link`, { headers: auth });
  const link = await linkRes.json().catch(() => ({}));
  const tokenConvite = link.data?.link?.split('/').filter(Boolean).pop();

  checar(
    'GET .../invitations/:id/link',
    linkRes.status === 200 && Boolean(tokenConvite),
    `convidado=${link.data?.guestName ?? 'n/a'}`,
  );

  if (tokenConvite) {
    const pub = await fetch(`${base}/api/public/invitations/${tokenConvite}`).then((r) => r.json());
    checar(
      'GET /api/public/invitations/:token',
      Boolean(pub.data),
      `convidado=${pub.data?.guest?.fullName ?? pub.data?.event?.title ?? 'n/a'}`,
    );
  }
}

// --------------------------------------------------------------------------
// 7. Casos de erro
// --------------------------------------------------------------------------
const naoEncontrado = await fetch(`${base}/api/events/inexistente-123`, { headers: auth });
checar('Rota autenticada inexistente → 404/400', naoEncontrado.status < 500, `status=${naoEncontrado.status}`);

const rotaInexistente = await fetch(`${base}/api/nao-existe`);
checar('Rota inexistente → 404', rotaInexistente.status === 404, `status=${rotaInexistente.status}`);

// --------------------------------------------------------------------------
// Resumo
// --------------------------------------------------------------------------
console.log(`${'─'.repeat(78)}`);
console.log(`${resultados.filter((r) => r.ok).length}/${resultados.length} verificações passaram.`);
if (falhas > 0) {
  console.error(`\n❌ ${falhas} verificação(ões) falharam.`);
  process.exit(1);
}
console.log('\n🎉 Sistema funcionando ponta a ponta.');
