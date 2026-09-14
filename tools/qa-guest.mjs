/**
 * QA da área do convidado: convite, RSVP e QR Code.
 * Usa o token do convite de exemplo gerado pelo seed.
 */
export default async function run(page, ui) {
  const steps = [];
  const token = process.env.INVITE_TOKEN;
  const base = 'http://127.0.0.1:4173';

  if (!token) return { error: 'INVITE_TOKEN não definido' };

  // -------------------------------------------------------------------------
  // 1. Convite
  // -------------------------------------------------------------------------
  await page.goto(`${base}/convite/${token}`);
  await page.waitForTimeout(3500);

  const invite = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      text: text.slice(0, 700),
      hasHosts: text.includes('João') && text.includes('Maria'),
      hasDate: /DEZEMBRO|2026/.test(text.toUpperCase()),
      hasCountdown: /CONTAGEM REGRESSIVA/i.test(text),
      hasConfirmButton: Array.from(document.querySelectorAll('a,button')).some((el) =>
        /confirmar presença/i.test(el.textContent ?? ''),
      ),
      hasVenue: text.includes('Espaço Jardim Imperial'),
      hasDressCode: /traje|DRESS CODE/i.test(text),
      hasGiftList: /presente/i.test(text),
      hasPrivacyLink: Boolean(document.querySelector('a[href="/privacidade"]')),
      galleryImages: document.querySelectorAll('img[alt^="Momento do casal"]').length,
    };
  });

  steps.push({ step: 'convite', ...invite });

  // -------------------------------------------------------------------------
  // 2. Página de RSVP
  // -------------------------------------------------------------------------
  await page.goto(`${base}/convite/${token}/confirmacao`);
  await page.waitForTimeout(2500);

  const rsvp = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      text: text.slice(0, 600),
      showsAuthorization: /autorização para até/i.test(text),
      hasCpfField: Boolean(document.querySelector('input[name="cpf"]')),
      hasConsent: Boolean(document.querySelector('input[name="consent"]')),
      hasDeclineLink: Array.from(document.querySelectorAll('a')).some((a) =>
        /não poderei comparecer/i.test(a.textContent ?? ''),
      ),
      hasPrivacyLink: Boolean(document.querySelector('a[href="/privacidade"]')),
    };
  });

  steps.push({ step: 'rsvp', ...rsvp });

  // -------------------------------------------------------------------------
  // 3. Validação de CPF inválido no formulário
  // -------------------------------------------------------------------------
  await page.fill('input[name="fullName"]', 'Convidado QA Navegador');
  await page.fill('input[name="cpf"]', '111.111.111-11');
  await page.fill('input[name="phone"]', '(21) 99999-0000');
  await page.fill('input[name="email"]', 'qa@email.com');
  await page.check('input[name="consent"]');

  await page.click('button[type="submit"]');
  await page.waitForTimeout(1800);

  const invalidCpf = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      blocked: /CPF inválido/i.test(text),
      stillOnRsvpPage: window.location.pathname.includes('confirmacao'),
      errorText: text.match(/CPF inválido[^\n]*/)?.[0] ?? null,
    };
  });

  steps.push({ step: 'cpf-validation', ...invalidCpf });

  // -------------------------------------------------------------------------
  // 4. CPF válido → confirmação
  // -------------------------------------------------------------------------
  await page.fill('input[name="cpf"]', '529.982.247-25');
  await page.click('button[type="submit"]');

  await page.waitForURL('**/qrcode', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(3000);

  const qr = await page.evaluate(() => {
    const text = document.body.innerText;
    const canvas = document.querySelector('canvas');
    return {
      url: window.location.href,
      text: text.slice(0, 600),
      hasQrCanvas: Boolean(canvas),
      hasCode: /[A-Z]+-[A-Z0-9]{8}-[A-Z0-9]{4}/.test(text),
      showsConfirmed: /PRESENÇA CONFIRMADA/i.test(text.toUpperCase()),
      showsAllowed: /autorizadas/i.test(text),
      leaksRawCpf: /529\.982\.247-25|52998224725/.test(text),
      hasSaveButton: Array.from(document.querySelectorAll('button')).some((b) =>
        /salvar qr code/i.test(b.textContent ?? ''),
      ),
    };
  });

  steps.push({ step: 'qrcode', ...qr });

  // Extrai o código para validar no check-in.
  const code = await page.evaluate(() => {
    const match = document.body.innerText.match(/[A-Z]{2,}-[A-Z0-9]{8}-[A-Z0-9]{4}/);
    return match?.[0] ?? null;
  });

  steps.push({ step: 'extracted-code', code });

  return steps;
}
