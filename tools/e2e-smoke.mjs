/**
 * Verificação end-to-end da API Celebrai.
 *
 * Exercita o fluxo real do produto contra um servidor em execução:
 *   login → eventos → convidados → envio de convite → RSVP público →
 *   QR Code → check-in → detecção de duplicidade.
 *
 * Uso: node tools/e2e-smoke.mjs [http://localhost:3333]
 */

const BASE = process.argv[2] ?? 'http://localhost:3333';
const API = `${BASE}/api`;

let passed = 0;
let failed = 0;

function check(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

async function request(method, path, { body, token } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { status: response.status, body: json, headers: response.headers };
}

async function main() {
  console.log(`\n🔎 Smoke test da API Celebrai em ${BASE}\n`);

  // -------------------------------------------------------------------------
  console.log('▶ Health & meta');
  const health = await request('GET', '/health');
  check('GET /health responde 200', health.status === 200, `status ${health.status}`);
  check('Serviço se identifica', health.body?.service === 'celebrai-api');

  // -------------------------------------------------------------------------
  console.log('\n▶ Autenticação');
  const badLogin = await request('POST', '/auth/login', {
    body: { email: 'admin@celebrai.app', password: 'senha-errada' },
  });
  check('Login com senha errada é rejeitado (401)', badLogin.status === 401, `status ${badLogin.status}`);

  const login = await request('POST', '/auth/login', {
    body: { email: 'admin@celebrai.app', password: 'Admin@12345' },
  });
  check('Login válido retorna 200', login.status === 200, `status ${login.status}`);
  const token = login.body?.data?.accessToken;
  check('Access token presente', typeof token === 'string' && token.length > 20);
  check('Perfil do usuário é ADMIN', login.body?.data?.user?.role === 'ADMIN');

  // Acesso sem token deve falhar.
  const noAuth = await request('GET', '/events');
  check('Rota protegida sem token retorna 401', noAuth.status === 401, `status ${noAuth.status}`);

  // -------------------------------------------------------------------------
  console.log('\n▶ Eventos');
  const events = await request('GET', '/events', { token });
  check('GET /events com token retorna 200', events.status === 200, `status ${events.status}`);
  const event = events.body?.data?.[0];
  check('Evento de exemplo retornado', Boolean(event?.id));
  check('Evento pertence ao usuário logado', Boolean(event?.ownerId));
  const eventId = event?.id;

  const dashboard = await request('GET', `/events/${eventId}/dashboard`, { token });
  check('Dashboard do evento responde 200', dashboard.status === 200, `status ${dashboard.status}`);
  check(
    'Dashboard traz contadores de convite',
    typeof dashboard.body?.data?.invitations?.total === 'number',
  );
  check(
    'Dashboard traz timeline de check-in',
    Array.isArray(dashboard.body?.data?.checkInTimeline),
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ Convidados');
  const guests = await request('GET', `/events/${eventId}/guests?perPage=50`, { token });
  check('Listagem de convidados responde 200', guests.status === 200, `status ${guests.status}`);
  check('Existem convidados no seed', (guests.body?.data?.length ?? 0) > 0);
  check(
    'Resposta expõe CPF apenas mascarado',
    guests.body?.data?.every?.((g) => !g.invitation?.response?.cpf || g.invitation?.response?.cpfMasked),
  );
  check(
    'Ngm expõe cpfHash',
    guests.body?.data?.every?.((g) => g.invitation?.response?.cpfHash === undefined),
  );

  // Criar convidado novo (gera convite automático).
  const unique = Date.now();
  const newGuest = await request('POST', `/events/${eventId}/guests`, {
    token,
    body: {
      fullName: `Convidado Teste ${unique}`,
      email: `teste.${unique}@email.com`,
      whatsapp: '(21) 98888-7777',
      allowedCompanions: 2,
      partyName: 'Testes Automatizados',
    },
  });
  check('Criação de convidado retorna 201', newGuest.status === 201, `status ${newGuest.status}`);
  check('Convite é gerado automaticamente', Boolean(newGuest.body?.data?.guest?.invitationId));
  const inviteLink = newGuest.body?.data?.inviteLink;
  check('Link do convite é retornado', typeof inviteLink === 'string' && inviteLink.includes('/convite/'));
  const inviteToken = inviteLink?.split('/convite/')[1];
  const newGuestId = newGuest.body?.data?.guest?.id;

  // -------------------------------------------------------------------------
  console.log('\n▶ Área pública do convidado');
  const publicInvite = await request('GET', `/public/invitations/${inviteToken}`);
  check('GET público do convite responde 200', publicInvite.status === 200, `status ${publicInvite.status}`);
  check('Convite traz dados do evento', Boolean(publicInvite.body?.data?.event?.title));
  check(
    'Convite público NÃO expõe CPF',
    !JSON.stringify(publicInvite.body?.data?.invitation ?? {}).includes('cpfHash'),
  );
  check('RSVP está aberto', publicInvite.body?.data?.rsvpOpen === true);

  const invalidTokenInvite = await request('GET', '/public/invitations/token-invalido-xyz');
  check(
    'Token inválido retorna 404',
    invalidTokenInvite.status === 404,
    `status ${invalidTokenInvite.status}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ RSVP — validações');
  const overLimit = await request('POST', `/public/invitations/${inviteToken}/rsvp`, {
    body: {
      fullName: 'Convidado Teste',
      cpf: '52998224725',
      phone: '(21) 98888-7777',
      email: 'teste@email.com',
      attendingCount: 5,
      consent: true,
    },
  });
  check(
    'Confirmar mais pessoas que o autorizado é rejeitado',
    overLimit.status === 422,
    `status ${overLimit.status}`,
  );

  const invalidCpf = await request('POST', `/public/invitations/${inviteToken}/rsvp`, {
    body: {
      fullName: 'Convidado Teste',
      cpf: '11111',
      phone: '(21) 98888-7777',
      email: 'teste@email.com',
      attendingCount: 1,
      consent: true,
    },
  });
  check('CPF inválido é rejeitado (422)', invalidCpf.status === 422, `status ${invalidCpf.status}`);

  const noConsent = await request('POST', `/public/invitations/${inviteToken}/rsvp`, {
    body: {
      fullName: 'Convidado Teste',
      cpf: '52998224725',
      phone: '(21) 98888-7777',
      email: 'teste@email.com',
      attendingCount: 1,
      consent: false,
    },
  });
  check('Ausência de consentimento é rejeitada', noConsent.status === 422, `status ${noConsent.status}`);

  // -------------------------------------------------------------------------
  console.log('\n▶ RSVP — confirmação válida');
  const rsvp = await request('POST', `/public/invitations/${inviteToken}/rsvp`, {
    body: {
      fullName: 'Convidado Teste da Silva',
      cpf: '52998224725',
      phone: '(21) 98888-7777',
      email: 'teste@email.com',
      attendingCount: 2,
      companions: [{ name: 'Acompanhante Um' }],
      message: 'Estaremos lá!',
      consent: true,
    },
  });
  check('Confirmação válida responde 200', rsvp.status === 200, `status ${rsvp.status}`);
  check('Status muda para CONFIRMED', rsvp.body?.data?.status === 'CONFIRMED');
  check('QR Code é emitido na confirmação', typeof rsvp.body?.data?.qrCode === 'string');
  const qrCode = rsvp.body?.data?.qrCode;

  // -------------------------------------------------------------------------
  console.log('\n▶ QR Code');
  const qr = await request('GET', `/public/invitations/${inviteToken}/qrcode`);
  check('GET do QR Code responde 200', qr.status === 200, `status ${qr.status}`);
  check('QR Code tem o formato CELEBRAI-XXXX-XXXX', /^[A-Z0-9]+-[A-Z0-9]{8}-[A-Z0-9]{4}$/.test(qr.body?.data?.code ?? ''), qr.body?.data?.code);
  check(
    'QR Code NÃO contém CPF',
    !JSON.stringify(qr.body?.data ?? {}).includes('52998224725'),
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ Check-in');
  const invalidCode = await request('POST', `/events/${eventId}/check-in/validate`, {
    token,
    body: { code: 'CODIGO-QUE-NAO-EXISTE' },
  });
  check('Código inválido → resposta 200 com outcome INVALID', invalidCode.body?.data?.outcome === 'INVALID', invalidCode.body?.data?.outcome);
  check('Código inválido tem tom de perigo', invalidCode.body?.data?.tone === 'danger');

  const checkIn = await request('POST', `/events/${eventId}/check-in/validate`, {
    token,
    body: { code: qrCode, operatorLabel: 'Recepção Teste' },
  });
  check('QR Code válido é autorizado', checkIn.body?.data?.outcome === 'AUTHORIZED', JSON.stringify(checkIn.body?.data));
  check('Check-in retorna tom de sucesso', checkIn.body?.data?.tone === 'success');
  check('Check-in registra a quantidade de pessoas', checkIn.body?.data?.checkIn?.peopleCount === 2);
  check('Check-in informa hora de entrada', typeof checkIn.body?.data?.checkIn?.timeLabel === 'string');
  check('Check-in registra o operador', checkIn.body?.data?.checkIn?.operatorLabel === 'Recepção Teste');

  // Segunda leitura deve ser bloqueada.
  const duplicate = await request('POST', `/events/${eventId}/check-in/validate`, {
    token,
    body: { code: qrCode },
  });
  check('Segunda leitura → ALREADY_USED', duplicate.body?.data?.outcome === 'ALREADY_USED', duplicate.body?.data?.outcome);
  check('Segunda leitura tem tom de alerta', duplicate.body?.data?.tone === 'warning');
  check('Segunda leitura oferece autorização manual ao admin', duplicate.body?.data?.canOverride === true);
  check('Segunda leitura mostra a entrada anterior', Boolean(duplicate.body?.data?.previousCheckIn?.atLabel));

  // Autorização manual.
  const override = await request('POST', `/events/${eventId}/check-in/validate`, {
    token,
    body: { code: qrCode, manualOverride: true, overrideReason: 'Convidado apresentou documento' },
  });
  check('Autorização manual libera a entrada', override.body?.data?.outcome === 'AUTHORIZED');
  check('Autorização manual marca método MANUAL', override.body?.data?.checkIn?.method === 'MANUAL');

  // -------------------------------------------------------------------------
  console.log('\n▶ QR Code não confirmado');
  const pendingTokenLink = await request('GET', `/events/${eventId}/invitations?status=PENDING`, { token });
  const pendingInvitation = pendingTokenLink.body?.data?.[0];
  if (pendingInvitation) {
    const reissued = await request('GET', `/events/${eventId}/invitations/${pendingInvitation.id}/link`, { token });
    check('Reemissão de link disponível', reissued.status === 200, `status ${reissued.status}`);
  }

  // -------------------------------------------------------------------------
  console.log('\n▶ Importação de convidados (prévia)');
  const importPreview = await request('POST', `/events/${eventId}/guests/import`, {
    token,
    body: {
      dryRun: true,
      rows: [
        { fullName: 'Import Válido', email: `imp.${unique}@x.com`, whatsapp: '21977776666', allowedCompanions: 2 },
        { fullName: 'In', email: 'email-invalido', whatsapp: '123', allowedCompanions: 0 },
      ],
    },
  });
  check('Prévia de importação responde 200', importPreview.status === 200, `status ${importPreview.status}`);
  check('Prévia aponta 1 linha válida', importPreview.body?.data?.summary?.valid === 1, JSON.stringify(importPreview.body?.data?.summary));
  check('Prévia aponta 1 linha inválida', importPreview.body?.data?.summary?.invalid === 1);
  check('Prévia NÃO importa nada', importPreview.body?.data?.imported === 0);

  // -------------------------------------------------------------------------
  console.log('\n▶ Auditoria');
  const audit = await request('GET', `/events/${eventId}/audit?perPage=50`, { token });
  check('Trilha de auditoria responde 200', audit.status === 200, `status ${audit.status}`);
  const actions = (audit.body?.data ?? []).map((log) => log.action);
  check('Auditoria registrou check-in validado', actions.includes('checkin.validated'));
  check('Auditoria registrou liberação manual', actions.includes('checkin.manual_override'));
  check('Auditoria registrou criação de convidado', actions.includes('guest.created'));
  check('Auditoria registrou confirmação de presença', actions.includes('rsvp.confirmed'));
  check('Auditoria registrou tentativa negada', actions.includes('checkin.denied'));

  // Login é um evento de plataforma (não vinculado a um evento específico),
  // portanto é verificado na trilha global do super admin.
  const globalAudit = await request('GET', `/events/${eventId}/audit?perPage=1`, { token });
  check(
    'Auditoria é paginada com metadados',
    typeof globalAudit.body?.meta?.total === 'number' && globalAudit.body.meta.total > 0,
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ RBAC — recepcionista');
  const receptionLogin = await request('POST', '/auth/login', {
    body: { email: 'recepcao@celebrai.app', password: 'Recepcao@123' },
  });
  check('Login da recepção funciona', receptionLogin.status === 200, `status ${receptionLogin.status}`);
  const receptionToken = receptionLogin.body?.data?.accessToken;

  const receptionCreate = await request('POST', `/events/${eventId}/guests`, {
    token: receptionToken,
    body: { fullName: 'Tentativa Recepcao', allowedCompanions: 1 },
  });
  check('Recepção NÃO pode criar convidado (403)', receptionCreate.status === 403, `status ${receptionCreate.status}`);

  const receptionDelete = await request('DELETE', `/events/${eventId}/guests/${newGuestId}`, {
    token: receptionToken,
  });
  check('Recepção NÃO pode excluir convidado (403)', receptionDelete.status === 403, `status ${receptionDelete.status}`);

  const receptionCheckIn = await request('POST', `/events/${eventId}/check-in/validate`, {
    token: receptionToken,
    body: { code: 'INEXISTENTE' },
  });
  check('Recepção PODE validar check-in', receptionCheckIn.status === 200, `status ${receptionCheckIn.status}`);

  const receptionOverride = await request('POST', `/events/${eventId}/check-in/validate`, {
    token: receptionToken,
    body: { code: qrCode, manualOverride: true, overrideReason: 'tentativa' },
  });
  check(
    'Recepção NÃO pode liberar entrada manual (403)',
    receptionOverride.status === 403,
    `status ${receptionOverride.status}`,
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ Exportação');
  const exportCsv = await request('GET', `/events/${eventId}/guests/export?format=csv`, { token });
  check('Exportação CSV responde 200', exportCsv.status === 200, `status ${exportCsv.status}`);
  check(
    'Exportação CSV tem cabeçalho esperado',
    typeof exportCsv.body?.raw === 'string' && exportCsv.body.raw.includes('nome,email,whatsapp'),
  );

  // -------------------------------------------------------------------------
  console.log('\n▶ Super admin');
  const superLogin = await request('POST', '/auth/login', {
    body: { email: 'super@celebrai.app', password: 'SuperAdmin@123' },
  });
  check('Login do super admin funciona', superLogin.status === 200, `status ${superLogin.status}`);
  const superToken = superLogin.body?.data?.accessToken;

  const users = await request('GET', '/auth/users', { token: superToken });
  check('Super admin lista usuários', users.status === 200 && Array.isArray(users.body?.data));
  check('Existem 3 usuários no seed', (users.body?.data?.length ?? 0) === 3);

  const adminUsers = await request('GET', '/auth/users', { token });
  check('Admin comum NÃO lista usuários (403)', adminUsers.status === 403, `status ${adminUsers.status}`);

  // -------------------------------------------------------------------------
  console.log('\n▶ Logout e revogação');
  const logout = await request('POST', '/auth/logout', { token });
  check('Logout responde 204', logout.status === 204, `status ${logout.status}`);

  // -------------------------------------------------------------------------
  console.log(`\n${'─'.repeat(56)}`);
  console.log(`  Total: ${passed + failed}  |  ✓ ${passed}  |  ✗ ${failed}`);
  console.log(`${'─'.repeat(56)}\n`);

  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('\n💥 Falha inesperada no smoke test:', error);
  process.exit(1);
});
