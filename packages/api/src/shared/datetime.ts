import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);

/** Fuso padrão do sistema (eventos são agendados no horário de Brasília). */
export const APP_TIMEZONE = 'America/Sao_Paulo';

export { dayjs };

/** Formata em pt-BR completo: "20 de dezembro de 2026". */
export function formatLongDate(date: Date | string): string {
  return dayjs(date).tz(APP_TIMEZONE).format('DD [de] MMMM [de] YYYY');
}

/** Formato curto: 20/12/2026. */
export function formatShortDate(date: Date | string): string {
  return dayjs(date).tz(APP_TIMEZONE).format('DD/MM/YYYY');
}

/** Data + hora: 20/12/2026 às 19:42. */
export function formatDateTime(date: Date | string): string {
  return dayjs(date).tz(APP_TIMEZONE).format('DD/MM/YYYY [às] HH:mm');
}

/** Apenas hora: 19:42. */
export function formatTime(date: Date | string): string {
  return dayjs(date).tz(APP_TIMEZONE).format('HH:mm');
}

/** Arredonda uma data para o bloco de 30 minutos (usado nos gráficos). */
export function floorToHalfHour(date: Date | string): string {
  const d = dayjs(date).tz(APP_TIMEZONE);
  const minutes = d.minute() < 30 ? 0 : 30;
  return d.minute(minutes).second(0).millisecond(0).format('HH:mm');
}

/** Diferença em dias entre hoje e a data (negativo se passou). */
export function daysUntil(date: Date | string): number {
  return dayjs(date).tz(APP_TIMEZONE).startOf('day').diff(dayjs().tz(APP_TIMEZONE).startOf('day'), 'day');
}

/** Indica se o prazo de RSVP expirou. */
export function isRsvpExpired(deadline?: Date | string | null): boolean {
  if (!deadline) return false;
  return dayjs().tz(APP_TIMEZONE).isAfter(dayjs(deadline).tz(APP_TIMEZONE));
}

/**
 * Combina a data do evento com o horário "HH:mm" informado, no fuso da app.
 * Usado para montar `eventDate` + `startTime` em um DateTime coerente.
 */
export function combineDateAndTime(date: Date | string, time?: string | null): Date {
  const base = dayjs(date).tz(APP_TIMEZONE);
  if (!time) return base.toDate();
  const parsed = dayjs.tz(`${base.format('YYYY-MM-DD')} ${time}`, 'YYYY-MM-DD HH:mm', APP_TIMEZONE);
  return parsed.isValid() ? parsed.toDate() : base.toDate();
}
