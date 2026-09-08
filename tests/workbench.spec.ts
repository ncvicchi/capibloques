import { expect, test, type Page } from '@playwright/test';
import { mockEditorSession, student, token } from './editor-fixture';
import { mockReview, reviewPath } from './project-review-fixture';

async function open(page: Page) {
  await mockEditorSession(page);
  await page.goto('/');
  await expect(page.locator('.blocklySvg')).toBeVisible();
}
async function exported(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await download).createReadStream(), chunks = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test('mesa de trabajo: dos filas globales, área útil y cámara sin cambiar el proyecto', async ({ page }, info) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await open(page);
  const area = await page.locator('.workspace-grid').boundingBox();
  expect(area!.height / 768).toBeGreaterThanOrEqual(.70);
  expect(area!.y).toBeLessThan(150);
  const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.width);
  for (const name of ['Guardar', 'Mis proyectos', 'Ejecutar', 'Paso', 'Detener', 'Deshacer', 'Rehacer', 'Armar escena', 'Conectar']) await expect(page.getByRole('button', { name, exact: true })).toBeVisible();
  const before = await exported(page);
  const viewport = page.getByRole('application', { name: 'Lienzo de la escena' });
  await page.getByRole('button', { name: 'Acercar escena', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-camera-zoom', '1.25');
  await page.getByRole('button', { name: 'Mover vista de la escena' }).click();
  const rect = (await viewport.boundingBox())!;
  await page.mouse.move(rect.x + rect.width / 2, rect.y + rect.height / 2); await page.mouse.down();
  await page.mouse.move(rect.x + rect.width / 2 + 65, rect.y + rect.height / 2 + 25, { steps: 8 }); await page.mouse.up();
  await expect(viewport).not.toHaveAttribute('data-camera-x', '0.00');
  await page.getByRole('tab', { name: 'Estado', exact: true }).click();
  await page.getByRole('tab', { name: 'Escena', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-camera-zoom', '1.25');
  const after = await exported(page);
  expect(after.scene).toEqual(before.scene); expect(after.workspace).toEqual(before.workspace);
  await page.getByRole('button', { name: 'Ajustar escena', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-camera-zoom', '1'); await expect(viewport).toHaveAttribute('data-camera-x', '0.00');
  await page.screenshot({ path: info.outputPath('workbench-1366.png') });
});

test('sesión: foco no consulta ni bloquea, reloj sí revalida y revocación sí cierra', async ({ page }) => {
  await mockEditorSession(page);
  let calls = 0, denied = false;
  await page.route('**/api/auth/editor-session/', route => { calls++; return route.fulfill(denied ? { status: 401, json: { code: 'login_required' } } : { json: { user: student, csrfToken: token, context: 'ui-session-a', expiresAt: new Date(Date.now() + 3600000).toISOString() } }); });
  await page.route('**/api/auth/session/', route => route.fulfill({ json: { user: null, csrfToken: token } }));
  await page.clock.install();
  await page.goto('/'); await expect(page.locator('.blocklySvg')).toBeVisible();
  await page.getByRole('textbox', { name: 'Nombre del proyecto' }).fill('Sin interrupciones');
  const initial = calls;
  await page.evaluate(() => { for (let i = 0; i < 12; i++) { window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); } });
  await page.clock.fastForward(5000);
  expect(calls).toBe(initial); await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Sin interrupciones');
  await page.clock.fastForward(60000); await expect.poll(() => calls).toBeGreaterThan(initial);
  await expect(page.getByRole('textbox', { name: 'Nombre del proyecto' })).toHaveValue('Sin interrupciones');
  denied = true; await page.clock.fastForward(60000); await expect(page).toHaveURL(/\/cuenta\//);
});

test('Wemos: pines y listado sincronizados, sin dar por aprobado el circuito', async ({ page }, info) => {
  await open(page);
  await page.getByRole('button', { name: 'Conectar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Conectar la Wemos sin adivinar' });
  await expect(dialog.locator('.wemos-image')).toBeVisible();
  const rows = dialog.locator('.wiring-table tbody tr');
  expect(await rows.count()).toBeGreaterThan(0);
  const first = rows.first().getByRole('button');
  const gpio = Number((await first.textContent())!.replace('GPIO ', ''));
  await first.click();
  await expect(dialog.locator(`.board-contact[data-gpio="${gpio}"]`)).toHaveAttribute('aria-pressed', 'true');
  await expect(rows.first()).toHaveAttribute('data-selected', 'true');
  const contact = dialog.locator('.board-contact.used').last(); await contact.focus(); await page.keyboard.press('Enter');
  const other = await contact.getAttribute('data-gpio');
  await expect(dialog.getByRole('button', { name: new RegExp(`Localizar conexión .*GPIO ${other}$`) }).first()).toHaveAttribute('aria-pressed', 'true');
  for (const checkbox of await dialog.getByRole('checkbox').all()) await expect(checkbox).not.toBeChecked();
  await page.screenshot({ path: info.outputPath('wemos-wiring.png') });
});

test('escena ampliada: mover componentes y deshacer/rehacer; cámara no ensucia', async ({ page }) => {
  await open(page);
  const project = await exported(page);
  await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Arma tu mundo', exact: true });
  const undo = dialog.getByRole('button', { name: 'Deshacer último cambio' });
  await expect(undo).toBeDisabled();
  await dialog.getByRole('button', { name: 'Acercar escena' }).click();
  await expect(undo).toBeDisabled();
  const object = dialog.getByRole('button', { name: 'Mover Semáforo principal', exact: true });
  const before = await object.getAttribute('style');
  const box = (await object.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 36, box.y + box.height / 2 + 18, { steps: 12 }); await page.mouse.up();
  await expect(object).not.toHaveAttribute('style', before!);
  const moved = await object.getAttribute('style');
  await undo.click(); await expect(object).toHaveAttribute('style', before!);
  await dialog.getByRole('button', { name: 'Rehacer último cambio' }).click(); await expect(object).toHaveAttribute('style', moved!);
  await dialog.getByRole('button', { name: 'Mover vista de la escena' }).click();
  const unchanged = await object.getAttribute('style');
  const point = (await object.boundingBox())!;
  await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
  await page.mouse.down(); await page.mouse.move(point.x + point.width / 2 + 20, point.y + point.height / 2, { steps: 8 }); await page.mouse.up();
  await expect(object).toHaveAttribute('style', unchanged!);
  await dialog.getByRole('button', { name: 'Guardar escena', exact: true }).click();
  await expect(dialog).toBeHidden();
  const saved = await exported(page);
  expect(saved.scene.devices[0].position.x).toBeGreaterThan(project.scene.devices[0].position.x);
  expect(saved.scene.devices[0].pins).toEqual(project.scene.devices[0].pins);
  expect(JSON.stringify(saved)).not.toContain('camera');
});

test('cámara: teclado, zoom táctil con Mano y revisión docente de sólo lectura', async ({ page, context }) => {
  await open(page);
  const viewport = page.getByRole('application', { name: 'Lienzo de la escena' });
  await viewport.focus(); await page.keyboard.press('+'); await page.keyboard.press('ArrowRight');
  await expect(viewport).toHaveAttribute('data-camera-zoom', '1.25'); await expect(viewport).toHaveAttribute('data-camera-x', '40.00');
  await page.keyboard.press('0'); await expect(viewport).toHaveAttribute('data-camera-zoom', '1');
  await page.getByRole('button', { name: 'Mover vista de la escena' }).click();
  const rect = (await viewport.boundingBox())!, x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x - 35, y, id: 1 }, { x: x + 35, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - 65, y, id: 1 }, { x: x + 65, y, id: 2 }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await expect.poll(async () => Number(await viewport.getAttribute('data-camera-zoom'))).toBeGreaterThan(1.5);
  await cdp.detach();
  await mockReview(page); await page.goto(reviewPath);
  await expect(page.getByLabel('Bloques de la versión, sólo lectura')).toBeVisible();
  const reviewCamera = page.getByRole('application', { name: 'Lienzo de la escena' });
  await page.getByRole('button', { name: 'Acercar escena' }).click();
  await expect(reviewCamera).toHaveAttribute('data-camera-zoom', '1.25');
  await expect(page.getByRole('button', { name: /^Mover Semáforo/ })).toHaveCount(0);
});

test('catálogo separado: fondo opaco, cierre explícito y Escape, arrastre funcional', async ({ page }) => {
  await open(page);
  await page.getByRole('treeitem', { name: 'Bucles', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cerrar catálogo de bloques' })).toBeVisible();
  const opacity = await page.locator('.blocklyToolboxFlyout .blocklyFlyoutBackground').evaluate(element => getComputedStyle(element).fillOpacity);
  expect(opacity).toBe('1');
  await page.getByRole('button', { name: 'Cerrar catálogo de bloques' }).click();
  await expect(page.locator('.blocklyToolboxFlyout')).not.toBeVisible();
  await page.getByRole('treeitem', { name: 'Bucles', exact: true }).click(); await page.keyboard.press('Escape');
  await expect(page.locator('.blocklyToolboxFlyout')).not.toBeVisible();
  await page.getByRole('treeitem', { name: 'Bucles', exact: true }).click();
  const block = page.locator('.blocklyToolboxFlyout .blocklyDraggable').first(), box = (await block.boundingBox())!;
  const host = (await page.getByLabel('Editor visual de bloques').boundingBox())!;
  const before = await page.locator('.blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable').count();
  await page.mouse.move(box.x + 40, box.y + 18); await page.mouse.down();
  await page.mouse.move(host.x + host.width - 140, host.y + host.height / 2, { steps: 20 }); await page.mouse.up();
  await expect(page.locator('.blocklyToolboxFlyout')).not.toBeVisible();
  await expect.poll(() => page.locator('.blocklyWorkspace > .blocklyBlockCanvas > .blocklyDraggable').count()).toBeGreaterThan(before);
});
