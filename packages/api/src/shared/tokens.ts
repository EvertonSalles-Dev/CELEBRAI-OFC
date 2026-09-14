import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

/**
 * Geração e verificação de tokens criptograficamente seguros.
 *
 * Regras aplicadas em todo o sistema:
 *  - O token público (link do convite) NUNCA é persistido em claro;
 *    guardamos apenas o SHA-256. Assim, um vazamento de banco não permite
 *    forjar convites.
 *  - O QR Code usa um identificador curto e legível, também persistido
 *    apenas como hash. O banco relaciona o código ao convidado.
 *  - Comparações de hash usam `timingSafeEqual` quando aplicável.
 */

const TOKEN_BYTES = 24; // 192 bits de entropia → base64url ~32 chars

/** Token de convite opaco (link /convite/:token). */
export function generateInvitationToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

/** Hash determinístico de tokens para lookup no banco. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** HMAC usado quando queremos "pepper" adicional do servidor. */
export function hmacToken(token: string): string {
  return createHmac('sha256', env.INVITATION_TOKEN_SECRET).update(token).digest('hex');
}

const CRC_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sem I, O, 0, 1

/** Gera um bloco aleatório legível (sem caracteres ambíguos). */
function randomBlock(length: number): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CRC_ALPHABET[bytes[i]! % CRC_ALPHABET.length];
  }
  return out;
}

/**
 * Gera o código do QR Code no formato `CELEBRAI-XXXXXXXX-XXXX`.
 * É apenas um identificador: não contém CPF nem qualquer dado pessoal.
 */
export function generateInvitationCode(eventSlugPrefix = 'EVENT'): string {
  const prefix = eventSlugPrefix
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'EVENT';
  return `${prefix}-${randomBlock(8)}-${randomBlock(4)}`;
}

/** Prefixo exibível de um token (auditoria/UI) sem revelar o segredo. */
export function tokenPrefix(token: string, size = 8): string {
  return token.slice(0, size);
}

/** Comparação em tempo constante entre dois hashes hex. */
export function safeCompareHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

/** Slug URL-friendly para eventos. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/** Slug único com sufixo aleatório curto. */
export function uniqueSlug(input: string): string {
  return `${slugify(input) || 'evento'}-${randomBlock(5).toLowerCase()}`;
}
