import { z } from 'zod';
import { isValidCpf, normalizeBrazilianPhone, normalizeEmail } from '../shared/brazil.js';

/**
 * Schemas Zod reutilizáveis. Centralizar aqui garante que front-end e
 * back-end validem exatamente as mesmas regras (o front replica via
 * `packages/web/src/lib/validators.ts`).
 */

export const idSchema = z.string().min(1, 'Identificador obrigatório');

/** CPF com validação de dígitos verificadores. */
export const cpfSchema = z
  .string()
  .transform((v) => v.replace(/\D+/g, ''))
  .refine((v) => v.length === 11, 'CPF deve conter 11 dígitos')
  .refine((v) => isValidCpf(v), 'CPF inválido');

export const phoneSchema = z
  .string()
  .min(10, 'Telefone inválido')
  .transform((v) => normalizeBrazilianPhone(v) ?? v)
  .refine((v) => normalizeBrazilianPhone(v) !== null, 'Telefone brasileiro inválido');

export const emailSchema = z
  .string()
  .trim()
  .min(3, 'E-mail obrigatório')
  .transform(normalizeEmail)
  .refine((v) => z.string().email().safeParse(v).success, 'E-mail inválido');

export const optionalEmailSchema = z
  .union([z.literal(''), emailSchema])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const optionalPhoneSchema = z
  .union([z.literal(''), phoneSchema])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const nameSchema = z.string().trim().min(3, 'Informe o nome completo').max(120);

export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (use HH:mm)');

export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v), 'Inclua ao menos uma letra')
  .refine((v) => /\d/.test(v), 'Inclua ao menos um número');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
});

/** Remove tags/scripts de strings livres (defesa em profundidade contra XSS). */
export function sanitizeText(input: string): string {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

export const sanitizedString = (min = 0, max = 500) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().min(min).max(max));

export const optionalSanitizedString = (max = 2000) =>
  z
    .union([z.literal(''), z.string()])
    .optional()
    .transform((v) => (v === '' || v === undefined ? undefined : sanitizeText(v).slice(0, max)));
