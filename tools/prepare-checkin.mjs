/**
 * Prepara dados para o QA de check-in:
 *  - cria um convidado novo,
 *  - confirma a presença via API pública,
 *  - devolve o código do QR Code para o teste.
 */
const BASE = 'http://127.0.0.1:3333/api';

const login = await (
  await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@celebrai.app', password: 'Admin@12345' }),
  })
).json();

const auth = { Authorization: `Bearer ${login.data.accessToken}` };
const events = await (await fetch(`${BASE}/events`, { headers: auth })).json();
const eventId = events.data[0].id;

const unique = Date.now();
const created = await (
  await fetch(`${BASE}/events/${eventId}/guests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth },
    body: JSON.stringify({
      fullName: `Convidado QA ${unique}`,
      email: `qa.${unique}@email.com`,
      whatsapp: '21999990000',
      allowedCompanions: 2,
    }),
  })
).json();

const token = created.data.inviteLink.split('/convite/')[1];

// Confirma a presença (gera o QR Code).
const rsvp = await (
  await fetch(`${BASE}/public/invitations/${token}/rsvp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fullName: `Convidado QA ${unique}`,
      cpf: '52998224725',
      phone: '(21) 99999-0000',
      email: `qa.${unique}@email.com`,
      attendingCount: 2,
      companions: [{ name: 'Acompanhante QA' }],
      consent: true,
    }),
  })
).json();

if (!rsvp?.data?.qrCode) {
  console.error('RSVP falhou:', JSON.stringify(rsvp));
  process.exit(1);
}

console.log(rsvp.data.qrCode);
