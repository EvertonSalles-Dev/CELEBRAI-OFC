import { readFileSync, writeFileSync } from 'node:fs';

const O = String.fromCharCode(123);
const C = String.fromCharCode(125);

const file = 'packages/api/src/controllers/invitation.controller.ts';
const lines = readFileSync(file, 'utf8').split('\n');

// Linha 76 (1-based): reconstruir corretamente.
//   ...(query.search ? { fullName: { contains: query.search, mode: 'insensitive' } : {}),
lines[75] =
  "            ...(query.search ? " +
  O +
  " fullName: " +
  O +
  " contains: query.search, mode: 'insensitive' " +
  C +
  " +
C +
  " : " +
  O +
  C +
  "),";

// Linha 106 (1-based): separar a propriedade duplicada.
lines[105] = '          hasQrCode: Boolean(invitation.qrCodePrefix),';
lines.splice(106, 0, '          qrCodePrefix: invitation.qrCodePrefix,');

writeFileSync(file, lines.join('\n'), 'utf8');
console.log('76 ->', JSON.stringify(lines[75]));
console.log('106 ->', JSON.stringify(lines[105]));
console.log('107 ->', JSON.stringify(lines[106]));
