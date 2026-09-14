import { PrismaClient } from '@prisma/client';
import { env, isDev } from '../config/env.js';

/**
 * Instância única (singleton) do Prisma Client.
 *
 * - Em desenvolvimento o client é recriado a cada hot-reload via `globalThis`,
 *   evitando esgotar o pool de conexões do Postgres.
 * - Logs de query apenas em desenvolvimento.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isDev ? ['warn', 'error'] : ['error'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

if (isDev) globalForPrisma.prisma = prisma;

/** Encerra as conexões com o banco (usado no shutdown gracioso). */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
}
