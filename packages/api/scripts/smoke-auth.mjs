#!/usr/bin/env node
/**
 * Verificação do fluxo de autenticação (smoke test do login).
 * Sobe expectativas contra a API já em execução em API_URL.
 *
 * Uso: node packages/api/scripts/smoke-auth.mjs
 */
const API = process.env.API_URL ?? 'http://localhost:3333';

const cases = [
  { email: 'admin@celebrai.app', password: 'Admin@12345', expect: 200, label: 'ADMIN' },
  { email: 'super@celebrai.app', password: 'SuperAdmin@123', expect: 200, label: 'SUPER_ADMIN' },
  { email: 'recepcao@celebrai.app', password: 'Recepcao@123', expect: 200, label: 'RECEPTIONIST' },
  { email: 'admin@celebrai.app', password: 'senha-errada', expect: 401, label: 'senha inválida' },
  { email: 'naoexiste@celebrai.app', password: 'Qualquer@123', expect: 401, label: 'e-mail inexistente' },
];

let failures = 0;

for (const testCase of cases) {
  const response = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: testCase.email, password: testCase.password }),
  });

  const body = await response.json().catch(() => ({}));
  const cookie = response.headers.get('set-cookie') ?? '';
  const ok = response.status === testCase.expect;
  if (!ok) failures += 1;

  const detail =
    response.status === 200
      ? `role=${body.data?.user?.role} hasToken=${Boolean(body.data?.accessToken)} httpOnlyCookie=${cookie.includes('HttpOnly')}`
      : `code=${body.error?.code} msg="${body.error?.message}"`;

  console.log(`${ok ? '✓' : '✗'} ${testCase.label.padEnd(18)} ${response.status} (esperado ${testCase.expect}) ${detail}`);
}

console.log('');
if (failures > 0) {
  console.error(`❌ ${failures} caso(s) falharam.`);
  process.exit(1);
}
console.log('🎉 Fluxo de login OK.');
