import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Heart,
  Info,
  Minus,
  Plus,
  Shield,
  Users,
  XCircle,
} from 'lucide-react';
import { publicApi } from '@/services/api';
import { ApiRequestError } from '@/lib/api-client';
import {
  declineFormSchema,
  formatCpfInput,
  formatPhoneInput,
  rsvpFormSchema,
  type DeclineForm,
  type RsvpForm,
} from '@/lib/validators';
import { firstName, plural } from '@/lib/format';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Field';
import { LoadingState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';

/**
 * Confirmação de presença (RSVP) — área do convidado.
 *
 * Regras aplicadas no formulário (e revalidadas no servidor):
 *  - CPF com dígitos verificadores válidos;
 *  - telefone brasileiro válido;
 *  - quantidade NUNCA ultrapassa o limite autorizado pelo organizador;
 *  - consentimento LGPD obrigatório.
 *
 * O fluxo pode ser iniciado com `?decline=1` para registrar a recusa.
 */
export function RsvpPage() {
  const { token } = useParams<{ token: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const declineMode = searchParams.get('decline') === '1';

  const {
    data,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['public', 'invitation', token],
    queryFn: () => publicApi.getInvitation(token as string),
    enabled: Boolean(token),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="invite-theme flex min-h-screen items-center justify-center">
        <LoadingState label="Carregando seu convite..." />
      </div>
    );
  }

  if (error || !data) {
    const isNotFound = error instanceof ApiRequestError && error.status === 404;

    return (
      <div className="invite-theme flex min-h-screen items-center justify-center px-5">
        <div className="card-invite max-w-md px-8 py-10 text-center">
          <XCircle className="mx-auto h-9 w-9 text-wedding-400" />
          <h1 className="mt-4 font-display text-2xl text-wedding-900">
            {isNotFound ? 'Convite não encontrado' : 'Erro ao carregar'}
          </h1>
          <p className="mt-3 text-sm text-wedding-600">
            {isNotFound
              ? 'Este link é inválido ou expirou. Solicite um novo convite aos noivos.'
              : 'Tente novamente em alguns instantes.'}
          </p>
        </div>
      </div>
    );
  }

  // Já respondeu: encaminha para a tela correta em vez de permitir nova resposta.
  if (data.invitation.status === 'CONFIRMED' || data.invitation.status === 'CHECKED_IN') {
    return <AlreadyResponded token={token as string} answered="confirmed" />;
  }

  if (data.invitation.status === 'DECLINED') {
    return <AlreadyResponded token={token as string} answered="declined" />;
  }

  if (!data.rsvpOpen) {
    return (
      <div className="invite-theme flex min-h-screen items-center justify-center px-5">
        <div className="card-invite max-w-md px-8 py-10 text-center">
          <AlertCircle className="mx-auto h-9 w-9 text-warning-500" />
          <h1 className="mt-4 font-display text-2xl text-wedding-900">Prazo encerrado</h1>
          <p className="mt-3 text-sm text-wedding-600">
            O prazo para confirmação de presença já passou. Entre em contato com os noivos.
          </p>
          <Link to={`/convite/${token}`} className="btn-invite mt-6">
            Voltar ao convite
          </Link>
        </div>
      </div>
    );
  }

  return declineMode ? (
    <DeclineView token={token as string} hostsName={data.event.hostsName ?? data.event.title} />
  ) : (
    <RsvpFormView
      token={token as string}
      allowedCompanions={data.invitation.guest.allowedCompanions}
      defaultName={data.invitation.guest.fullName}
      hostsName={data.event.hostsName ?? data.event.title}
      onConfirmed={() => {
        toast.success('Presença confirmada!', 'Seu QR Code de entrada já está disponível.');
        navigate(`/convite/${token}/qrcode`, { replace: true });
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Formulário de confirmação
// ---------------------------------------------------------------------------

function RsvpFormView({
  token,
  allowedCompanions,
  defaultName,
  hostsName,
  onConfirmed,
}: {
  token: string;
  allowedCompanions: number;
  defaultName: string;
  hostsName: string;
  onConfirmed: () => void;
}) {
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RsvpForm>({
    resolver: zodResolver(rsvpFormSchema),
    defaultValues: {
      fullName: defaultName,
      cpf: '',
      phone: '',
      email: '',
      attendingCount: 1,
      companions: [],
      message: '',
      consent: false as unknown as true,
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'companions' });

  const attendingCount = watch('attendingCount');
  const companions = watch('companions');

  // Ajusta a lista de acompanhantes para manter consistência com a quantidade.
  const handleCountChange = (next: number) => {
    const clamped = Math.max(1, Math.min(allowedCompanions, next));
    setValue('attendingCount', clamped, { shouldValidate: true });

    const needed = clamped - 1;
    const current = companions?.length ?? 0;

    if (needed > current) {
      for (let index = current; index < needed; index += 1) append({ name: '' });
    } else if (needed < current) {
      for (let index = current - 1; index >= needed; index -= 1) remove(index);
    }
  };

  const mutation = useMutation({
    mutationFn: (values: RsvpForm) =>
      publicApi.confirm(token, {
        fullName: values.fullName,
        cpf: values.cpf.replace(/\D+/g, ''),
        phone: values.phone,
        email: values.email,
        attendingCount: values.attendingCount,
        companions: (values.companions ?? []).filter((companion) => companion.name.trim()),
        message: values.message || undefined,
        consent: values.consent,
      }),
    onSuccess: onConfirmed,
    onError: (error) => {
      if (error instanceof ApiRequestError) {
        setServerError(error.message);
      } else {
        setServerError('Não foi possível confirmar. Verifique sua conexão e tente novamente.');
      }
    },
  });

  const maxReached = attendingCount >= allowedCompanions;

  return (
    <div className="invite-theme min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-xl">
        <Link
          to={`/convite/${token}`}
          className="inline-flex items-center gap-1.5 text-sm text-wedding-500 transition-colors hover:text-wedding-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao convite
        </Link>

        <header className="mt-6 text-center">
          <p className="label-invite">Confirmação de presença</p>
          <h1 className="mt-3 font-display text-3xl font-light text-wedding-900">{hostsName}</h1>
          <div className="divider-gold my-6" />
          <p className="text-sm leading-relaxed text-wedding-600">
            Preencha seus dados para confirmarmos sua presença. É rápido e seus dados ficam
            protegidos.
          </p>
        </header>

        {/* Aviso de autorização — sempre visível */}
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border-wedding-200 bg-wedding-50 px-4 py-3 text-sm text-wedding-700">
          <Users className="h-4 w-4 shrink-0 text-wedding-500" />
          <span>
            Você possui autorização para até{' '}
            <strong className="font-semibold">
              {allowedCompanions} {plural(allowedCompanions, 'pessoa', 'pessoas')}
            </strong>
          </span>
        </div>

        <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="mt-8 space-y-5" noValidate>
          <Input
            label="Nome completo"
            variant="invite"
            autoComplete="name"
            placeholder="Como no seu documento"
            error={errors.fullName?.message}
            required
            {...register('fullName')}
          />

          <Input
            label="CPF"
            variant="invite"
            inputMode="numeric"
            placeholder="000.000.000-00"
            error={errors.cpf?.message}
            required
            {...register('cpf', {
              onChange: (event) => {
                event.target.value = formatCpfInput(event.target.value);
              },
            })}
          />

          <Input
            label="Telefone / WhatsApp"
            variant="invite"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(21) 99999-9999"
            error={errors.phone?.message}
            required
            {...register('phone', {
              onChange: (event) => {
                event.target.value = formatPhoneInput(event.target.value);
              },
            })}
          />

          <Input
            label="E-mail"
            variant="invite"
            type="email"
            autoComplete="email"
            placeholder="seu@email.com"
            error={errors.email?.message}
            required
            {...register('email')}
          />

          {/* Quantidade de pessoas */}
          <div>
            <p className="mb-2 text-sm font-medium text-wedding-700">
              Quantas pessoas irão comparecer?
            </p>

            <div className="flex items-center gap-4 rounded-2xl border-wedding-200 bg-white/80 px-4 py-3">
              <button
                type="button"
                onClick={() => handleCountChange(attendingCount - 1)}
                disabled={attendingCount <= 1}
                aria-label="Diminuir quantidade"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-wedding-200 text-wedding-700 transition-colors hover:bg-wedding-50 disabled:opacity-40"
              >
                <Minus className="h-4 w-4" />
              </button>

              <div className="flex flex-1 text-center">
                <p className="font-display text-3xl tabular-nums text-wedding-900">
                  {attendingCount}
                </p>
                <p className="text-xs text-wedding-500">
                  {plural(attendingCount, 'pessoa', 'pessoas')}
                  {attendingCount > 1 ? ' (você + acompanhantes)' : ' (somente você)'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleCountChange(attendingCount + 1)}
                disabled={maxReached}
                aria-label="Aumentar quantidade"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-wedding-200 text-wedding-700 transition-colors hover:bg-wedding-50 disabled:opacity-40"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-2 flex items-start gap-1.5 text-xs text-wedding-500">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {maxReached
                ? `Você já atingiu o limite autorizado de ${allowedCompanions} ${plural(allowedCompanions, 'pessoa', 'pessoas')}.`
                : `Ainda é possível adicionar mais ${allowedCompanions - attendingCount} ${plural(allowedCompanions - attendingCount, 'pessoa', 'pessoas')}.`}
            </p>

            {errors.attendingCount?.message && (
              <p className="field-error">{errors.attendingCount.message}</p>
            )}
          </div>

          {/* Nomes dos acompanhantes */}
          {fields.length > 0 && (
            <div className="space-y-3 rounded-2xl border-wedding-200 bg-white/60 p-4">
              <p className="text-sm font-medium text-wedding-700">
                Nome dos acompanhantes
                <span className="ml-1 font-normal text-wedding-400">(opcional, agiliza a entrada)</span>
              </p>

              {fields.map((field, index) => (
                <Input
                  key={field.id}
                  variant="invite"
                  placeholder={`Acompanhante ${index + 1}`}
                  error={errors.companions?.[index]?.name?.message}
                  {...register(`companions.${index}.name` as const)}
                />
              ))}
            </div>
          )}

          <Textarea
            label="Mensagem para os noivos (opcional)"
            variant="invite"
            placeholder="Deixe uma mensagem carinhosa..."
            rows={3}
            error={errors.message?.message}
            {...register('message')}
          />

          {/* Consentimento LGPD */}
          <div className="rounded-2xl border-wedding-200 bg-white/70 p-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm text-wedding-700">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 rounded border-wedding-300 text-wedding-700 focus:ring-wedding-500/30"
                {...register('consent')}
              />
              <span className="leading-relaxed">
                Autorizo o uso dos meus dados exclusivamente para a organização deste evento
                (confirmação de presença e controle de entrada), conforme a LGPD.{' '}
                <Link to="/privacidade" className="underline hover:text-wedding-900">
                  Política de privacidade
                </Link>
              </span>
            </label>
            {errors.consent?.message && <p className="field-error">{errors.consent.message}</p>}
          </div>

          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-2xl border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{serverError}</span>
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button
              type="submit"
              variant="invite"
              size="touch"
              loading={isSubmitting || mutation.isPending}
              icon={<CheckCircle2 className="h-5 w-5" />}
              className="w-full"
            >
              Confirmar presença
            </Button>

            <Link
              to={`/convite/${token}/confirmacao?decline=1`}
              className="block py-2 text-center text-sm text-wedding-500 underline decoration-wedding-300 underline-offset-4 transition-colors hover:text-wedding-700"
            >
              Não poderei comparecer
            </Link>
          </div>
        </form>

        <p className="mt-8 flex items-start justify-center gap-2 text-center text-[11px] leading-relaxed text-wedding-400">
          <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Seus dados são protegidos e utilizados apenas para este evento. O CPF é usado somente na
          validação da entrada e nunca é exibido publicamente.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Recusa de presença
// ---------------------------------------------------------------------------

function DeclineView({ token, hostsName }: { token: string; hostsName: string }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<DeclineForm>({
    resolver: zodResolver(declineFormSchema),
    defaultValues: { reason: '' },
  });

  const mutation = useMutation({
    mutationFn: (values: DeclineForm) => publicApi.decline(token, { reason: values.reason || undefined }),
    onSuccess: () => {
      toast.info('Resposta registrada', 'Obrigado por nos avisar.');
      navigate(`/convite/${token}`, { replace: true });
    },
    onError: () => {
      setServerError('Não foi possível registrar sua resposta. Tente novamente.');
    },
  });

  return (
    <div className="invite-theme min-h-screen px-5 py-10 sm:px-8">
      <div className="mx-auto max-w-lg">
        <Link
          to={`/convite/${token}/confirmacao`}
          className="inline-flex items-center gap-1.5 text-sm text-wedding-500 transition-colors hover:text-wedding-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="card-invite mt-8 px-6 py-8 text-center sm:px-8">
          <div className="mx-auto w-fit rounded-full bg-wedding-100 p-3.5 text-wedding-500">
            <XCircle className="h-8 w-8" />
          </div>

          <h1 className="mt-5 font-display text-2xl font-light text-wedding-900">
            Sentiremos sua falta
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-wedding-600">
            Vamos avisar {hostsName} que você não poderá comparecer. Se quiser, deixe uma mensagem.
          </p>

          <form onSubmit={handleSubmit((values) => mutation.mutate(values))} className="mt-6 text-left">
            <Textarea
              label="Mensagem (opcional)"
              variant="invite"
              rows={3}
              placeholder="Ex.: Estaremos viajando nessa data, mas desejamos toda a felicidade!"
              error={errors.reason?.message}
              {...register('reason')}
            />

            {serverError && (
              <p className="field-error mt-3" role="alert">
                {serverError}
              </p>
            )}

            <Button
              type="submit"
              variant="invite-outline"
              size="touch"
              loading={isSubmitting || mutation.isPending}
              className="mt-6 w-full"
            >
              Confirmar que não poderei ir
            </Button>
          </form>
        </div>

        <p className="mt-8 text-center text-[11px] text-wedding-400">
          <Heart className="mr-1 inline h-3 w-3 text-gold-400" fill="currentColor" />
          {firstName(hostsName)} e família agradecem sua resposta.
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Já respondeu
// ---------------------------------------------------------------------------

function AlreadyResponded({ token, answered }: { token: string; answered: 'confirmed' | 'declined' }) {
  return (
    <div className="invite-theme flex min-h-screen items-center justify-center px-5">
      <div className="card-invite max-w-md px-8 py-10 text-center">
        {answered === 'confirmed' ? (
          <>
            <div className="mx-auto w-fit rounded-full bg-success-100 p-3.5 text-success-600">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-2xl text-wedding-900">Presença já confirmada</h1>
            <p className="mt-3 text-sm text-wedding-600">
              Sua resposta já foi registrada. Apresente seu QR Code na entrada do evento.
            </p>
            <Link to={`/convite/${token}/qrcode`} className="btn-invite mt-6">
              Ver meu QR Code
            </Link>
          </>
        ) : (
          <>
            <div className="mx-auto w-fit rounded-full bg-wedding-100 p-3.5 text-wedding-500">
              <XCircle className="h-8 w-8" />
            </div>
            <h1 className="mt-5 font-display text-2xl text-wedding-900">Resposta registrada</h1>
            <p className="mt-3 text-sm text-wedding-600">
              Registramos que você não poderá comparecer. Se isso mudar, fale com os noivos.
            </p>
          </>
        )}

        <Link to={`/convite/${token}`} className="mt-4 block text-sm text-wedding-500 underline">
          Voltar ao convite
        </Link>
      </div>
    </div>
  );
}
