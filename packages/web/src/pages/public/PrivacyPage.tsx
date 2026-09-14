import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Shield } from 'lucide-react';

/**
 * Política de privacidade (LGPD).
 *
 * Explica, em linguagem simples, quais dados o Celebrai trata, para quê, por
 * quanto tempo e como o titular pode exercer seus direitos.
 */
export function PrivacyPage() {
  return (
    <div className="invite-theme min-h-screen px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-2xl">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-wedding-500 transition-colors hover:text-wedding-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <header className="mt-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border-wedding-200 bg-white/70 text-wedding-600">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="mt-4 font-display text-3xl font-light text-wedding-900">
            Política de Privacidade
          </h1>
          <p className="mt-2 text-xs uppercase tracking-widest text-wedding-400">
            Versão 1.0 · Lei Geral de Proteção de Dados (Lei 13.709/2018)
          </p>
          <div className="divider-gold my-7" />
        </header>

        <div className="space-y-8">
          <Section title="1. Quais dados coletamos">
            <p>
              Coletamos apenas os dados necessários para organizar o evento e controlar a entrada:
            </p>
            <ul className="mt-3 space-y-2">
              <Item>
                <strong>Identificação:</strong> nome completo do convidado e dos acompanhantes.
              </Item>
              <Item>
                <strong>Contato:</strong> e-mail e número de WhatsApp, usados para enviar o convite
                e comunicações do evento.
              </Item>
              <Item>
                <strong>CPF:</strong> informado voluntariamente no momento da confirmação de
                presença, para validação na portaria.
              </Item>
              <Item>
                <strong>Registros de acesso:</strong> data, horário e operador responsável pelo
                check-in.
              </Item>
            </ul>
          </Section>

          <Section title="2. Para que usamos os dados">
            <ul className="space-y-2">
              <Item>Enviar o convite individual e o QR Code de entrada.</Item>
              <Item>Registrar e acompanhar as confirmações de presença (RSVP).</Item>
              <Item>Controlar a quantidade de acompanhantes autorizados.</Item>
              <Item>Validar a entrada no dia do evento e evitar uso indevido do convite.</Item>
              <Item>Manter a trilha de auditoria das ações administrativas.</Item>
            </ul>
          </Section>

          <Section title="3. Como protegemos o CPF">
            <p>
              O CPF é tratado como dado pessoal sensível dentro desta aplicação:
            </p>
            <ul className="mt-3 space-y-2">
              <Item>
                É armazenado de forma irreversível (hash criptográfico) — o valor original não pode
                ser recuperado do banco de dados.
              </Item>
              <Item>
                No painel administrativo, é exibido apenas de forma mascarada (por exemplo,{' '}
                <code className="rounded bg-wedding-100 px-1.5 py-0.5 font-mono text-xs">
                  ***.***.***-42
                </code>
                ).
              </Item>
              <Item>
                O QR Code <strong>nunca</strong> contém o CPF nem qualquer dado pessoal: ele carrega
                apenas um identificador opaco, validado exclusivamente no servidor.
              </Item>
            </ul>
          </Section>

          <Section title="4. Compartilhamento">
            <p>
              Seus dados <strong>não são vendidos</strong> nem compartilhados para fins de marketing.
              O acesso é restrito aos administradores do evento e à equipe de recepção, e apenas
              para as finalidades descritas acima.
            </p>
          </Section>

          <Section title="5. Por quanto tempo guardamos">
            <p>
              Os dados são mantidos durante a organização do evento e por um período limitado após a
              sua realização, para fins de prestação de contas. Depois disso, são excluídos ou
              anonimizados.
            </p>
          </Section>

          <Section title="6. Seus direitos">
            <p>Como titular dos dados, você pode solicitar a qualquer momento:</p>
            <ul className="mt-3 space-y-2">
              <Item>Confirmação da existência de tratamento e acesso aos dados.</Item>
              <Item>Correção de dados incompletos, inexatos ou desatualizados.</Item>
              <Item>Anonimização, bloqueio ou eliminação de dados desnecessários.</Item>
              <Item>Informação sobre compartilhamentos realizados.</Item>
              <Item>Revogação do consentimento e eliminação dos dados.</Item>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato com os organizadores do evento.
            </p>
          </Section>

          <Section title="7. Segurança">
            <p>
              A aplicação utiliza conexão criptografada (HTTPS em produção), senhas com hash,
              controle de permissões por perfil, limitação de requisições, validação de todas as
              entradas e registro de auditoria das ações relevantes.
            </p>
          </Section>
        </div>

        <footer className="mt-12 flex items-center justify-center gap-2 border-t border-wedding-200 pt-6 text-xs text-wedding-400">
          <Lock className="h-3.5 w-3.5" />
          Celebrai — seus dados protegidos, do convite à entrada.
        </footer>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl text-wedding-800">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-wedding-700">{children}</div>
    </section>
  );
}

function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5 text-sm leading-relaxed text-wedding-700">
      <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gold-400" />
      <span>{children}</span>
    </li>
  );
}
