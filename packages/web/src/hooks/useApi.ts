import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { checkInApi, eventsApi, guestsApi, invitationsApi } from '@/services/api';
import type {
  CheckInEventOption,
  CheckInResult,
  CheckInStats,
  DashboardData,
  Event,
  Guest,
  GuestFilters,
  AdminInvitation,
} from '@/types';

/**
 * Hooks de dados do painel administrativo (TanStack Query).
 *
 * Toda a lógica de cache e invalidação vive aqui — os componentes apenas
 * consomem os hooks, mantendo a regra de "não colocar lógica nos componentes".
 */

// ---------------------------------------------------------------------------
// Chaves de cache centralizadas
// ---------------------------------------------------------------------------

export const queryKeys = {
  events: ['events'] as const,
  event: (id: string) => ['events', id] as const,
  dashboard: (id: string) => ['events', id, 'dashboard'] as const,
  guests: (id: string, filters: GuestFilters) => ['events', id, 'guests', filters] as const,
  guest: (id: string, guestId: string) => ['events', id, 'guests', guestId] as const,
  invitations: (id: string, filters: object) => ['events', id, 'invitations', filters] as const,
  audit: (id: string, params: object) => ['events', id, 'audit', params] as const,
  checkInEvents: ['check-in', 'events'] as const,
  checkInStats: (id: string) => ['check-in', id, 'stats'] as const,
};

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

export function useEvents(options?: Partial<UseQueryOptions<Event[]>>) {
  return useQuery<Event[]>({
    queryKey: queryKeys.events,
    queryFn: () => eventsApi.list(),
    ...options,
  });
}

export function useEvent(id: string | undefined) {
  return useQuery<Event>({
    queryKey: queryKeys.event(id ?? ''),
    queryFn: () => eventsApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useDashboard(eventId: string | undefined) {
  return useQuery<DashboardData>({
    queryKey: queryKeys.dashboard(eventId ?? ''),
    queryFn: () => eventsApi.dashboard(eventId as string),
    enabled: Boolean(eventId),
    refetchInterval: 30_000,
  });
}

export function useCreateEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => eventsApi.create(input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}

export function useUpdateEvent(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => eventsApi.update(eventId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.event(eventId) });
      void client.invalidateQueries({ queryKey: queryKeys.events });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
    },
  });
}

export function useDeleteEvent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventsApi.remove(id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.events });
    },
  });
}

export function useUpsertVenue(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => eventsApi.upsertVenue(eventId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.event(eventId) });
    },
  });
}

export function useAuditLogs(
  eventId: string | undefined,
  params: { page?: number; perPage?: number; action?: string } = {},
) {
  return useQuery({
    queryKey: queryKeys.audit(eventId ?? '', params),
    queryFn: () => eventsApi.audit(eventId as string, params),
    enabled: Boolean(eventId),
  });
}

// ---------------------------------------------------------------------------
// Convidados
// ---------------------------------------------------------------------------

export function useGuests(eventId: string | undefined, filters: GuestFilters) {
  return useQuery({
    queryKey: queryKeys.guests(eventId ?? '', filters),
    queryFn: () => guestsApi.list(eventId as string, filters),
    enabled: Boolean(eventId),
    placeholderData: (previous) => previous,
  });
}

export function useGuest(eventId: string | undefined, guestId: string | undefined) {
  return useQuery<Guest>({
    queryKey: queryKeys.guest(eventId ?? '', guestId ?? ''),
    queryFn: () => guestsApi.get(eventId as string, guestId as string),
    enabled: Boolean(eventId && guestId),
  });
}

export function useCreateGuest(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Record<string, unknown>) => guestsApi.create(eventId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
      void client.invalidateQueries({ queryKey: ['events', eventId, 'invitations'] });
    },
  });
}

export function useUpdateGuest(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      guestsApi.update(eventId, id, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
    },
  });
}

export function useDeleteGuest(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => guestsApi.remove(eventId, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
    },
  });
}

export function useImportGuests(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ rows, dryRun }: { rows: Array<Record<string, unknown>>; dryRun: boolean }) =>
      guestsApi.importGuests(eventId, rows, dryRun),
    onSuccess: (_data, variables) => {
      if (!variables.dryRun) {
        void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
        void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
      }
    },
  });
}

// ---------------------------------------------------------------------------
// Convites
// ---------------------------------------------------------------------------

export function useInvitations(
  eventId: string | undefined,
  filters: { status?: string; search?: string } = {},
) {
  return useQuery<AdminInvitation[]>({
    queryKey: queryKeys.invitations(eventId ?? '', filters),
    queryFn: () => invitationsApi.list(eventId as string, filters),
    enabled: Boolean(eventId),
  });
}

export function useSendInvitations(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      invitationIds: string[];
      channel: 'EMAIL' | 'WHATSAPP' | 'LINK';
      customMessage?: string;
    }) => invitationsApi.send(eventId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'invitations'] });
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
    },
  });
}

export function useCancelInvitation(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      invitationsApi.cancel(eventId, id, reason),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'invitations'] });
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
      void client.invalidateQueries({ queryKey: queryKeys.dashboard(eventId) });
    },
  });
}

export function useReopenInvitation(eventId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => invitationsApi.reopen(eventId, id),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ['events', eventId, 'invitations'] });
      void client.invalidateQueries({ queryKey: ['events', eventId, 'guests'] });
    },
  });
}

// ---------------------------------------------------------------------------
// Check-in
// ---------------------------------------------------------------------------

export function useCheckInEvents() {
  return useQuery<CheckInEventOption[]>({
    queryKey: queryKeys.checkInEvents,
    queryFn: () => checkInApi.myEvents(),
  });
}

export function useCheckInStats(eventId: string | undefined) {
  return useQuery<CheckInStats>({
    queryKey: queryKeys.checkInStats(eventId ?? ''),
    queryFn: () => checkInApi.stats(eventId as string),
    enabled: Boolean(eventId),
    refetchInterval: 20_000,
  });
}

/** Validação do QR Code. Não usa cache: cada leitura é uma decisão do servidor. */
export function useValidateCheckIn(eventId: string) {
  const client = useQueryClient();
  return useMutation<CheckInResult, Error, { code: string; operatorLabel?: string; manualOverride?: boolean; overrideReason?: string }>({
    mutationFn: (input) => checkInApi.validate(eventId, input),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: queryKeys.checkInStats(eventId) });
    },
  });
}
