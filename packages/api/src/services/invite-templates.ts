import type { Event, Guest, Venue } from '@prisma/client';
import { env } from '../config/env.js';
import { formatLongDate, formatShortDate } from '../shared/datetime.js';

/**
 * Templates de mensagem do convite (e-mail e WhatsApp).
 * Centralizados aqui para manter consistência entre canais e facilitar
 * ajustes de copy sem tocar na lógica de envio.
 */

export type EventWithVenue = Event & { venue: Venue | null };

export function buildInviteLink(token: string): string {
  return `${env.APP_URL.replace(/\/$/, '')}/convite/${token}`;
}

export function eventDisplayName(event: Pick<Event, 'title' | 'hostsName'>): string {
  return event.hostsName?.trim() || event.title;
}

export interface InviteMessageContext {
  guest: Pick<Guest, 'fullName' | 'allowedCompanions'>;
  event: EventWithVenue;
  link: string;
}

/** Texto plano usado no WhatsApp e como fallback do e-mail. */
export function buildWhatsAppInviteText({ guest, event, link }: InviteMessageContext): string {
  const firstName = guest.fullName.split(' ')[0] ?? guest.fullName;
  const venueLine = event.venue
    ? `${event.venue.name} — ${event.venue.address}${event.venue.number ? `, ${event.venue.number}` : ''}, ${event.venue.city}`
    : 'Local a confirmar';

  return [
    `Olá, ${firstName}! ❤️`,
    '',
    `Você foi convidado(a) para ${eventDisplayName(event)}.`,
    '',
    `📅 ${formatLongDate(event.eventDate)}`,
    `⏰ ${event.startTime}`,
    `📍 ${venueLine}`,
    '',
    `Você possui autorização para até ${guest.allowedCompanions} ${guest.allowedCompanions === 1 ? 'pessoa' : 'pessoas'
    }.`,
    '',
    'Acesse seu convite e confirme sua presença:',
    link,
    '',
    'Esperamos você!',
  ].join('\n');
}

/** Assunto do e-mail. */
export function buildInviteEmailSubject(event: EventWithVenue): string {
  return `Você está convidado para ${eventDisplayName(event)} ❤️`;
}

/** Corpo HTML do e-mail (compatível com clientes de e-mail). */
export function buildInviteEmailHtml({ guest, event, link }: InviteMessageContext): string {
  const firstName = guest.fullName.split(' ')[0] ?? guest.fullName;
  const venueLine = event.venue
    ? `${event.venue.name}<br/>${event.venue.address}${event.venue.number ? `, ${event.venue.number}` : ''}${event.venue.neighborhood ? ` — ${event.venue.neighborhood}` : ''
    }<br/>${event.venue.city}/${event.venue.state}`
    : 'Local a confirmar';

  const cover = event.coverImageUrl
    ? `<img src="${event.coverImageUrl}" alt="" style="width:100%;max-width:560px;border-radius:12px" />`
    : '';

  return `<!doctype html>
<html lang="pt-BR">
 <body style="margin:0;padding:24px;background:#faf7f2;font-family:Georgia,'Times New Roman',serif;color:#2c2620">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0"
                 style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;
                        box-shadow:0 10px 30px rgba(44,38,32,.08)">
            <tr>
              <td style="padding:32px 32px 8px;text-align:center">
                <p style="letter-spacing:.28em;text-transform:uppercase;font-size:11px;color:#a8907a;margin:0 0 12px">
                  Celebrai
                </p>
                <h1 style="font-size:30px;line-height:1.2;margin:0 0 8px;font-weight:400">
                  ${eventDisplayName(event)}
                </h1>
                <p style="font-size:15px;color:#6b6055;margin:0 0 20px">
                  ${event.inviteMessage ?? 'Estamos muito felizes em compartilhar esse momento especial com você.'}
                </p>
              </td>
            </tr>
            ${cover ? `<tr><td style="padding:0 32px">${cover}</td></tr>` : ''}
            <tr>
              <td style="padding:24px 32px">
                <p style="font-size:17px;margin:0 0 16px">Olá, ${firstName}! ❤️</p>
                <p style="font-size:15px;color:#6b6055;margin:0 0 20px">
                  Você foi convidado(a) para celebrar este dia conosco.
                </p>
                <table role="presentation" width="100%" style="border-top:1px solid #eee5d9;padding-top:16px">
                  <tr><td style="padding:6px 0;font-size:14px;color:#a8907a;width:110px">DATA</td>
                      <td style="padding:6px 0;font-size:15px">${formatLongDate(event.eventDate)}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#a8907a">HORÁRIO</td>
                      <td style="padding:6px 0;font-size:15px">${event.startTime}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#a8907a;vertical-align:top">LOCAL</td>
                      <td style="padding:6px 0;font-size:15px">${venueLine}</td></tr>
                  <tr><td style="padding:6px 0;font-size:14px;color:#a8907a">AUTORIZAÇÃO</td>
                      <td style="padding:6px 0;font-size:15px">até ${guest.allowedCompanions} ${guest.allowedCompanions === 1 ? 'pessoa' : 'pessoas'
    }</td></tr>
                </table>
                <div style="text-align:center;padding:28px 0 8px">
                  <a href="${link}"
                     style="display:inline-block;background:#8c6b4f;color:#fff;text-decoration:none;
                            padding:15px 34px;border-radius:999px;font-size:15px;letter-spacing:.06em">
                    VER MEU CONVITE
                  </a>
                </div>
                <p style="font-size:12px;color:#9a8f83;text-align:center;margin:18px 0 0">
                  Se o botão não funcionar, copie e cole este endereço:<br/>
                  <a href="${link}" style="color:#8c6b4f">${link}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 32px;border-top:1px solid #eee5d9">
                <p style="font-size:11px;color:#9a8f83;margin:0;line-height:1.6">
                  Este link é pessoal e intransferível. Seus dados são tratados apenas para a
                  organização deste evento, conforme a LGPD.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
 </body>
</html>`;
}

/** Assunto/corpo usados no compartilhamento genérico (link). */
export function buildShareText(event: EventWithVenue, link: string): string {
  return `${eventDisplayName(event)} — ${formatShortDate(event.eventDate)} às ${event.startTime}\n${link}`;
}
