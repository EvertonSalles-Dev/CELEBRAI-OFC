import { buildQuery, request, requestData, requestText, setAccessToken } from '@/lib/api-client';
import type {
  AdminInvitation,
  AuditLogEntry,
  AuthUser,
  CheckInEventOption,
  CheckInResult,
  CheckInStats,
  DashboardData,
  Event,
  Guest,
  GuestFilters,
  ImportResult,
  InvitationPayload,
  LoginResponse,
  ManagedUser,
  PublicInvitation,
  QrCodePayload,
  SendInvitationsResult,
  ShareTextResult,
  Venue,
} from '@/types';

/**
 * Camada de acesso à API, organizada por domínio.
 * Cada função corresponde a um endpoint — nenhum componente conhece URLs.
 */

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const data = await requestData<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
      skipAuthRefresh: true,
    });
    setAccessToken(data.accessToken);
    return data;
  },

  async logout(): Promise<void> {
    try {
      await request('/auth/logout', { method: 'POST', skipAuthRefresh: true });
    } finally {
      setAccessToken(null);
    }
  },

  me(): Promise<AuthUser> {
    return requestData<AuthUser>('/auth/me');
  },

  async refresh(): Promise<LoginResponse> {
    const data = await requestData<LoginResponse>('/auth/refresh', {
      method: 'POST',
      skipAuthRefresh: true,
    });
    setAccessToken(data.accessToken);
    return data;
  },

  listUsers(): Promise<ManagedUser[]> {
    return requestData<ManagedUser[]>('/auth/users');
  },

  createUser(input: {
    name: string;
    email: string;
    password: string;
    role: 'ADMIN' | 'RECEPTIONIST';
  }): Promise<ManagedUser> {
    return requestData<ManagedUser>('/auth/users', { method: 'POST', body: input });
  },
};

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export const eventsApi = {
  list(): Promise<Event[]> {
    return requestData<Event[]>('/events');
  },

  get(id: string): Promise<Event> {
    return requestData<Event>(`/events/${id}`);
  },

  create(input: Record<string, unknown>): Promise<Event> {
    return requestData<Event>('/events', { method: 'POST', body: input });
  },

  update(id: string, input: Record<string, unknown>): Promise<Event> {
    return requestData<Event>(`/events/${id}`, { method: 'PATCH', body: input });
  },

  remove(id: string): Promise<void> {
    return requestData<void>(`/events/${id}`, { method: 'DELETE' });
  },

  upsertVenue(id: string, input: Record<string, unknown>): Promise<Venue> {
    return requestData<Venue>(`/events/${id}/venue`, { method: 'PUT', body: input });
  },

  dashboard(id: string): Promise<DashboardData> {
    return requestData<DashboardData>(`/events/${id}/dashboard`);
  },

  audit(id: string, params: { page?: number; perPage?: number; action?: string } = {}) {
    return request<AuditLogEntry[]>(`/events/${id}/audit${buildQuery(params)}`);
  },
};

// ---------------------------------------------------------------------------
// Convidados
// ---------------------------------------------------------------------------

export const guestsApi = {
  async list(eventId: string, filters: GuestFilters = {}) {
    return request<Guest[]>(`/events/${eventId}/guests${buildQuery(filters)}`);
  },

  get(eventId: string, id: string): Promise<Guest> {
    return requestData<Guest>(`/events/${eventId}/guests/${id}`);
  },

  create(
    eventId: string,
    input: Record<string, unknown>,
  ): Promise<{ guest: Guest & { invitationId: string }; inviteLink: string }> {
    return requestData(`/events/${eventId}/guests`, { method: 'POST', body: input });
  },

  update(eventId: string, id: string, input: Record<string, unknown>): Promise<Guest> {
    return requestData<Guest>(`/events/${eventId}/guests/${id}`, { method: 'PATCH', body: input });
  },

  remove(eventId: string, id: string): Promise<void> {
    return requestData<void>(`/events/${eventId}/guests/${id}`, { method: 'DELETE' });
  },

  importGuests(
    eventId: string,
    rows: Array<Record<string, unknown>>,
    dryRun: boolean,
  ): Promise<ImportResult> {
    return requestData<ImportResult>(`/events/${eventId}/guests/import`, {
      method: 'POST',
      body: { eventId, dryRun, rows },
    });
  },

  exportCsv(eventId: string, status?: string): Promise<string> {
    return requestText(`/events/${eventId}/guests/export${buildQuery({ format: 'csv', status })}`);
  },
};

// ---------------------------------------------------------------------------
// Convites (admin)
// ---------------------------------------------------------------------------

export const invitationsApi = {
  list(eventId: string, params: { status?: string; search?: string } = {}): Promise<
    AdminInvitation[]
  > {
    return requestData<AdminInvitation[]>(
      `/events/${eventId}/invitations${buildQuery(params)}`,
    );
  },

  reissueLink(eventId: string, id: string): Promise<{ link: string; guestName: string }> {
    return requestData(`/events/${eventId}/invitations/${id}/link`);
  },

  send(
    eventId: string,
    input: { invitationIds: string[]; channel: 'EMAIL' | 'WHATSAPP' | 'LINK'; customMessage?: string },
  ): Promise<SendInvitationsResult> {
    return requestData<SendInvitationsResult>(`/events/${eventId}/invitations/send`, {
      method: 'POST',
      body: input,
    });
  },

  issueQrCode(eventId: string, id: string): Promise<QrCodePayload> {
    return requestData<QrCodePayload>(`/events/${eventId}/invitations/${id}/qrcode`);
  },

  shareText(eventId: string, id: string): Promise<ShareTextResult> {
    return requestData<ShareTextResult>(`/events/${eventId}/invitations/${id}/share-text`);
  },

  cancel(eventId: string, id: string, reason?: string): Promise<{ id: string; status: string }> {
    return requestData(`/events/${eventId}/invitations/${id}/cancel`, {
      method: 'POST',
      body: { reason },
    });
  },

  reopen(eventId: string, id: string): Promise<{ id: string; status: string }> {
    return requestData(`/events/${eventId}/invitations/${id}/reopen`, { method: 'POST' });
  },
};

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export const checkInApi = {
  myEvents(): Promise<CheckInEventOption[]> {
    return requestData<CheckInEventOption[]>('/check-in/events');
  },

  validate(
    eventId: string,
    input: {
      code: string;
      operatorLabel?: string;
      manualOverride?: boolean;
      overrideReason?: string;
      deviceId?: string;
      scannedAt?: string;
    },
  ): Promise<CheckInResult> {
    return requestData<CheckInResult>(`/events/${eventId}/check-in/validate`, {
      method: 'POST',
      body: input,
    });
  },

  search(eventId: string, term: string): Promise<
    Array<{
      id: string;
      name: string;
      allowedCompanions: number;
      status: string;
      attendingCount: number | null;
      checkedInAt: string | null;
    }>
  > {
    return requestData(`/events/${eventId}/check-in/search${buildQuery({ q: term })}`);
  },

  stats(eventId: string): Promise<CheckInStats> {
    return requestData<CheckInStats>(`/events/${eventId}/check-in/stats`);
  },
};

// ---------------------------------------------------------------------------
// Área pública do convidado
// ---------------------------------------------------------------------------

export const publicApi = {
  getInvitation(token: string): Promise<InvitationPayload> {
    return requestData<InvitationPayload>(`/public/invitations/${token}`);
  },

  status(token: string): Promise<{ status: string; checkedInAt: string | null }> {
    return requestData(`/public/invitations/${token}/status`);
  },

  confirm(
    token: string,
    input: Record<string, unknown>,
  ): Promise<{ status: string; response: PublicInvitation; qrCode: string }> {
    return requestData(`/public/invitations/${token}/rsvp`, { method: 'POST', body: input });
  },

  decline(token: string, input: { reason?: string }): Promise<{ status: string }> {
    return requestData(`/public/invitations/${token}/decline`, { method: 'POST', body: input });
  },

  getQrCode(token: string): Promise<QrCodePayload> {
    return requestData<QrCodePayload>(`/public/invitations/${token}/qrcode`);
  },
};
