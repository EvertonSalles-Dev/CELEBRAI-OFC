import { readFileSync, writeFileSync } from 'node:fs';

const O = String.fromCharCode(123);
const C = String.fromCharCode(125);

const file = 'packages/api/src/controllers/invitation.controller.ts';
const lines = readFileSync(file, 'utf8').split('\n');

// Nova linha 76, montada por partes (evita erro de digitacao das chaves):
//   ...(query.search ? { fullName: { contains: query.search, mode: 'insensitive' } : {}),
const newLine =
  '            ...(query.search ? ' +
  O +
  ' fullName: ' +
  O +
  " contains: query.search, mode: 'insensitive' " +
  C +
  ' +
C +
  O +
  ' : ' +
  O +
  C +
  '),';

lines[75] = newLine;

// Separa hasQrCode de qrCodePrefix (linha 106 na versao antiga).
const badIdx = lines.findIndex((l) => l.includes('hasQrCode: Boolean(invitation.qrCodePrefix'));
if (badIdx !== -1) {
  lines[badIdx] = '          hasQrCode: Boolean(invitation.qrCodePrefix),';
  if (!lines[badIdx + 1].includes('qrCodePrefix:')) {
    lines.splice(badIdx + 1, 0, '          qrCodePrefix: invitation.qrCodePrefix,');
  }
}

writeFileSync(file, lines.join('\n'), 'utf8');
console.log('line76:', JSON.stringify(lines[75]));
console.log('badIdx:', badIdx + 1);
