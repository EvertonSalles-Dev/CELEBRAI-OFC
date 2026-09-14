import { readFileSync, writeFileSync } from 'node:fs';

const O = String.fromCharCode(123); // {
const C = String.fromCharCode(125); // }
const Q = String.fromCharCode(39); // '

const file = 'packages/api/src/controllers/invitation.controller.ts';
const lines = readFileSync(file, 'utf8').split('\n');

const s1 = '            ...(query.search ? ';
const s2 = ' fullName: ';
const s3 = ' contains: query.search, mode: ' + Q + 'insensitive' + Q + ' ';
const s4 = ' : ';

// ...(query.search ? { fullName: { contains: ..., mode: 'insensitive' } : {}),
lines[75] = s1 + O + s2 + O + s3 + C + ' + C + s4 + O + C + '), ';

const badIdx = lines.findIndex((l) => l.includes('hasQrCode: Boolean(invitation.qrCodePrefix'));
if (badIdx !== -1) {
  lines[badIdx] = '          hasQrCode: Boolean(invitation.qrCodePrefix),';
  if (!lines[badIdx + 1].includes('qrCodePrefix:')) {
    lines.splice(badIdx + 1, 0, '          qrCodePrefix: invitation.qrCodePrefix,');
  }
}

writeFileSync(file, lines.join('\n'), 'utf8');
console.log('line76:', JSON.stringify(lines[75]));
