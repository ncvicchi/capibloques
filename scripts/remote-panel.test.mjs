import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { GorillaRemoteLease } from '../lib/gorilla-remote.ts';
const source = await readFile(
  new URL('../interpreter/main/remote_panel.h', import.meta.url),
  'utf8',
);
const html = source.split('R"CAPIHTML(')[1].split(')CAPIHTML"')[0];
const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  let lease = new GorillaRemoteLease(),
    nonce = 1,
    commands = 0;
  const key = '12345678901234567890123456789012';
  await context.route('http://gorilla.test/**', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'text/html', body: html });
      return;
    }
    const q = route.request().postDataJSON(),
      now = performance.now();
    let ok = false;
    if (q.key === key) {
      if (q.type === 'claim') ok = lease.claim('phone', now, ++nonce);
      else ok = lease.accept(q.session, q, now, ++nonce, false, false, 1);
    }
    if (ok) commands++;
    await route.fulfill({
      status: ok ? 200 : 409,
      contentType: 'application/json',
      body: JSON.stringify(
        ok
          ? {
              session: lease.session,
              sequence: lease.sequence,
              ticket: lease.ticket,
              armed: lease.armed,
              stopped: lease.stopped,
              robot: 'Mi GorillaBot',
              project: 'Misión de prueba',
              running: true,
              busy: false,
              ready: true,
              error: false,
              turns: false,
              valid: true,
              distance: 20,
              button: false,
              angles: Array(8).fill(0),
              missions: ['Explorar el corredor'],
            }
          : { error: 'Mando ocupado o inválido' },
      ),
    });
  });
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://gorilla.test/');
  await page.locator('#key').fill(key);
  await page
    .getByRole('button', { name: 'Conectar mando', exact: true })
    .click();
  await page.getByRole('button', { name: 'Habilitar mando en reposo' }).click();
  await page.waitForFunction(() =>
    document.querySelector('#status').textContent.includes('habilitado'),
  );
  const up = page.getByRole('button', { name: '↑ Adelante', exact: true });
  const box = await up.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(220);
  assert.equal(lease.direction, 1);
  assert.equal(lease.armed, true);
  await page.mouse.up();
  await page.waitForTimeout(220);
  assert.equal(lease.direction, 0);
  assert.equal(lease.armed, true);
  await page
    .getByRole('button', { name: 'DETENER AHORA', exact: true })
    .click();
  await page.waitForTimeout(220);
  assert.equal(lease.stopped, true);
  await page.getByRole('button', { name: 'Habilitar mando en reposo' }).click();
  await page.waitForTimeout(220);
  assert.equal(lease.stopped, false);
  await page.locator('#mode').selectOption('1');
  await page.waitForTimeout(220);
  assert.equal(lease.armed, false);
  await page.getByRole('button', { name: 'Habilitar mando en reposo' }).click();
  await page.waitForTimeout(220);
  await page
    .getByRole('button', { name: 'Explorar el corredor', exact: true })
    .click();
  await page.waitForTimeout(220);
  assert.equal(lease.mission, 1);
  await page.getByRole('button', { name: 'Terminar marcha en apoyo' }).click();
  await page.waitForTimeout(220);
  assert.equal(lease.mission, 0);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  const before = commands;
  await page.waitForTimeout(650);
  lease.expire(performance.now());
  assert.equal(lease.connected, false);
  assert.equal(commands, before);
  assert.deepEqual(errors, []);
  console.log(
    'Panel real62 Chromium: mantener/soltar, STOP/rearme, modo, misión, fin y pérdida de foco aprobados.',
  );
  await context.close();
} finally {
  await browser.close();
}
