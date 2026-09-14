import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';

/**
 * Hash de senha com bcrypt.
 *
 * O projeto-alvo suporta Argon2; mantemos bcrypt (via bcryptjs, sem
 * dependência nativa) para que rode em qualquer ambiente. A interface é
 * agnóstica — trocar por Argon2 exige mudar apenas este arquivo.
 */

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/**
 * Força mínima de senha verificada também no domínio (além do Zod).
 * Evita que senhas triviais cheguem ao banco caso o schema mude.
 */
export function isWeakPassword(plain: string): boolean {
  if (plain.length < 8) return true;
  if (!/[A-Za-z]/.test(plain)) return true;
  if (!/\d/.test(plain)) return true;
  const common = ['12345678', 'senha123', 'password', 'celebrai', 'admin123'];
  return common.includes(plain.toLowerCase());
}
