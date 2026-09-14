# 💛 Celebrai

**Convites inteligentes. Eventos mais organizados.**

Plataforma completa para gestão de convidados, confirmação de presença (RSVP),
QR Code individual e controle de entrada em eventos — com painel administrativo,
área do convidado e modo portaria para o dia do evento.

---

## Sumário

- [O que é](#o-que-é)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Como rodar](#como-rodar)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Fluxo do produto](#fluxo-do-produto)
- [API](#api)
- [Segurança](#segurança)
- [LGPD](#lgpd)
- [Banco de dados](#banco-de-dados)
- [Testes](#testes)
- [Deploy](#deploy)
- [Credenciais de demonstração](#credenciais-de-demonstração)

---

## O que é

O Celebrai transforma o convite em uma **credencial digital** para o evento. O
organizador cadastra os convidados, o sistema gera links individuais, o convidado
confirma presença e recebe um QR Code exclusivo. No dia do evento, a equipe do
salão lê o QR Code e o backend decide, sozinho, se a entrada está autorizada.

Existem **quatro perfis de acesso**:

| Perfil | Pode fazer |
|---|---|
| **Super Admin** | Gerencia a plataforma, cria usuários, vê todos os eventos |
| **Administrador do evento** | Gerencia o evento, convidados, convites, local e check-in |
| **Recepção** | **Somente** o controle de entrada (não edita nem exclui nada) |
| **Convidado** | Acessa o próprio convite por link exclusivo, confirma/recusa e vê o QR Code |

---

## Funcionalidades

### Área do convidado
- Convite digital elegante e responsivo (tipografia serifada, paleta dourada)
- Foto de capa, nome dos anfitriões, **contagem regressiva ao vivo**
- Local completo com **mapa incorporado**, "Como chegar" (Google Maps) e Waze
- Informações da cerimônia e da recepção, dress code e lista de presentes
- Galeria de fotos com fallback elegante quando a imagem não carrega
- **RSVP** com validação de CPF (dígitos verificadores) e telefone brasileiro
- Controle automático de acompanhantes — **nunca ultrapassa o limite autorizado**
- QR Code após a confirmação, com salvar / imprimir / compartilhar
- Registro de consentimento (LGPD) no ato da resposta

### Painel administrativo
- Dashboard com convidados, confirmados, pendentes, recusados, presentes e ausentes
- **Gráficos**: confirmações por dia e check-ins por horário (blocos de 30 min)
- CRUD completo de eventos, convidados e local
- Tabela de convidados com pesquisa, filtros, ordenação e paginação
- **Importação de CSV** com prévia, validação linha a linha e detecção de duplicidade
- **Exportação** da lista em CSV (com BOM, abre certo no Excel)
- Envio de convites por **e-mail**, **WhatsApp** (API oficial) ou link copiável
- Visualização do QR Code de cada convidado confirmado
- Cancelar e reabrir convites
- **Trilha de auditoria** com quem fez o quê, quando, de qual IP

### Controle de entrada (portaria)
- Scanner de QR Code pela câmera do celular (câmera traseira)
- Contadores em tempo real (entradas, pessoas, esperados)
- Resultado em **tela cheia colorida**: verde (autorizado), vermelho (negado),
  amarelo (alerta)
- Feedback sonoro opcional
- **Bloqueio de reutilização**: o mesmo QR Code não entra duas vezes
- **Autorização manual** (só admin) com motivo obrigatório e registro em auditoria
- Busca por nome como fallback
- Detecção de perda de conexão — **nunca libera entrada sem validação do servidor**

---

## Stack

**Frontend**
- React 18 + TypeScript + Vite
- Tailwind CSS (design system próprio)
- React Router · TanStack Query · React Hook Form · Zod
- Lucide Icons · `qrcode` (geração) · `html5-qrcode` (leitura)

**Backend**
- Node.js + TypeScript + Fastify
- Prisma ORM + PostgreSQL
- JWT + Refresh Token rotativo · bcrypt
- Zod (validação) · Helmet · rate limiting · CORS por allowlist
- Nodemailer (e-mail) · WhatsApp Business Cloud API (oficial)

**Infraestrutura**
- Docker + Docker Compose
- Nginx servindo o SPA com proxy para a API
- Variáveis de ambiente separadas por contexto

---

## Arquitetura

```
celebrai/
├── packages/
│   ├── api/                          # Backend (Fastify + Prisma)
│   │   ├── prisma/
│   │   │   ├── schema.prisma         # PostgreSQL (produção)
│   │   │   ├── migrations/           # Migration inicial
│   │   │   └── seed.ts               # Dados de demonstração
│   │   ├── scripts/
│   │   │   └── set-provider.mjs      # Gera schema SQLite p/ dev local
│   │   └── src/
│   │       ├── config/               # env, prisma, logger, permissões
│   │       ├── controllers/          # auth, event, guest, invitation,
│   │       │                         # checkin, public
│   │       ├── services/             # regras de domínio
│   │       │   └── providers/        # e-mail (SMTP), WhatsApp (Cloud API)
│   │       ├── plugins/              # autenticação JWT + RBAC
│   │       ├── routes/               # mapa de rotas
│   │       ├── schemas/              # validação Zod das entradas
│   │       ├── shared/               # erros, http, tokens, brasil, datas
│   │       └── app.ts / server.ts
│   │
│   └── web/                          # Frontend (React + Vite)
│       └── src/
│           ├── components/
│           │   ├── ui/               # Design System (Button, Field, Modal,
│           │   │                     # Toast, States, StatCard, QrCodeViewer,
│           │   │                     # QrScanner)
│           │   └── layout/           # AdminLayout, ProtectedRoute
│           ├── hooks/                # useApi (TanStack Query), useSession,
│           │                         # useOnlineStatus, useFeedbackSound
│           ├── lib/                  # api-client, validators, format
│           ├── pages/
│           │   ├── public/           # convite, RSVP, QR Code, privacidade
│           │   ├── admin/            # login, dashboard, eventos, convidados...
│           │   └── checkin/          # portaria (home + scanner)
│           ├── services/api.ts       # endpoints organizados por domínio
│           └── types/                # contrato com a API
│
├── tools/                            # QA e utilitários de desenvolvimento
├── docker-compose.yml                # Stack completa (produção)
├── docker-compose.dev.yml            # Postgres + MailHog para desenvolvimento
└── .env.example
```

**Princípios aplicados**
- Nenhum componente React faz `fetch` direto: tudo passa por `services/api.ts`
- Toda URL da API vive em um único lugar (`lib/api-client.ts`)
- Regras de negócio ficam nos `services` e `controllers`, não nos componentes
- Validação nas duas pontas com as mesmas regras (Zod no back e no front)
- Tipos compartilhados manualmente, sem acoplar o front ao pacote do back

---

## Como rodar

### Pré-requisitos

- Node.js 20+
- PostgreSQL 16 **ou** Docker

### Opção 1 — Docker (recomendado)

Sobe banco, API e front prontos:

```bash
cp .env.example .env          # ajuste os segredos
docker compose up --build
```

| Serviço | URL |
|---|---|
| Aplicação | http://localhost:8080 |
| API | http://localhost:3333/api |
| Healthcheck | http://localhost:3333/api/health |

Para popular com dados de demonstração:

```bash
docker compose exec api npx tsx prisma/seed.ts
```

### Opção 2 — Desenvolvimento local

```bash
# 1. Dependências
npm install

# 2. Banco de dados (apenas o Postgres via Docker)
docker compose -f docker-compose.dev.yml up -d db

# 3. Variáveis de ambiente
cp .env.example packages/api/.env
cp packages/web/.env.example packages/web/.env

# 4. Aplicar migrations e popular
cd packages/api
npm run db:migrate
npm run db:seed
cd ../..

# 5. Subir API + front em paralelo
npm run dev
```

| Serviço | URL |
|---|---|
| Frontend | http://localhost:5173 |
| API | http://localhost:3333/api |
| MailHog (e-mails) | http://localhost:8025 |

### Opção 3 — Sem PostgreSQL instalado

O projeto consegue rodar em **SQLite** para desenvolvimento, gerando um schema
derivado a partir do schema de produção:

```bash
cd packages/api

# Gera prisma/schema.dev.prisma (converte enums/arrays/Json para o SQLite)
node scripts/set-provider.mjs sqlite

# .env
#   DATABASE_URL="file:./dev.db"
#   DATABASE_PROVIDER=sqlite

npx prisma db push --schema prisma/schema.dev.prisma
npx prisma generate --schema prisma/schema.dev.prisma
npm run db:seed

# Para voltar ao PostgreSQL
node scripts/set-provider.mjs postgresql
```

> O schema de produção **nunca** é alterado por esse comando.

---

## Variáveis de ambiente

Todas as variáveis estão documentadas em [`.env.example`](.env.example).
As principais:

| Variável | Descrição | Padrão |
|---|---|---|
| `DATABASE_URL` | Conexão do banco | — |
| `DATABASE_PROVIDER` | `postgresql` ou `sqlite` | `postgresql` |
| `APP_URL` | URL pública do front (monta os links de convite) | `http://localhost:5173` |
| `JWT_ACCESS_SECRET` | Segredo do access token (**mín. 16 chars**) | — |
| `JWT_REFRESH_SECRET` | Segredo do refresh token (**mín. 16 chars**) | — |
| `INVITATION_TOKEN_SECRET` | Pepper dos tokens de convite e hash de CPF | — |
| `CORS_ORIGINS` | Origens permitidas, separadas por vírgula | `localhost:5173...` |
| `MAIL_DRIVER` | `smtp` ou `disabled` | `disabled` |
| `WHATSAPP_DRIVER` | `cloud_api` ou `disabled` | `disabled` |
| `RATE_LIMIT_MAX` | Limite global por IP | `300` |
| `CHECKIN_RATE_LIMIT_MAX` | Limite do endpoint de check-in | `120` |

> **Em produção**, o servidor **recusa iniciar** se detectar os segredos padrão
> do `.env.example`. Gere valores únicos:
>
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
> ```

### E-mail e WhatsApp sem configuração

Com `MAIL_DRIVER=disabled` e `WHATSAPP_DRIVER=disabled`, o sistema **funciona
normalmente**: os links de convite são gerados e devolvidos na interface para
envio manual, e cada tentativa fica registrada na tabela `notifications`
com status, canal e erro. Nada quebra por falta de credencial.

---

## Fluxo do produto

### Organizador

```
Login → Dashboard → Criar evento → Cadastrar local → Cadastrar convidados
  → (Importar CSV) → Enviar convites (e-mail/WhatsApp/link)
  → Acompanhar confirmações → Ver QR Codes
  → No dia: Controle de entrada → Escanear → Validar → Registrar check-in
```

### Convidado

```
Recebe o link → Abre o convite → Confirma presença → Preenche os dados
  → Sistema valida → QR Code é gerado → Salva o QR Code
  → No dia: apresenta o QR Code → Recepção escaneia → Entrada liberada
```

### Ciclo de vida do convite

```
PENDING ──confirmar──▶ CONFIRMED ──check-in──▶ CHECKED_IN
   │                        │
   └──recusar──▶ DECLINED   └──cancelar──▶ CANCELLED
```

---

## API

Prefixo: `/api`. Formato de resposta:

```jsonc
// sucesso
{ "data": { ... }, "meta": { "page": 1, "total": 250 } }

// erro
{ "error": { "code": "VALIDATION_ERROR", "message": "Dados inválidos", "details": [...] } }
```

### Públicas (área do convidado)

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/public/invitations/:token` | Carrega o convite e os dados do evento |
| `GET` | `/public/invitations/:token/status` | Status atual (polling) |
| `POST` | `/public/invitations/:token/rsvp` | Confirma presença |
| `POST` | `/public/invitations/:token/decline` | Registra recusa |
| `GET` | `/public/invitations/:token/qrcode` | QR Code (após confirmação) |

### Autenticação

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/login` | Login (retorna access token + cookie de refresh) |
| `POST` | `/auth/refresh` | Rotaciona o refresh token |
| `POST` | `/auth/logout` | Revoga a sessão |
| `GET` | `/auth/me` | Usuário autenticado |
| `GET/POST` | `/auth/users` | Gestão de usuários (**Super Admin**) |

### Eventos e recursos

| Método | Rota | Descrição |
|---|---|---|
| `GET/POST` | `/events` | Lista / cria eventos |
| `GET/PATCH/DELETE` | `/events/:id` | Detalhe / atualiza / exclui |
| `PUT` | `/events/:id/venue` | Salva o local |
| `GET` | `/events/:id/dashboard` | Métricas e séries dos gráficos |
| `GET` | `/events/:id/audit` | Trilha de auditoria (paginada) |
| `GET/POST` | `/events/:id/guests` | Lista / cria convidado (**gera o convite**) |
| `POST` | `/events/:id/guests/import` | Importa CSV (`dryRun` para prévia) |
| `GET` | `/events/:id/guests/export` | Exporta CSV |
| `GET/PATCH/DELETE` | `/events/:id/guests/:guestId` | Detalhe / atualiza / exclui |
| `GET` | `/events/:id/invitations` | Lista convites |
| `POST` | `/events/:id/invitations/send` | Envia convites |
| `GET` | `/events/:id/invitations/:invId/link` | Reemite o link |
| `GET` | `/events/:id/invitations/:invId/qrcode` | Emite/consulta o QR Code |
| `POST` | `/events/:id/invitations/:invId/cancel` | Cancela o convite |
| `POST` | `/events/:id/invitations/:invId/reopen` | Reabre o convite |
| `POST` | `/events/:id/check-in/validate` | **Valida o QR Code e registra a entrada** |
| `GET` | `/events/:id/check-in/stats` | Contadores da portaria |
| `GET` | `/events/:id/check-in/search` | Busca convidado por nome |
| `GET` | `/check-in/events` | Eventos disponíveis para o operador |

### Veredictos do check-in

```jsonc
{ "outcome": "AUTHORIZED",      "tone": "success" } // entrada liberada
{ "outcome": "INVALID",         "tone": "danger"  } // código não existe
{ "outcome": "WRONG_EVENT",     "tone": "danger"  } // convite de outro evento
{ "outcome": "CANCELLED",       "tone": "danger"  } // convite cancelado
{ "outcome": "NOT_CONFIRMED",   "tone": "warning" } // não confirmou presença
{ "outcome": "ALREADY_USED",    "tone": "warning" } // já utilizado (permite override)
```

Em `ALREADY_USED`, o campo `canOverride` indica se o operador pode liberar
manualmente — **somente** para `ADMIN` e `SUPER_ADMIN`, com motivo obrigatório.

---

## Segurança

| Medida | Implementação |
|---|---|
| Senhas | bcrypt com custo configurável (`BCRYPT_ROUNDS`, padrão 12) |
| Sessão | Access token JWT curto (15 min) + refresh rotativo (7 dias) |
| **Detecção de reuso de token** | Apresentar refresh revogado invalida **toda a família** de tokens |
| Controle de acesso | RBAC por permissão, aplicado no servidor |
| Escopo de evento | Todo endpoint valida se o usuário pertence ao evento |
| Rate limiting | Global + limites específicos em auth e check-in |
| Headers | Helmet com CSP, HSTS (produção), `nosniff`, frameguard |
| CORS | Allowlist explícita de origens, com log de bloqueios |
| Validação | Zod em **todas** as entradas, antes de tocar no banco |
| Sanitização | Remoção de tags/scripts e caracteres de controle |
| SQL Injection | Impedido pelo Prisma (queries parametrizadas) |
| XSS | Escapamento do React + sanitização na entrada |
| **Tokens de convite** | 192 bits de entropia, persistidos apenas como SHA-256 |
| Logs | Nunca registram token, senha, CPF ou hash de CPF |
| Auditoria | Registro de usuário, ação, data, IP, user-agent e metadados |

### Proteção do CPF

O CPF é dado pessoal sensível e é tratado assim:

1. **Nunca é armazenado em claro** — apenas hash SHA-256 com pepper do servidor
2. **No painel**, aparece somente mascarado: `***.***.***-42`
3. **No QR Code**, não existe — o código carrega só um identificador opaco
4. **Na API pública**, nunca é retornado — nem para o próprio convidado

### QR Code

- Formato legível e sem caracteres ambíguos: `CELEBRAI-XXXXXXXX-XXXX`
- É um **identificador de credencial**, não um segredo de autenticação
- A validação é **sempre no servidor** — o modo offline nunca libera entrada
- Valores conferidos por hash, com comparação em tempo constante

---

## LGPD

- **Minimização**: só são coletados os dados necessários ao evento
- **Finalidade**: dados usados exclusivamente para organização e acesso
- **Consentimento**: registrado em `data_consents`, com IP, user-agent e versão do texto
- **Transparência**: política de privacidade pública em `/privacidade`
- **Segurança**: hash de CPF, mascaramento, controle de acesso, auditoria
- **Eliminação**: exclusão em cascata ao remover convidado ou evento
- **Não compartilhamento**: dados não são vendidos nem usados para marketing

---

## Banco de dados

### Entidades

```
User ──┬── Event ──┬── Venue
       │           ├── Party ── Guest ── Invitation ──┬── InvitationResponse
       │           │                                 ├── CheckIn
       │           │                                 └── DataConsent
       │           ├── EventMember (recepção)
       │           ├── AuditLog
       │           └── Notification
       └── RefreshToken
```

### Comandos

```bash
cd packages/api

npm run db:generate    # Gera o Prisma Client
npm run db:migrate     # Cria/aplica migration (desenvolvimento)
npm run db:deploy      # Aplica migrations (produção)
npm run db:push        # Sincroniza o schema sem migration
npm run db:studio      # Abre o Prisma Studio
npm run db:seed        # Popula dados de demonstração
```

---

## Testes

### Smoke test end-to-end

Exercita o fluxo real contra um servidor rodando — 71 verificações cobrindo
autenticação, RBAC, CRUD, RSVP, validações, QR Code, check-in, duplicidade,
autorização manual, importação, exportação e auditoria.

```bash
# Com a API rodando em http://localhost:3333
node tools/e2e-smoke.mjs
```

### QA no navegador

Verifica as telas renderizando de verdade (console, rede e DOM):

```bash
# Painel administrativo
node tools/qa-admin.mjs

# Área do convidado (convite, RSVP, QR Code)
node tools/qa-guest.mjs

# Controle de entrada
node tools/qa-checkin.mjs

# Auditoria de classes CSS dependentes de classe base
node tools/audit-classes.mjs
```

### Verificação de tipos

```bash
npm run lint           # tsc --noEmit nos dois pacotes
npm run build          # build de produção
```

---

## Deploy

### Produção com Docker

```bash
# 1. Configure os segredos
cp .env.example .env
# Edite .env com valores fortes e o domínio real

# 2. Suba a stack
docker compose up -d --build

# 3. Aplique as migrations
docker compose exec api npx prisma migrate deploy

# 4. (Opcional) Crie o Super Admin
docker compose exec api npx tsx prisma/seed.ts
```

### Checklist de produção

- [ ] `NODE_ENV=production`
- [ ] Segredos JWT com 48+ bytes aleatórios (**o servidor recusa os padrões**)
- [ ] `DATABASE_URL` apontando para o Postgres gerenciado, com SSL
- [ ] `CORS_ORIGINS` apenas com o domínio real
- [ ] `APP_URL` com o domínio público (define os links de convite)
- [ ] HTTPS terminando no proxy/load balancer
- [ ] `MAIL_DRIVER=smtp` com credenciais válidas
- [ ] `WHATSAPP_DRIVER=cloud_api` com token e phone number ID
- [ ] Backup automático do banco
- [ ] Monitoramento e alertas configurados

---

## Credenciais de demonstração

Criadas por `npm run db:seed`:

| Perfil | E-mail | Senha |
|---|---|---|
| Super Admin | `super@celebrai.app` | `SuperAdmin@123` |
| Administrador | `admin@celebrai.app` | `Admin@12345` |
| Recepção | `recepcao@celebrai.app` | `Recepcao@123` |

> ⚠️ **Troque essas senhas antes de qualquer uso real.** O seed também cria o
> evento "Casamento de João & Maria" com 12 convidados em diferentes status,
> grupos/famílias, respostas de RSVP e check-ins — e imprime no terminal um
> link de convite pronto para testar.

---

## Solução de problemas

**`npx` não encontrado no PowerShell**
Ative a política de execução ou use `npx.cmd`:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

**Telas em branco com `grid-cols` / `flex-wrap` sem efeito**
Tailwind exige a classe base. Rode `node tools/audit-classes.mjs` para encontrar
os pontos e adicione `grid` ou `flex`.

**Formulário diz "Required" mesmo com os campos preenchidos**
Os inputs precisam de `forwardRef` para que o React Hook Form registre o campo.
Todo componente de formulário do Design System já segue esse padrão.

**Erro de CORS no console**
Adicione a origem em `CORS_ORIGINS` no `.env` e reinicie a API. O servidor
registra no log qual origem foi bloqueada.

**Fontes do convite não carregam**
O CSP precisa permitir `fonts.googleapis.com` (style-src) e `fonts.gstatic.com`
(font-src). Já configurado em `packages/api/src/app.ts`.

---

<div align="center">

**Celebrai** — Convites inteligentes. Eventos mais organizados. 💛

</div>
