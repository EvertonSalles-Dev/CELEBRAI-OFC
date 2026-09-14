/**
 * Gera um convite limpo (PENDING) e salva o token em tools/.qa-token.
 * Usado pelo QA da área do convidado.
 */
import { writeFileSync } from 'node:fs';

const BASE = 'http://127.0.0.1:3333/api';

const loginResponse = await fetch(`${BASE}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@celebrai.app', password: 'Admin@12345' }),
});
const login = await loginResponse.json();
if (!login?.data?.accessToken) {
  console.error('Login falhou:', JSON.stringify(login));
  process.exit(1);
}

const auth = { Authorization: `Bearer ${login.data.accessToken}` };

const eventsResponse = await fetch(`${BASE}/events`, { headers: auth });
const events = await eventsResponse.json();
const eventId = events.data[0].id;

const unique = Date.now();
const createdResponse = await fetch(`${BASE}/events/${eventId}/guests`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...auth },
  body: JSON.stringify({
    fullName: `Convidado QA ${unique}`,
    email: `qa.${unique}@email.com`,
    whatsapp: '21999990000',
    allowedCompanions: 2,
  }),
});
const created = await createdResponse.json();

const token = created?.data?.inviteLink?.split('/convite/')[1];
if (!token) {
  console.error('Criação falhou:', JSON.stringify(created));
  process.exit(1);
}

writeFileSync('tools/.qa-token', token, 'utf8');
console.log(token);
