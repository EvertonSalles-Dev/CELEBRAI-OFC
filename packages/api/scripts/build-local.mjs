#!/usr/bin/env node
/**
 * Celebrai — build da API para desenvolvimento local, com restauração de estado.
 *
 * POR QUE ESTE SCRIPT EXISTE
 * --------------------------
 * `npm run build` (da API) roda `prisma generate` com o schema de PRODUÇÃO
 * (PostgreSQL). Isso é correto para a Vercel, mas em máquina de desenvolvimento
 * com SQLite ele deixa o projeto num estado quebrado:
 *
 *   Client = PostgreSQL   +   DATABASE_URL = file:./dev.db
 *
 * Toda consulta passa a falhar com
 *   "the URL must start with the protocol `postgresql://`"
 * e, como o handler global mascara o erro em 500, o sintoma visível é
 * "não consigo fazer login".
 *
 * Este script faz o build e, ao final, regenera o Client com o provider que o
 * `.env` declara — devolvendo o ambiente exatamente como estava.
 *
 * PROBLEMA SECUNDÁRIO: LOCK DO ENGINE NO WINDOWS
 * ----------------------------------------------
 * Se a API estiver rodando (`npm run dev`), o processo mantém
 * `query_engine-windows.dll.node` carregado e o Windows recusa substituí-lo:
 *
 *   EPERM: operation not permitted, rename '...dll.node.tmp1234' -> '...dll.node'
 *
 * Aqui detectamos isso ANTES e avisamos com clareza, em vez de falhar no meio.
 *
 * Uso:
 *   npm run build:local          # build + restaura o provider do .env
 *   npm run build:local --skip-restore
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { createConnection } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(__dirname, '..');
const repoRoot = resolve(apiRoot, '..', '..');
const envFile = resolve(apiRoot, '.env');
const sqliteSchema = resolve(apiRoot, 'prisma', 'schema.dev.prisma');
const prismaBin = resolve(repoRoot, 'node_modules', 'prisma', 'build', 'index.js');

/**
 * `npm run build:local --skip-restore` não repassa a flag como argumento: o npm
 * a consome. Por isso também aceitamos a variável de ambiente, que é a forma
 * confiável de passar a opção.
 *
 *   npm run build:local                          → build + restaura
 *   $env:SKIP_RESTORE=1; npm run build:local      → build sem restaurar
 */
const skipRestore =
  process.argv.includes('--skip-restore') ||
  ['1', 'true', 'yes'].includes(String(process.env.SKIP_RESTORE ?? '').toLowerCase());

/** Executa um comando herdando stdio; devolve o exit code. */
function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: 'inherit' });
  return result.status ?? 1;
}

/** Lê uma chave do `.env` sem depender de dotenv. */
function readEnvKey(key) {
  if (!existsSync(envFile)) return null;
  const match = new RegExp(`^${key}=(.*)$`, 'm').exec(readFileSync(envFile, 'utf8'));
  return match ? match[1].trim().replace(/^"|"$/g, '') : null;
}

/**
 * Verifica se algo está escutando na porta informada. Usado para avisar sobre o
 * lock do engine antes de o `prisma generate` falhar com um EPERM críptico.
 */
function isPortBusy(port) {
  return new Promise((resolvePromise) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    const done = (busy) => {
      socket.removeAllListeners();
      socket.destroy();
      resolvePromise(busy);
    };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
  });
}

// ---------------------------------------------------------------------------
// 0. Pré-checagem: a API rodando trava o engine do Prisma no Windows.
// ---------------------------------------------------------------------------
const apiPort = Number(readEnvKey('PORT') ?? 3333);
let apiRunning = false;

try {
  apiRunning = await isPortBusy(apiPort);
} catch {
  apiRunning = false;
}

if (apiRunning) {
  console.log('');
  console.log('⚠️  A API parece estar rodando na porta ' + apiPort + '.');
  console.log('   No Windows isso trava o engine do Prisma e o build falha com:');
  console.log('     EPERM: operation not permitted, rename ...query_engine-windows.dll.node');
  console.log('');
  console.log('   Pare o servidor primeiro (Ctrl+C no terminal do `npm run dev`) e');
  console.log('   rode novamente. Se precisar forçar, em outro terminal:');
  console.log('');
  console.log(`     Get-NetTCPConnection -LocalPort ${apiPort} -State Listen |`);
  console.log('       Select-Object -ExpandProperty OwningProcess -Unique |');
  console.log('       ForEach-Object { Stop-Process -Id $_ -Force }');
  console.log('');

  if (!process.env.CELEBRAI_FORCE_BUILD) {
    console.log('   (para tentar mesmo assim: $env:CELEBRAI_FORCE_BUILD=1)');
    process.exit(1);
  }
  console.log('   CELEBRAI_FORCE_BUILD definido — tentando o build mesmo assim.');
  console.log('');
}

// ---------------------------------------------------------------------------
// 1. Build (Client de produção + compilação do TypeScript)
// ---------------------------------------------------------------------------
console.log('[celebrai] build:local — gerando Client de produção e compilando…');

const buildCode = run(process.execPath, [prismaBin, 'generate', '--schema', 'prisma/schema.prisma'], apiRoot);
if (buildCode !== 0) {
  console.error('[celebrai] build:local — falha ao gerar o Prisma Client.');
  process.exit(buildCode);
}

const tscBin = resolve(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const tscCode = run(process.execPath, [tscBin, '-p', 'tsconfig.build.json'], apiRoot);
if (tscCode !== 0) {
  console.error('[celebrai] build:local — falha na compilação do TypeScript.');
  // Mesmo com erro, restauramos o provider para não deixar o ambiente quebrado.
  await restoreLocalProvider({ silent: false });
  process.exit(tscCode);
}

console.log('[celebrai] build:local — build concluído.');

// ---------------------------------------------------------------------------
// 2. Restauração do provider local
// ---------------------------------------------------------------------------
if (skipRestore) {
  console.log('[celebrai] build:local — restauração ignorada (--skip-restore).');
  console.log('   ATENÇÃO: o Client está em modo PostgreSQL. Rode `npm run bootstrap:db`');
  console.log('   antes de iniciar a API em SQLite, ou o login vai falhar com 500.');
  process.exit(0);
}

await restoreLocalProvider({ silent: false });

/**
 * Regenera o Client conforme o provider do `.env`. No-op em PostgreSQL ou
 * quando não há `.env` (contexto de CI/Vercel).
 */
async function restoreLocalProvider({ silent }) {
  const provider = readEnvKey('DATABASE_PROVIDER');

  if (provider !== 'sqlite') {
    if (!silent) {
      console.log(
        `[celebrai] build:local — provider "${provider ?? 'ausente'}" não é SQLite; nada a restaurar.`,
      );
    }
    return;
  }

  if (!existsSync(sqliteSchema)) {
    console.warn('[celebrai] build:local — schema.dev.prisma ausente; rode `npm run set-provider:sqlite`.');
    return;
  }

  if (!silent) console.log('[celebrai] build:local — restaurando o Client SQLite local…');

  const code = run(process.execPath, [prismaBin, 'generate', '--schema', 'prisma/schema.dev.prisma'], apiRoot);

  if (code !== 0) {
    console.warn('[celebrai] build:local — falha ao restaurar o Client SQLite.');
    console.warn('   Rode manualmente: npm run bootstrap:db');
    return;
  }

  if (!silent) {
    console.log('[celebrai] build:local — Client SQLite restaurado. Ambiente pronto para `npm run dev`.');
  }
}
