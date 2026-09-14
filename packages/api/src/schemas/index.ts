import { z } from 'zod';
import {
  cpfSchema,
  emailSchema,
  nameSchema,
  optionalEmailSchema,
  optionalPhoneSchema,
  optionalSanitizedString,
  phoneSchema,
  sanitizedString,
  timeSchema,
} from '../shared/validators.js';

/**
 * Schemas de entrada das rotas administrativas.
 * Cada rota usa um destes schemas — nada chega ao banco sem validação.
 */

/** ------------------------- Evento ------------------------- */

const isoDate = z
  .string()
  .min(1, 'Data obrigatória')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Data inválida');

const urlOrEmpty = z
  .union([z.literal(''), z.string().url('URL inválida')])
  .optional()
  .transform((v) => (v === '' ? undefined : v));

export const createEventSchema = z.object({
  title: sanitizedString(3, 140),
  hostsName: optionalSanitizedString(140),
  coupleNameA: optionalSanitizedString(80),
  coupleNameB: optionalSanitizedString(80),
  eventDate: isoDate,
  startTime: z.union([timeSchema, z.literal('')]).optional().transform((v) => v || '19:00'),
  endTime: z.union([timeSchema, z.literal('')]).optional().transform((v) => v || undefined),
  coverImageUrl: urlOrEmpty,
  galleryImages: z.array(z.string().url()).max(20).optional().default([]),
  welcomeMessage: optionalSanitizedString(600),
  inviteMessage: optionalSanitizedString(600),
  couplesMessage: optionalSanitizedString(1200),
  dressCode: optionalSanitizedString(200),
  giftListUrl: urlOrEmpty,
  giftListNotes: optionalSanitizedString(600),
  ceremonyInfo: optionalSanitizedString(800),
  receptionInfo: optionalSanitizedString(800),
  rsvpDeadline: z.union([isoDate, z.literal('')]).optional().transform((v) => v || undefined),
  allowCompanions: z.coerce.boolean().optional().default(true),
  allowShareInvite: z.coerce.boolean().optional().default(false),
  status: z.enum(['DRAFT', 'PUBLISHED', 'FINISHED', 'CANCELLED']).optional().default('DRAFT'),
});

export const updateEventSchema = createEventSchema.partial();

/** ------------------------- Local ------------------------- */

export const upsertVenueSchema = z.object({
  name: sanitizedString(2, 140),
  type: optionalSanitizedString(80),
  address: sanitizedString(3, 200),
  number: optionalSanitizedString(20),
  complement: optionalSanitizedString(120),
  neighborhood: optionalSanitizedString(120),
  city: sanitizedString(2, 120),
  state: z.string().trim().length(2, 'Use a sigla do estado (ex.: RJ)').transform((v) => v.toUpperCase()),
  zipCode: optionalSanitizedString(12),
  country: sanitizedString(2, 60).optional().default('Brasil'),
  referencePoint: optionalSanitizedString(240),
  googleMapsUrl: urlOrEmpty,
  wazeUrl: urlOrEmpty,
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  parkingInfo: optionalSanitizedString(600),
  extraInfo: optionalSanitizedString(1000),
});

/** ------------------------- Convidado ------------------------- */

export const createGuestSchema = z.object({
  fullName: nameSchema,
  email: optionalEmailSchema,
  whatsapp: optionalPhoneSchema,
  allowedCompanions: z.coerce
    .number()
    .int()
    .min(1, 'Autorize pelo menos 1 pessoa (o próprio convidado)')
    .max(20, 'Máximo de 20 pessoas por convite'),
  partyId: z.union([z.literal(''), z.string()]).optional().transform((v) => v || undefined),
  partyName: optionalSanitizedString(80),
  notes: optionalSanitizedString(600),
});

export const updateGuestSchema = createGuestSchema.partial();

export const listGuestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  status: z
    .enum(['ALL', 'PENDING', 'CONFIRMED', 'DECLINED', 'CHECKED_IN', 'CANCELLED'])
    .default('ALL'),
  checkIn: z.enum(['ALL', 'IN', 'OUT']).default('ALL'),
  partyId: z.string().optional(),
  sort: z.enum(['name', 'createdAt', 'status']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/** ------------------------- Importação ------------------------- */

export const importGuestsSchema = z.object({
  eventId: z.string().min(1),
  /** Prévia: não persiste nada. */
  dryRun: z.coerce.boolean().default(true),
  rows: z
    .array(
      z.object({
        fullName: z.string().trim().min(1, 'Nome obrigatório'),
        email: z.string().trim().optional().default(''),
        whatsapp: z.string().trim().optional().default(''),
        allowedCompanions: z.union([z.string(), z.number()]).optional().default(1),
        partyName: z.string().trim().optional().default(''),
      }),
    )
    .min(1, 'Nenhuma linha para importar')
    .max(5000, 'Importe no máximo 5000 linhas por vez'),
});

/** ------------------------- RSVP (área do convidado) ------------------------- */

export const rsvpSchema = z.object({
  fullName: nameSchema,
  cpf: cpfSchema,
  phone: phoneSchema,
  email: emailSchema,
  attendingCount: z.coerce.number().int().min(1, 'Informe ao menos 1 pessoa'),
  companions: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        document: z.string().trim().max(40).optional(),
      }),
    )
    .optional()
    .default([]),
  message: optionalSanitizedString(600),
  /** Consentimento LGPD obrigatório. */
  consent: z.coerce.boolean().refine((v) => v === true, 'É necessário aceitar a política de privacidade'),
});

export const declineSchema = z.object({
  reason: optionalSanitizedString(400),
  consent: z.coerce.boolean().optional().default(true),
});

/** ------------------------- Check-in ------------------------- */

export const checkInSchema = z.object({
  /** Código lido do QR Code. */
  code: z.string().trim().min(4, 'Código inválido'),
  eventId: z.string().optional(),
  operatorLabel: optionalSanitizedString(80),
  /** Identificador do dispositivo que realiza a leitura (auditoria offline). */
  deviceId: optionalSanitizedString(80),
  /** Momento da leitura no aparelho (para sincronização posterior). */
  scannedAt: z.string().optional(),
  /** Autorização manual explícita (apenas para admin, com confirmação). */
  manualOverride: z.coerce.boolean().optional().default(false),
  overrideReason: optionalSanitizedString(300),
});

/** ------------------------- Envio de convites ------------------------- */

export const sendInvitationsSchema = z.object({
  invitationIds: z.array(z.string().min(1)).min(1, 'Selecione ao menos um convite').max(500),
  channel: z.enum(['EMAIL', 'WHATSAPP', 'LINK']).default('LINK'),
  /** Sobrescreve a mensagem padrão (opcional). */
  customMessage: optionalSanitizedString(1200),
});

/** ------------------------- Filtros de auditoria ------------------------- */

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(30),
  action: z.string().optional(),
  userId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpsertVenueInput = z.infer<typeof upsertVenueSchema>;
export type CreateGuestInput = z.infer<typeof createGuestSchema>;
export type RsvpInput = z.infer<typeof rsvpSchema>;
export type CheckInInput = z.infer<typeof checkInSchema>;
