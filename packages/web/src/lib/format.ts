import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/pt-br';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('pt-br');

/** Fuso padrão dos eventos. */
export const APP_TIMEZONE = 'America/Sao_Paulo';

export { dayjs };

/** "20 de dezembro de 2026" */
export function formatLongDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('DD [de] MMMM [de] YYYY');
}

/** "20/12/2026" */
export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('DD/MM/YYYY');
}

/** "20/12/2026 às 19:42" */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('DD/MM/YYYY [às] HH:mm');
}

/** "19:42" */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('HH:mm');
}

/** "20 DEZEMBRO DE 2026" (usado no convite) */
export function formatInviteDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('D [DE] MMMM [DE] YYYY').toUpperCase();
}

/** "domingo, 20 de dezembro" */
export function formatWeekdayDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return dayjs(date).tz(APP_TIMEZONE).format('dd, D [de] MMMM');
}

/** Valor para `<input type="date">` (YYYY-MM-DD). */
export function toDateInputValue(date: string | Date | null | undefined): string {
  if (!date) return '';
  return dayjs(date).tz(APP_TIMEZONE).format('YYYY-MM-DD');
}

/** Valor para `<input type="datetime-local">`. */
export function toDateTimeInputValue(date: string | Date | null | undefined): string {
  if (!date) return '';
  return dayjs(date).tz(APP_TIMEZONE).format('YYYY-MM-DDTHH:mm');
}

/** Dias restantes até a data (negativo se já passou). */
export function daysUntil(date: string | Date | null | undefined): number {
  if (!date) return 0;
  return dayjs(date).tz(APP_TIMEZONE).startOf('day').diff(dayjs().tz(APP_TIMEZONE).startOf('day'), 'day');
}

/** Descrição humana do prazo: "faltam 12 dias". */
export function humanCountdown(date: string | Date | null | undefined): string {
  const days = daysUntil(date);
  if (days === 0) return 'é hoje';
  if (days === 1) return 'falta 1 dia';
  if (days > 1) return `faltam ${days} dias`;
  if (days === -1) return 'foi ontem';
  return `há ${Math.abs(days)} dias`;
}

/** Componentes da contagem regressiva para o convite. */
export interface CountdownParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

/**
 * Calcula a contagem regressiva combinando a data do evento com o horário
 * de início (ex.: "19:00") no fuso da aplicação.
 */
export function countdownTo(eventDate: string | Date, startTime: string): CountdownParts {
  const base = dayjs(eventDate).tz(APP_TIMEZONE).format('YYYY-MM-DD');
  const target = dayjs.tz(`${base} ${startTime || '00:00'}`, 'YYYY-MM-DD HH:mm', APP_TIMEZONE);
  const total = Math.max(0, target.diff(dayjs(), 'millisecond'));

  const seconds = Math.floor(total / 1000);
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
    total,
  };
}

/** Formata CPF já mascarado vindo da API. */
export function displayCpfMask(value: string | null | undefined): string {
  return value ?? 'Não informado';
}

/** Formata telefone para exibição: (21) 99999-9999 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '—';
  let digits = value.replace(/\D+/g, '');
  if (digits.startsWith('55') && digits.length > 11) digits = digits.slice(2);
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return value;
}

/** Saudação conforme a hora do dia. */
export function greeting(): string {
  const hour = dayjs().hour();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

/** Iniciais do nome (avatar). */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** Pluralização simples. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return count === 1 ? singular : pluralForm;
}

/** Primeiro nome. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
