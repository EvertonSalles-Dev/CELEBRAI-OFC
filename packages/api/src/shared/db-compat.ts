import { env } from '../config/env.js';

/**
 * Compatibilidade de tipos entre PostgreSQL (produção) e SQLite (dev local).
 *
 * O schema de produção usa tipos nativos que o SQLite não suporta:
 *   - `String[]`  → armazenado como texto JSON em dev
 *   - `Json`      → armazenado como texto JSON em dev
 *
 * Estes helpers centralizam a conversão para que o código de domínio não
 * precise saber qual banco está por trás.
 */

export const isSqlite = env.DATABASE_PROVIDER === 'sqlite';

/**
 * Normaliza um valor destinado a um campo `Json` do Prisma.
 * Em SQLite devolve string (JSON serializado); em Postgres devolve o objeto.
 */
export function toJsonField(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (!isSqlite) return value;
  return JSON.stringify(value);
}

/**
 * Normaliza um valor destinado a um campo `String[]`.
 * Em SQLite devolve string JSON; em Postgres devolve o array.
 */
export function toStringListField(values: string[] | null | undefined): unknown {
  if (!values) return isSqlite ? null : [];
  if (!isSqlite) return values;
  return JSON.stringify(values);
}

/**
 * Lê um campo `Json` do banco, independentemente do provider.
 * Aceita objeto (Postgres), string JSON (SQLite) ou nulo.
 */
export function fromJsonField<T = unknown>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** Lê um campo `String[]` do banco, independentemente do provider. */
export function fromStringListField(value: unknown): string[] {
  const parsed = fromJsonField<string[]>(value, []);
  return Array.isArray(parsed) ? parsed : [];
}
