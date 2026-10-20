import { test, expect } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
for (const modular of [false, true])
  test(`Gorilla62 mando ${modular ? 'con misión' : 'manual'}: conectar, habilitar y soltar`, async ({
    page,
  }) => {
    await mockEditorSession(page);
    await page.goto('/');
    await expect(page.locator('.blocklySvg')).toBeVisible();
    const e = examples.find(
      (e) => e.id === (modular ? 'gorillaRemoteMissions' : 'gorillaRemote'),
    )!;
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'mando.json',
        mimeType: 'application/json',
        buffer: Buffer.from(
          JSON.stringify(makeProject(e.title, e.scene, e.workspace, 4)),
        ),
      });
    const confirm = page.getByRole('alertdialog', {
      name: 'Antes de reemplazar el editor',
    });
    if (await confirm.isVisible())
      await confirm
        .getByRole('button', { name: 'Descartar cambios y abrir' })
        .click();
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Autonomía', exact: true }),
      ).toBeVisible();
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    const panel = page.getByRole('group', {
      name: '🎮 Mando remoto · ensayo en simulador',
    });
    await expect(panel).toBeVisible();
    await panel
      .getByRole('button', { name: 'Conectar mando simulado', exact: true })
      .click();
    await panel
      .getByRole('button', { name: 'Habilitar mando en reposo', exact: true })
      .click();
    const forward = panel.getByRole('button', {
      name: 'Adelante',
      exact: true,
    });
    await expect(forward).toBeEnabled();
    const rect = await forward.boundingBox();
    await page.mouse.move(
      rect!.x + rect!.width / 2,
      rect!.y + rect!.height / 2,
    );
    await page.mouse.down();
    const world = page.locator('[data-gorilla-x]');
    await expect
      .poll(async () => Number(await world.getAttribute('data-gorilla-x')), {
        timeout: 15000,
      })
      .toBeGreaterThan(121);
    await page.mouse.up();
    await panel
      .getByRole('button', { name: 'DETENER AHORA', exact: true })
      .click();
    await expect(panel.getByRole('status')).toContainText('Detenido');
    await panel
      .getByRole('button', { name: 'Ensayar pérdida de conexión' })
      .click();
    await expect(panel.getByRole('status')).toContainText('desconectado');
  });
