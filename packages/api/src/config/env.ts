import 'dotenv/config';
import { z } from 'zod';

/**
 * Validação e normalização das variáveis de ambiente.
 * Falha rápido (fail-fast) se algo essencial estiver faltando em produção.
 */
const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3333),
  API_PREFIX: z.string().default('/api'),

  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3333'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DATABASE_PROVIDER: z.enum(['postgresql', 'sqlite', 'mysql']).default('postgresql'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET deve ter ao menos 16 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET deve ter ao menos 16 caracteres'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  INVITATION_TOKEN_SECRET: z.string().min(16).default('celebrai-invitation-secret-change-me'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(8).max(15).default(12),

  CORS_ORIGINS: z
    .string()
    .default(
      [
        'http://localhost:5173',
        'http://localhost:4173',
        'http://127.0.0.1:5173',
        'http://127.0.0.1:4173',
      ].join(','),
    ),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),
  CHECKIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(120),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

  MAIL_DRIVER: z.enum(['smtp', 'disabled']).default('disabled'),
  MAIL_FROM: z.string().default('Celebrai <no-reply@celebrai.app>'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().optional(),
  SMTP_SECURE: booleanish.default(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  WHATSAPP_DRIVER: z.enum(['cloud_api', 'disabled']).default('disabled'),
  WHATSAPP_API_URL: z.string().default('https://graph.facebook.com/v20.0'),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_API_VERSION: z.string().default('v20.0'),

  GOOGLE_MAPS_API_KEY: z.string().optional(),

  SEED_SUPER_ADMIN_NAME: z.string().default('Super Admin'),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().default('super@celebrai.app'),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).default('SuperAdmin@123'),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Detecta execução em ambiente serverless (Vercel/Lambda). Nesses ambientes
 * `process.exit` é proibido — ele aborta a invocação sem produzir resposta.
 */
export const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  • ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    const message = `[celebrai] Configuração de ambiente inválida:\n${issues}`;
    // eslint-disable-next-line no-console
    console.error(`\n${message}\n`);

    // Em serverless (Vercel/Lambda) `process.exit` encerraria a invocação sem
    // resposta HTTP — o cliente veria um timeout opaco. Lançar o erro entrega
    // uma mensagem clara e deixa o handler converter em 500.
    if (isServerless) throw new Error(message);
    process.exit(1);
  }

  const env = parsed.data;

  if (env.NODE_ENV === 'production') {
    const insecure = [
      ['JWT_ACCESS_SECRET', 'troque-este-segredo-de-acesso-em-producao'],
      ['JWT_REFRESH_SECRET', 'troque-este-segredo-de-refresh-em-producao'],
      ['INVITATION_TOKEN_SECRET', 'celebrai-invitation-secret-change-me'],
    ].filter(([key, value]) => env[key as keyof AppEnv] === value);

    if (insecure.length > 0) {
      const message = `[celebrai] Segredos padrão detectados em produção: ${insecure
        .map(([k]) => k)
        .join(', ')}. Defina valores fortes antes de subir.`;
      // eslint-disable-next-line no-console
      console.error(`\n${message}\n`);

      if (isServerless) throw new Error(message);
      process.exit(1);
    }
  }

  return env;
}

export const env = loadEnv();

export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
export const isTest = env.NODE_ENV === 'test';

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
