/**
 * Tipos compartilhados do Celebrai (espelham o contrato da API).
 * Mantidos à mão para o front não depender do pacote do backend.
 */

// ---------------------------------------------------------------------------
// Enums / unions
// ---------------------------------------------------------------------------

export type Role = 'SUPER_ADMIN' | 'ADMIN' | 'RECEPTIONIST';

export type InvitationStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'DECLINED'
  | 'CHECKED_IN'
  | 'CANCELLED';

export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'FINISHED' | 'CANCELLED';

export type NotificationChannel = 'EMAIL' | 'WHATSAPP' | 'SMS' | 'LINK';

export type CheckInMethod = 'QR_CODE' | 'MANUAL';

export type CheckInOutcome =
  | 'AUTHORIZED'
  | 'INVALID'
  | 'WRONG_EVENT'
  | 'CANCELLED'
  | 'NOT_CONFIRMED'
  | 'ALREADY_USED';

// ---------------------------------------------------------------------------
// Respostas genéricas da API
// ---------------------------------------------------------------------------

export interface ApiMeta {
  page?: number;
  perPage?: number;
  total?: number;
  totalPages?: number;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }> | unknown;
}

export interface ApiEnvelope<T> {
  data: T;
  meta?: ApiMeta;
}

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export interface ManagedUser extends AuthUser {
  status: 'ACTIVE' | 'SUSPENDED';
  lastLoginAt: string | null;
  createdAt: string;
  _count?: { events: number; memberships: number };
}

// ---------------------------------------------------------------------------
// Local
// ---------------------------------------------------------------------------

export interface Venue {
  id: string;
  name: string;
  type: string | null;
  address: string;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string;
  state: string;
  zipCode: string | null;
  country: string;
  referencePoint: string | null;
  googleMapsUrl: string | null;
  wazeUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  parkingInfo: string | null;
  extraInfo: string | null;
}

// ---------------------------------------------------------------------------
// Evento
// ---------------------------------------------------------------------------

export interface InvitationCounts {
  total: number;
  pending: number;
  confirmed: number;
  declined: number;
  checkedIn: number;
  cancelled: number;
}

export interface Event {
  id: string;
  slug: string;
  ownerId: string;
  status: EventStatus;

  title: string;
  hostsName: string | null;
  coupleNameA: string | null;
  coupleNameB: string | null;

  coverImageUrl: string | null;
  galleryImages: string[];
  welcomeMessage: string | null;
  inviteMessage: string | null;
  couplesMessage: string | null;
  dressCode: string | null;
  giftListUrl: string | null;
  giftListNotes: string | null;
  ceremonyInfo: string | null;
  receptionInfo: string | null;

  eventDate: string;
  startTime: string;
  endTime: string | null;
  rsvpDeadline: string | null;

  allowCompanions: boolean;
  allowShareInvite: boolean;

  venue?: Venue | null;
  _count?: { guests: number };
  invitationCounts?: InvitationCounts;
  members?: Array<{ id: string; user: AuthUser }>;

  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  guests: number;
  invitations: InvitationCounts;
  checkInTotal: number;
  checkInPeople: number;
  expectedPeople: number;
  absent: number;
  checkInTimeline: Array<{ time: string; count: number }>;
  responsesTimeline: Array<{ date: string; count: number }>;
}

// ---------------------------------------------------------------------------
// Convidados
// ---------------------------------------------------------------------------

export interface GuestResponse {
  fullName: string;
  cpfMasked: string | null;
  email: string | null;
  phone: string | null;
  attendingCount: number;
  companions: Array<{ name: string; document?: string }>;
  respondedAt: string;
}

export interface GuestInvitation {
  id: string;
  status: InvitationStatus;
  sentAt: string | null;
  hasQrCode: boolean;
  response: GuestResponse | null;
  lastCheckIn: { createdAt: string; peopleCount: number; operatorLabel: string | null } | null;
  checkInCount: number;
}

export interface Guest {
  id: string;
  fullName: string;
  email: string | null;
  whatsapp: string | null;
  allowedCompanions: number;
  notes: string | null;
  createdAt: string;
  party: { id: string; name: string } | null;
  invitation: GuestInvitation | null;
}

export interface GuestFilters {
  page?: number;
  perPage?: number;
  search?: string;
  status?: InvitationStatus | 'ALL';
  checkIn?: 'ALL' | 'IN' | 'OUT';
  partyId?: string;
  sort?: 'name' | 'createdAt' | 'status';
  order?: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Importação
// ---------------------------------------------------------------------------

export interface ImportRow {
  line: number;
  fullName: string;
  email: string;
  whatsapp: string;
  normalizedPhone: string | null;
  allowedCompanions: number;
  partyName: string | null;
  errors: string[];
  warning: string | null;
  valid: boolean;
}

export interface ImportResult {
  preview: ImportRow[];
  summary: { total: number; valid: number; invalid: number; duplicates: number };
  imported: number;
}

// ---------------------------------------------------------------------------
// Convites (admin)
// ---------------------------------------------------------------------------

export interface AdminInvitation {
  id: string;
  status: InvitationStatus;
  sentAt: string | null;
  sentVia: string | null;
  respondedAt: string | null;
  cancelledAt: string | null;
  cancelledReason: string | null;
  hasQrCode: boolean;
  qrCodePrefix: string | null;
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    whatsapp: string | null;
    allowedCompanions: number;
  };
  response: { attendingCount: number; cpfMasked: string | null; createdAt: string } | null;
  lastCheckIn: { createdAt: string; peopleCount: number } | null;
}

export interface SendInvitationsResult {
  results: Array<{
    invitationId: string;
    guestName: string;
    channel: NotificationChannel;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    link: string;
    error?: string;
  }>;
  summary: { total: number; sent: number; skipped: number; failed: number };
  channels: { email: boolean; whatsapp: boolean };
}

export interface ShareTextResult {
  text: string;
  shortText: string;
  link: string;
  whatsappUrl: string | null;
}

export interface QrCodePayload {
  code: string | null;
  issuedAt: string | null;
  guest: { name: string; allowedCompanions: number; attendingCount: number | null };
  event: {
    title: string;
    date: string;
    dateLabel?: string;
    startTime: string;
    venue: { name: string; address: string; number: string | null; city: string; state: string } | null;
  };
  alreadyCheckedIn?: boolean;
  lastCheckInAt?: string | null;
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export interface CheckInResult {
  outcome: CheckInOutcome;
  message: string;
  tone: 'success' | 'danger' | 'warning';
  guest?: {
    id: string;
    name: string;
    allowedCompanions: number;
    attendingCount: number | null;
    companions: Array<{ name: string; document?: string }>;
  };
  event?: {
    id: string;
    title: string;
    date: string;
    startTime: string;
    venueName: string | null;
  };
  checkIn?: {
    id: string;
    at: string;
    atLabel: string;
    timeLabel: string;
    peopleCount: number;
    method: CheckInMethod;
    operatorLabel: string | null;
  };
  previousCheckIn?: { at: string; atLabel: string; operatorLabel: string | null };
  canOverride: boolean;
}

export interface CheckInStats {
  invitations: InvitationCounts;
  entriesCount: number;
  peopleInside: number;
  expectedPeople: number;
  lastCheckIns: Array<{
    id: string;
    guestName: string;
    peopleCount: number;
    at: string;
    atLabel: string;
    method: CheckInMethod;
    operatorLabel: string | null;
  }>;
}

export interface CheckInEventOption {
  id: string;
  title: string;
  hostsName: string | null;
  eventDate: string;
  status: EventStatus;
}

// ---------------------------------------------------------------------------
// Área pública do convidado
// ---------------------------------------------------------------------------

export interface PublicEvent {
  id: string;
  title: string;
  hostsName: string | null;
  coupleNameA: string | null;
  coupleNameB: string | null;
  coverImageUrl: string | null;
  galleryImages: string[];
  welcomeMessage: string | null;
  inviteMessage: string | null;
  couplesMessage: string | null;
  dressCode: string | null;
  giftListUrl: string | null;
  giftListNotes: string | null;
  ceremonyInfo: string | null;
  receptionInfo: string | null;
  eventDate: string;
  startTime: string;
  endTime: string | null;
  rsvpDeadline: string | null;
  allowCompanions: boolean;
  allowShareInvite: boolean;
  daysUntil: number;
  venue: Venue | null;
  mapsApiKey: string | null;
}

export interface PublicInvitation {
  id: string;
  status: InvitationStatus;
  hasQrCode: boolean;
  respondedAt: string | null;
  guest: { id: string; fullName: string; allowedCompanions: number };
  response: {
    fullName: string;
    cpfMasked: string | null;
    email: string | null;
    phone: string | null;
    attendingCount: number;
    companions: Array<{ name: string; document?: string }>;
    message: string | null;
    respondedAt: string;
  } | null;
}

export interface InvitationPayload {
  invitation: PublicInvitation;
  event: PublicEvent;
  rsvpOpen: boolean;
}

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  description: string | null;
  actorName: string | null;
  actorRole: Role | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
  user: { id: string; name: string; role: Role } | null;
}
