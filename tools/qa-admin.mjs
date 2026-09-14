/**
 * QA do fluxo administrativo no navegador.
 * Faz login e percorre o painel, verificando se cada tela renderiza.
 */
export default async function run(page, ui) {
  const steps = [];

  // -------------------------------------------------------------------------
  // Login
  // -------------------------------------------------------------------------
  await page.fill('input[type="email"]', 'admin@celebrai.app');
  await page.fill('input[type="password"]', 'Admin@12345');
  await page.click('button[type="submit"]');

  // Espera o painel montar.
  await page.waitForURL('**/dashboard', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2500);

  steps.push({ step: 'login -> dashboard', url: page.url() });

  const dashboardText = await page.evaluate(() => document.body.innerText);
  steps.push({
    hasGreeting: /Bom dia|Boa tarde|Boa noite/.test(dashboardText),
    hasTotals: dashboardText.includes('CONVIDADOS') || dashboardText.includes('Convidados'),
    hasEvent: dashboardText.includes('João'),
    dashboardText: dashboardText.slice(0, 400),
  });

  // -------------------------------------------------------------------------
  // Lista de eventos
  // -------------------------------------------------------------------------
  await page.goto('http://127.0.0.1:4173/eventos');
  await page.waitForTimeout(2000);

  const eventsText = await page.evaluate(() => document.body.innerText);
  steps.push({
    step: 'events',
    hasSeedEvent: eventsText.includes('João'),
    eventsText: eventsText.slice(0, 300),
  });

  // -------------------------------------------------------------------------
  // Convidados do evento
  // -------------------------------------------------------------------------
  const guestLink = await page.evaluate(() => {
    const anchor = Array.from(document.querySelectorAll('a')).find((a) =>
      a.getAttribute('href')?.includes('/convidados'),
    );
    return anchor?.getAttribute('href') ?? null;
  });

  if (guestLink) {
    await page.goto(`http://127.0.0.1:4173${guestLink}`);
    await page.waitForTimeout(2500);

    const guestsText = await page.evaluate(() => document.body.innerText);
    const rows = await page.evaluate(() => document.querySelectorAll('tbody tr').length);

    steps.push({
      step: 'guests',
      rows,
      hasGuest: guestsText.includes('João da Silva'),
      showsMaskedCpf: guestsText.includes('***.***.***'),
      showsRawCpf: /529\.982\.247-25|52998224725/.test(guestsText),
      guestsText: guestsText.slice(0, 500),
    });
  }

  // -------------------------------------------------------------------------
  // Convites
  // -------------------------------------------------------------------------
  const eventId = guestLink?.split('/eventos/')[1]?.split('/')[0];
  if (eventId) {
    await page.goto(`http://127.0.0.1:4173/eventos/${eventId}/convites`);
    await page.waitForTimeout(2500);

    const invitationsText = await page.evaluate(() => document.body.innerText);
    steps.push({
      step: 'invitations',
      hasConfirmed: invitationsText.includes('Confirmado'),
      hasPending: invitationsText.includes('Pendente'),
      invitationsText: invitationsText.slice(0, 400),
    });
  }

  // -------------------------------------------------------------------------
  // Verificação de segurança no DOM
  // -------------------------------------------------------------------------
  const security = await page.evaluate(() => {
    const html = document.documentElement.outerHTML;
    return {
      // O access token NÃO deve estar no localStorage (usamos sessionStorage).
      tokenInLocalStorage: Object.keys(localStorage).some((key) => key.includes('token')),
      // Nenhum hash de CPF deve aparecer no HTML.
      leaksCpfHash: /cpfHash/.test(html),
      leaksCpfRaw: /52998224725/.test(html),
    };
  });

  steps.push({ step: 'security', ...security });

  return steps;
}
