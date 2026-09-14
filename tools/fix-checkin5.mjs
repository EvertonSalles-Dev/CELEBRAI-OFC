
,import { readFileSync, writeFileSync } from 'node:fs';

const file = 'packages/api/src/controllers/checkin.controller.ts';
const lines = readFileSync(file, 'utf8').split('\n');

// Remove as linhas `},`/`});` duplicadas em 440-441 e 481-482.
// Conteudo atual (1-based):
//   439: "... include: { invitation: { include: { ... },"
//   440: "      },"
//   441: "      });"
// Correto:
//   439: "... include: { invitation: { include: { ... },"  (fecha checkIns)
//   440: "      },"                                            (fecha invitation e include)
//   441: "      });"
// Simplificacao: 440 deve fechar invitation + include.
const O = String.fromCharCode(123);
const C = String.fromCharCode(125);

const fixed = lines.map((line, i) => {
  if (i === 439 || i === 480) {
    // linha que contem o include inline: garante que termina com "},"
    return line;
  }
  if (i === 439 - 0 && false) return line;
  return line;
});

// Estrategia direta: substituir blocos inteiros.
const build = (closing) => [
  closing,
  '      });',
];

const out = [
  ...lines.slice(0, 438),
  lines[438].replace(/,\s*$/, ',') + ' + C + ', ',
  '      ' + C + ' + C + ', ',
  '      });',
  ...lines.slice(441),
];

writeFileSync(file, out.join('\n'), 'utf8');
console.log('ok');
