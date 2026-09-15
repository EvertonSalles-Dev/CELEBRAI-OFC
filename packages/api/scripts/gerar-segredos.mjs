#!/usr/bin/env node
/**
 * Celebrai — gera os segredos de produção para colar na Vercel.
 *
 * Produz valores aleatórios de 48 bytes (base64url) para as três variáveis que
 * o servidor recusa aceitar com o valor padrão do .env.example.
 *
 * Uso: node scripts/gerar-segredos.mjs
 */
import { randomBytes } from 'node:crypto';

const segredo = () => randomBytes(48).toString('base64url');

console.log('');
console.log('Cole estas variáveis no painel da Vercel');
console.log('(Project Settings → Environment Variables → Production):');
console.log('');
console.log(`JWT_ACCESS_SECRET=${segredo()}`);
console.log('');
console.log(`JWT_REFRESH_SECRET=${segredo()}`);
console.log('');
console.log(`INVITATION_TOKEN_SECRET=${segredo()}`);
console.log('');
console.log('Cada execução gera valores NOVOS — não rode de novo se já configurou,');
console.log('ou os tokens emitidos antes deixam de valer.');
