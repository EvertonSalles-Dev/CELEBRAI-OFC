import { z } from 'zod';

/**
 * Validadores do formulário — espelham as regras do backend.
 *
 * O front valida para dar feedback imediato; o backend valida novamente por
 * segurança. As mensagens são idênticas para o usuário ver consistência.
 */

// ---------------------------------------------------------------------------
// CPF
// ---------------------------------------------------------------------------

export function onlyDigits(value: string): string {
  return (value || '').replace(/\D+/g, '');
}

/** Valida o CPF conferindo os dois dígitos verificadores. */
export function isValidCpf(input: string): boolean {
  const cpf = onlyDigits(input);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digits = cpf.split('').map(Number);

  const calcCheck = (slice: number[]): number => {
    const weightStart = slice.length + 1;
    const sum = slice.reduce((acc, digit, idx) => acc + digit * (weightStart - idx), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  if (calcCheck(digits.slice(0, 9)) !== digits[9]) return false;
  return calcCheck(digits.slice(0, 10)) === digits[10];
}

/** Máscara progressiva: 000.000.000-00 */
export function formatCpfInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

// ---------------------------------------------------------------------------
// Telefone brasileiro
// ---------------------------------------------------------------------------

export function isValidPhone(input: string): boolean {
  let digits = onlyDigits(input);
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length !== 10 && digits.length !== 11) return false;

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) return false;
  if (digits.length === 11 && digits[2] !== '9') return false;

  return true;
}

/** Máscara progressiva: (21) 99999-9999 */
export function formatPhoneInput(value: string): string {
  let digits = onlyDigits(value);
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  digits = digits.slice(0, 11);

  if (digits.length <= 2) return digits.length ? `(${digits}` : '';
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ---------------------------------------------------------------------------
// CEP
// ---------------------------------------------------------------------------

export function formatZipInput(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ---------------------------------------------------------------------------
// Schemas Zod
// ---------------------------------------------------------------------------

/** Senha forte (espelha a regra do backend). */
export const passwordSchema = z
  .string()
  .min(8, 'A senha deve ter ao menos 8 caracteres')
  .max(128)
  .refine((value) => /[A-Za-z]/.test(value), 'Inclua ao menos uma letra')
  .refine((value) => /\d/.test(value), 'Inclua ao menos um número');

/** Login do painel. */
export const loginSchema = z.object({
  email: z.string().min(1, 'Informe o e-mail').email('E-mail inválido'),
  password: z.string().min(1, 'Informe a senha'),
});
export type LoginForm = z.infer<typeof loginSchema>;

/** Campos base do convidado (usados no cadastro e na edição). */
export const guestFormSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe o nome completo').max(120),
  email: z
    .string()
    .trim()
    .email('E-mail inválido')
    .optional()
    .or(z.literal('')),
  whatsapp: z
    .string()
    .trim()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || isValidPhone(v), 'Telefone brasileiro inválido'),
  allowedCompanions: z.coerce
    .number({ invalid_type_error: 'Informe um número' })
    .int('Use um número inteiro')
    .min(1, 'Autorize pelo menos 1 pessoa')
    .max(20, 'Máximo de 20 pessoas'),
  partyName: z.string().trim().max(80).optional().or(z.literal('')),
  notes: z.string().trim().max(600).optional().or(z.literal('')),
});
export type GuestForm = z.infer<typeof guestFormSchema>;

/**
 * RSVP do convidado.
 * O limite de acompanhantes é validado no formulário com o valor autorizado.
 */
export const rsvpFormSchema = z.object({
  fullName: z.string().trim().min(3, 'Informe seu nome completo').max(120),
  cpf: z
    .string()
    .min(1, 'Informe o CPF')
    .refine((v) => isValidCpf(v), 'CPF inválido. Confira os números.'),
  phone: z
    .string()
    .min(1, 'Informe um telefone/WhatsApp')
    .refine((v) => isValidPhone(v), 'Telefone brasileiro inválido'),
  email: z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido'),
  attendingCount: z.coerce
    .number({ invalid_type_error: 'Informe a quantidade' })
    .int('Use um número inteiro')
    .min(1, 'Confirme ao menos 1 pessoa'),
  companions: z
    .array(z.object({ name: z.string().trim().min(1, 'Informe o nome').max(120) }))
    .optional()
    .default([]),
  message: z.string().trim().max(600).optional().or(z.literal('')),
  consent: z.literal(true, {
    errorMap: () => ({ message: 'É necessário aceitar a política de privacidade' }),
  }),
});
export type RsvpForm = z.infer<typeof rsvpFormSchema>;

/** Recusa de presença. */
export const declineFormSchema = z.object({
  reason: z.string().trim().max(400).optional().or(z.literal('')),
});
export type DeclineForm = z.infer<typeof declineFormSchema>;

/** Evento. */
export const eventFormSchema = z.object({
  title: z.string().trim().min(3, 'Informe o título do evento').max(140),
  hostsName: z.string().trim().max(140).optional().or(z.literal('')),
  coupleNameA: z.string().trim().max(80).optional().or(z.literal('')),
  coupleNameB: z.string().trim().max(80).optional().or(z.literal('')),
  eventDate: z.string().min(1, 'Informe a data do evento'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido (HH:mm)'),
  endTime: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine((v) => !v || /^([01]\d|2[0-3]):[0-5]\d$/.test(v), 'Horário inválido (HH:mm)'),
  rsvpDeadline: z.string().optional().or(z.literal('')),
  coverImageUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  welcomeMessage: z.string().trim().max(600).optional().or(z.literal('')),
  inviteMessage: z.string().trim().max(600).optional().or(z.literal('')),
  couplesMessage: z.string().trim().max(1200).optional().or(z.literal('')),
  dressCode: z.string().trim().max(200).optional().or(z.literal('')),
  giftListUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  giftListNotes: z.string().trim().max(600).optional().or(z.literal('')),
  ceremonyInfo: z.string().trim().max(800).optional().or(z.literal('')),
  receptionInfo: z.string().trim().max(800).optional().or(z.literal('')),
  allowCompanions: z.boolean().default(true),
  allowShareInvite: z.boolean().default(false),
  status: z.enum(['DRAFT', 'PUBLISHED', 'FINISHED', 'CANCELLED']).default('DRAFT'),
});
export type EventForm = z.infer<typeof eventFormSchema>;

/** Local do evento. */
export const venueFormSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome do local').max(140),
  type: z.string().trim().max(80).optional().or(z.literal('')),
  address: z.string().trim().min(3, 'Informe o endereço').max(200),
  number: z.string().trim().max(20).optional().or(z.literal('')),
  complement: z.string().trim().max(120).optional().or(z.literal('')),
  neighborhood: z.string().trim().max(120).optional().or(z.literal('')),
  city: z.string().trim().min(2, 'Informe a cidade').max(120),
  state: z
    .string()
    .trim()
    .length(2, 'Use a sigla do estado (ex.: RJ)')
    .transform((v) => v.toUpperCase()),
  zipCode: z.string().trim().max(12).optional().or(z.literal('')),
  referencePoint: z.string().trim().max(240).optional().or(z.literal('')),
  googleMapsUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  wazeUrl: z.string().trim().url('URL inválida').optional().or(z.literal('')),
  parkingInfo: z.string().trim().max(600).optional().or(z.literal('')),
  extraInfo: z.string().trim().max(1000).optional().or(z.literal('')),
});
export type VenueForm = z.infer<typeof venueFormSchema>;
