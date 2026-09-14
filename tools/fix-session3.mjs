import { readFileSync, writeFileSync } from 'node:fs';

const file = 'packages/api/src/services/session.service.ts';
const lines = readFileSync(file, 'utf8').split('\n');

const idx = lines.findIndex((l) => l.includes('revokedAt:') && l.includes('not: null'));
if (idx === -1) {
  console.error('linha nao encontrada');
  process.exit(1);
}

// Constroi com uma lista de tokens para evitar erros de digitacao.
const tokens = [
  '      where: { OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { not: null }',
  '}',
  ' ",
  ']',
  ' },',
];

// Reconstrucao explicita:
const target = tokens.join('');

lines[idx] = target;
writeFileSync(file, lines.join('\n'), 'utf8');
console.log('->', target);
