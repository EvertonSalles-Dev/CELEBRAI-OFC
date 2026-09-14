/**
 * Auditoria de classes Tailwind dependentes de uma classe base.
 *
 * Verifica pares que só funcionam juntos:
 *   flex-*      → exige `flex` no mesmo elemento
 *   grid-*      → exige `grid`
 *   divide-*    → exige `divide-x`/`divide-y` (não reportado)
 *
 * Uso: node tools/audit-classes.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const QUOTE = String.fromCharCode(34);
const CLASS_RE = new RegExp(`${'className'}=${QUOTE}([^${QUOTE}]*)${QUOTE}`, 'g');

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx|ts)$/.test(full)) out.push(full);
  }
  return out;
}

const files = walk('packages/web/src');
const problems = [];

for (const file of files) {
  const source = readFileSync(file, 'utf8');

  for (const match of source.matchAll(CLASS_RE)) {
    const tokens = match[1].split(/\s+/).filter(Boolean);
    const line = source.slice(0, match.index).split('\n').length;

    const hidden = tokens.some((t) => t === 'hidden' || /^(sm|md|lg|xl):flex$/.test(t));

    // `flex-wrap`, `flex-col`, `flex-1`, `items-*`, `justify-*` exigem `flex`.
    const needsFlex =
      tokens.includes('flex-wrap') ||
      tokens.includes('flex-col') ||
      tokens.includes('flex-row') ||
      tokens.some((t) => /^(items|justify|content)-/.test(t));

    if (needsFlex && !tokens.includes('flex') && !hidden && !tokens.includes('inline-flex') && !tokens.includes('grid')) {
      problems.push({ file, line, classes: match[1] });
    }

    // `grid-cols-*` / `col-span-*` exigem `grid`.
    const needsGrid = tokens.some((t) => /^grid-cols-/.test(t));
    if (needsGrid && !tokens.includes('grid') && !hidden) {
      problems.push({ file, line, classes: match[1], kind: 'grid' });
    }
  }
}

if (problems.length === 0) {
  console.log('Nenhum problema de classe base encontrado.');
} else {
  console.log(`Encontrados ${problems.length} problema(s):\n`);
  for (const problem of problems) {
    console.log(`${problem.file}:${problem.line}`);
    console.log(`   ${problem.classes}`);
  }
}
