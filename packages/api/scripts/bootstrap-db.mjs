#!/usr/bin/env node
/**
 * Celebrai — bootstrap do Prisma Client após `npm install`.
 *
 * PROBLEMA QUE ISTO RESOLVE
 * -------------------------
 * O schema de produção (`prisma/schema.prisma`) tem `provider = "postgresql"`
 * fixo. O Prisma gera o Client no `postinstall` a partir desse schema — mesmo
 * quando o desenvolvedor está rodando em SQLite.
 *
 * Resultado: Client gerado para PostgreSQL + `DATABASE_URL=file:./dev.db`, e
 * TODA consulta falha em runtime com:
 *
 *   Error validating datasource `db`:
 *   the URL must start with the protocol `postgresql://`
 *
 * Como o handler global mascara esse erro em `500 INTERNAL_ERROR`, o sintoma
 * aparece como "login não funciona" — foi exatamente a causa raiz do primeiro
 * bug investigado neste projeto.
 *
 * ESTRATÉGIA
 * ----------
 * Regenerar o Client a partir do schema do provider que o `.env` declara:
 *   - `.env` com DATABASE_PROVIDER=sqlite     → usa `schema.dev.prisma`
 *   - `.env` com DATABASE_PROVIDER=postgresql → usa `schema.prisma`
 *   - sem `.env` (ex.: build na Vercel)       → não faz nada; o Client do
 *     provider de produção já é o correto.
 *
 * Este script NUNCA falha o `npm install`: em ambiente de CI/Vercel ele
 * apenas sai com sucesso.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');
const envFile = resolve(apiRoot, '.env');
const sqliteSchema = resolve(apiRoot, 'prisma', 'schema.dev.prisma');

/** Lê uma chave do `.env` sem depender de dotenv. */
function readEnvKey(key) {
  if (!existsSync(envFile)) return null;
  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(envFile, 'utf8'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : null;
}

const provider = readEnvKey('DATABASE_PROVIDER');

// Sem `.env` → contexto de build (Vercel/CI): o Client de produção já serve.
if (!provider) {
  console.log('[celebrai] bootstrap-db: sem .env — mantendo o schema de produção.');
  process.exit(0);
}

if (provider === 'postgresql') {
  console.log('[celebrai] bootstrap-db: provider=postgresql — schema de produção.');
  process.exit(0);
}

if (provider !== 'sqlite') {
  console.warn(`[celebrai] bootstrap-db: provider desconhecido "${provider}" — nada a fazer.`);
  process.exit(0);
}

if (!existsSync(sqliteSchema)) {
  console.warn(
    '[celebrai] bootstrap-db: DATABASE_PROVIDER=sqlite mas schema.dev.prisma não existe.\n' +
    '          Rode: node scripts/set-provider.mjs sqlite',
  );
  process.exit(0);
}

console.log('[celebrai] bootstrap-db: provider=sqlite — regenerando o Client…');

// `npx` pode não existir em PATH neste ambiente; invocamos o Prisma direto.
const prismaBin = resolve(apiRoot, '..', '..', 'node_modules', 'prisma', 'build', 'index.js');

if (!existsSync(prismaBin)) {
  console.warn('[celebrai] bootstrap-db: Prisma não encontrado — pulando a geração.');
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [prismaBin, 'generate', '--schema', 'prisma/schema.dev.prisma'],
  { cwd: apiRoot, stdio: 'inherit' },
);

if (result.status !== 0) {
  // Não derruba o install: um build de produção não deve falhar por causa do
  // banco de desenvolvimento local.
  console.warn('[celebrai] bootstrap-db: falha ao gerar o Client SQLite. Rode manualmente:');
  console.warn('          node scripts/set-provider.mjs sqlite && npx prisma generate --schema prisma/schema.dev.prisma');
  process.exit(0);
}

console.log('[celebrai] bootstrap-db: Client SQLite pronto.');
