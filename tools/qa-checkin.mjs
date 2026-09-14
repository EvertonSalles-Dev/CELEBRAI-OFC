/**
 * QA do controle de entrada (check-in) no navegador.
 *
 * Percorre: seleção do evento → scanner → validação do QR → resultado.
 * Usa o código passado em CHECKIN_CODE.
 */
export default async function run(page, ui) {
  const steps = [];
  const base = 'http://127.0.0.1:4173';
  const code = process.env.CHECKIN_CODE;

  // -------------------------------------------------------------------------
  // 1. Login como recepcionista (perfil de portaria)
  // -------------------------------------------------------------------------
  await page.goto(`${base}/login`);
  await page.waitForTimeout(2000);

  await page.locator('input[name="email"]').click();
  await page.locator('input[name="email"]').pressSequentially('recepcao@celebrai.app', { delay: 10 });
  await page.locator('input[name="password"]').click();
  await page.locator('input[name="password"]').pressSequentially('Recepcao@123', { delay: 10 });
  await page.click('button[type="submit"]');

  // A recepção é levada direto ao controle de entrada.
  await page.waitForURL('**/check-in**', { timeout: 15000 }).catch(() => null);
  await page.waitForTimeout(2500);

  const home = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      url: window.location.href,
      text: text.slice(0, 400),
      // A recepção NÃO deve ver o menu administrativo completo.
      seesDashboardLink: Boolean(document.querySelector('a[href="/dashboard"]')),
      seesEvent: text.includes('João') || text.includes('Casamento'),
    };
  });

  steps.push({ step: 'checkin-home', ...home });

  // -------------------------------------------------------------------------
  // 2. Abrir o scanner do evento
  // -------------------------------------------------------------------------
  const eventButton = page.locator('button:has-text("Abrir scanner")').first();
  if (await eventButton.count() > 0) {
    await eventButton.click();
  } else {
    await page.goto(`${base}/check-in/scanner/`);
  }

  await page.waitForTimeout(3000);

  const scanner = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      url: window.location.href,
      text: text.slice(0, 400),
      hasCameraArea: Boolean(document.querySelector('[id^="qr-reader-"]')),
      hasCounters: /Entradas/.test(text) && /Pessoas/.test(text),
      hasManualFallback: /digitar o código manualmente/i.test(text),
    };
  });

  steps.push({ step: 'scanner', ...scanner });

  // -------------------------------------------------------------------------
  // 3. Validar o código via digitação manual (a câmera não existe no headless)
  // -------------------------------------------------------------------------
  if (code) {
    const manualToggle = page.locator('text=Digitar o código manualmente');
    if (await manualToggle.count() > 0) {
      await manualToggle.click();
      await page.waitForTimeout(600);
    }

    await page.fill('input[aria-label="Código do convite"]', code);
    await page.click('button:has-text("Validar")');

    await page.waitForTimeout(4000);

    const result = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        text: text.slice(0, 500),
        authorized: /ENTRADA AUTORIZADA/i.test(text),
        hasGuestName: /Convidado QA/i.test(text),
        showsCount: /pessoas/i.test(text),
        showsTime: /Horário de entrada/i.test(text),
      };
    });

    steps.push({ step: 'checkin-result', ...result });

    // ---------------------------------------------------------------------
    // 4. Segunda leitura deve bloquear (duplicidade)
    // ---------------------------------------------------------------------
    const closeButton = page.locator('button:has-text("Escanear próximo")');
    if (await closeButton.count() > 0) {
      await closeButton.click();
    } else {
      const closeX = page.locator('button[aria-label="Fechar resultado"]');
      if (await closeX.count() > 0) await closeX.click();
    }

    await page.waitForTimeout(1200);

    const manualToggle2 = page.locator('text=Digitar o código manualmente');
    if (await manualToggle2.count() > 0) {
      await manualToggle2.click();
      await page.waitForTimeout(600);
    }

    await page.fill('input[aria-label="Código do convite"]', code);
    await page.click('button:has-text("Validar")');
    await page.waitForTimeout(4000);

    const duplicate = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        text: text.slice(0, 500),
        blocked: /JÁ UTILIZADO/i.test(text),
        showsPrevious: /entrada registrada anteriormente/i.test(text),
        hasOverrideButton: Array.from(document.querySelectorAll('button')).some((b) =>
          /autorizar manualmente/i.test(b.textContent ?? ''),
        ),
      };
    });

    steps.push({ step: 'duplicate-blocked', ...duplicate });

    // A recepção NÃO pode autorizar manualmente.
    if (duplicate.hasOverrideButton) {
      await page.locator('button:has-text("Autorizar manualmente")').click();
      await page.waitForTimeout(1500);

      await page.fill('#override-reason', 'Tentativa da recepcao');
      await page.locator('button:has-text("Autorizar entrada")').click();
      await page.waitForTimeout(3000);

      const overrideResult = await page.evaluate(() => {
        const text = document.body.innerText;
        return {
          text: text.slice(0, 300),
          wasDenied: /Apenas administradores/i.test(text) || /permissão/i.test(text),
        };
      });

      steps.push({ step: 'reception-cannot-override', ...overrideResult });
    }
  }

  return steps;
}
