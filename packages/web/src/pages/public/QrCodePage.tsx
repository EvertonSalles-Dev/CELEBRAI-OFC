import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CalendarHeart,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Users,
  XCircle,
} from 'lucide-react';
import { publicApi } from '@/services/api';
import { ApiRequestError } from '@/lib/api-client';
import { formatDateTime, formatInviteDate, plural } from '@/lib/format';
import { QrCodeViewer } from '@/components/ui/QrCodeViewer';
import { LoadingState } from '@/components/ui/States';

/**
 * Página do QR Code do convidado.
 *
 * Exibida após a confirmação. Traz o QR Code (identificador opaco, sem dados
 * pessoais), os dados de identificação do convite e o registro de check-in
 * quando já ocorreu. O convidado pode salvar, imprimir ou compartilhar.
 */
export function QrCodePage() {
  const { token } = useParams<{ token: string }>();

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public', 'qrcode', token],
    queryFn: () => publicApi.getQrCode(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="invite-theme flex min-h-screen items-center justify-center">
        <LoadingState label="Gerando seu QR Code..." />
      </div>
    );
  }

  if (error || !data) {
    const message =
      error instanceof ApiRequestError
        ? error.message
        : 'Não foi possível carregar seu QR Code.';

    return (
      <div className="invite-theme flex min-h-screen items-center justify-center px-5">
        <div className="card-invite max-w-md px-8 py-10 text-center">
          <div className="mx-auto w-fit rounded-full bg-warning-100 p-3.5 text-warning-600">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h1 className="mt-5 font-display text-2xl text-wedding-900">QR Code indisponível</h1>
          <p className="mt-3 text-sm leading-relaxed text-wedding-600">{message}</p>
          <Link to={`/convite/${token}`} className="btn-invite mt-6">
            Voltar ao convite
          </Link>
        </div>
      </div>
    );
  }

  const venue = data.event.venue;

  return (
    <div className="invite-theme min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link
          to={`/convite/${token}`}
          className="no-print inline-flex items-center gap-1.5 text-sm text-wedding-500 transition-colors hover:text-wedding-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao convite
        </Link>

        <div className="card-invite mt-6 px-6 py-8 text-center sm:px-8">
          {/* Cabeçalho de status */}
          <div className="flex flex-col items-center">
            {data.alreadyCheckedIn ? (
              <div className="rounded-full bg-blue-100 p-3 text-blue-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            ) : (
              <div className="rounded-full bg-success-100 p-3 text-success-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
            )}

            <p className="label-invite mt-4">
              {data.alreadyCheckedIn ? 'Entrada registrada' : 'Presença confirmada'}
            </p>

            <h1 className="mt-2 font-display text-2xl font-light text-wedding-900">
              {data.guest.name}
            </h1>

            <p className="mt-1 text-sm text-wedding-500">{data.event.title}</p>
          </div>

          <div className="divider-gold my-6" />

          {/* QR Code */}
          {data.code ? (
            <>
              <QrCodeViewer value={data.code} guestName={data.guest.name} size={230} />

              <p className="no-print mt-6 text-sm leading-relaxed text-wedding-600">
                Apresente este QR Code na entrada do evento. Ele é pessoal e intransferível.
              </p>
            </>
          ) : (
            <div className="rounded-2xl border-warning-200 bg-warning-50 p-5 text-sm text-warning-700">
              O QR Code será liberado após a confirmação de presença.
            </div>
          )}

          {/* Dados do convite */}
          <dl className="mt-8 space-y-3 border-t border-wedding-200 pt-6 text-left">
            <InfoRow icon={CalendarHeart} label="Data">
              {formatInviteDate(data.event.date)}
            </InfoRow>

            <InfoRow icon={Clock} label="Horário">
              {data.event.startTime}
            </InfoRow>

            <InfoRow icon={Users} label="Pessoas autorizadas">
              {data.guest.allowedCompanions}{' '}
              {plural(data.guest.allowedCompanions, 'pessoa', 'pessoas')}
              {data.guest.attendingCount
                ? ` · ${data.guest.attendingCount} confirmada(s)`
                : ''}
            </InfoRow>

            {venue && (
              <InfoRow icon={MapPin} label="Local">
                {venue.name}
                <br />
                <span className="text-wedding-500">
                  {venue.address}
                  {venue.number ? `, ${venue.number}` : ''} — {venue.city}/{venue.state}
                </span>
              </InfoRow>
            )}

            {data.alreadyCheckedIn && data.lastCheckInAt && (
              <InfoRow icon={CheckCircle2} label="Check-in realizado">
                {formatDateTime(data.lastCheckInAt)}
              </InfoRow>
            )}
          </dl>

          {/* Aviso de duplicidade */}
          {!data.alreadyCheckedIn && (
            <div className="no-print mt-6 flex items-start gap-2 rounded-2xl border-wedding-200 bg-wedding-50 px-4 py-3 text-left text-xs leading-relaxed text-wedding-600">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                Este código só pode ser utilizado uma vez. Se precisar reenviá-lo, use o botão
                compartilhar — nunca publique em redes sociais.
              </span>
            </div>
          )}
        </div>

        {/* Rodapé de impressão */}
        <div className="print-only mt-6 hidden text-center text-xs text-wedding-500">
          Convite pessoal e intransferível — apresente este documento na entrada.
        </div>

        <p className="no-print mt-8 text-center text-[11px] leading-relaxed text-wedding-400">
          <XCircle className="mr-1 inline h-3 w-3" />
          Este QR Code não contém seu CPF nem qualquer dado pessoal — apenas um identificador seguro
          validado no servidor.
        </p>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-wedding-400" />
      <div className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wider text-wedding-400">{label}</dt>
        <dd className="mt-0.5 text-sm text-wedding-800">{children}</dd>
      </div>
    </div>
  );
}
