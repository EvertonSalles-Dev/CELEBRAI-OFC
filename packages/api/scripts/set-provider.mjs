#!/usr/bin/env node
/**
 * Celebrai — gerador de schema para desenvolvimento local.
 *
 * O schema de PRODUÇÃO é PostgreSQL (`prisma/schema.prisma`) e usa recursos que
 * só existem nesse banco: enums, arrays (`String[]`) e `Json`.
 *
 * Para permitir rodar o projeto em máquinas sem Docker/Postgres, este script
 * gera `prisma/schema.dev.prisma` a partir do schema de produção, traduzindo os
 * tipos que o SQLite não suporta:
 *   - `enum`            → `String`
 *   - `String[]`        → `String` (JSON serializado)
 *   - `Json`            → `String`
 *
 * O schema de produção NUNCA é modificado.
 *
 * Uso:
 *   node scripts/set-provider.mjs sqlite       # gera schema.dev.prisma
 *   node scripts/set-provider.mjs postgresql   # remove o arquivo de dev
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const prismaDir = resolve(__dirname, '..', 'prisma');
const sourceSchema = resolve(prismaDir, 'schema.prisma');
const devSchema = resolve(prismaDir, 'schema.dev.prisma');

const provider = (process.argv[2] || 'postgresql').toLowerCase();
if (!['postgresql', 'sqlite'].includes(provider)) {
  console.error(`Provider inválido: ${provider}. Use 'postgresql' ou 'sqlite'.`);
  process.exit(1);
}

if (provider === 'postgresql') {
  if (existsSync(devSchema)) {
    rmSync(devSchema);
    console.log('[celebrai] schema.dev.prisma removido — usando PostgreSQL.');
  } else {
    console.log('[celebrai] Nada a fazer — o schema de produção já é PostgreSQL.');
  }
  process.exit(0);
}

let schema = readFileSync(sourceSchema, 'utf8');

// 1) Remove os blocos `enum` do SQLite e coleta os nomes para virar String.
const enumNames = [];
schema = schema.replace(/enum\s+(\w+)\s*\{[\s\S]*?\n\}/g, (_match, name) => {
  enumNames.push(name);
  return `// enum ${name} → String (SQLite)`;
});

// 2) Substitui os usos dos enums por String (respeitando limites de palavra).
for (const name of enumNames) {
  schema = schema.replace(new RegExp(`\\b${name}\\b`, 'g'), 'String');
}

// 3) Tipos que o SQLite não suporta.
schema = schema
  .replace(/\bString\[\]/g, 'String?')
  .replace(/\bJson\?/g, 'String?')
  .replace(/\bJson\b/g, 'String');

// 3b) Valores padrão de campos que eram enum precisam virar string.
//     Ex.: `@default(QR_CODE)` -> `@default("QR_CODE")`
const defaultValues = [
  'ADMIN',
  'SUPER_ADMIN',
  'RECEPTIONIST',
  'ACTIVE',
  'SUSPENDED',
  'PENDING',
  'CONFIRMED',
  'DECLINED',
  'CHECKED_IN',
  'CANCELLED',
  'DRAFT',
  'PUBLISHED',
  'FINISHED',
  'QR_CODE',
  'MANUAL',
  'EMAIL',
  'WHATSAPP',
  'SMS',
  'LINK',
  'QUEUED',
  'SENT',
  'FAILED',
];

for (const value of defaultValues) {
  schema = schema.replace(
    new RegExp(`@default\\(${value}\\)`, 'g'),
    `@default("${value}")`,
  );
}

// 4) Ajusta o datasource e o output do client de dev.
schema = schema
  .replace(/provider = "postgresql"/, 'provider = "sqlite"')
  .replace(/generator client \{\n\s+provider = "prisma-client-js"\n\}/, 'generator client {\n  provider = "prisma-client-js"\n  binaryTargets = ["native"]\n}');

writeFileSync(devSchema, schema, 'utf8');
console.log('[celebrai] schema.dev.prisma gerado (SQLite).');
console.log(`          Enums convertidos em String: ${enumNames.join(', ')}`);
