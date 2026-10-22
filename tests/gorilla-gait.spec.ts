import { test, expect } from '@playwright/test';
import { mockEditorSession } from './editor-fixture';
import { examples, makeProject } from '../lib/capiblocks';
for (const modular of [false, true])
  test(`Gorilla60 ${modular ? 'procedimientos' : 'secuencial'}: pista, marcha, pausa y reinicio`, async ({
    page,
  }) => {
    await mockEditorSession(page);
    await page.goto('/');
    await expect(page.locator('.blocklySvg')).toBeVisible();
    const e = examples.find(
      (e) => e.id === (modular ? 'gorillaTrackProcedures' : 'gorillaTrack'),
    )!;
    await page
      .locator('input[type=file]')
      .setInputFiles({
        name: 'gorilla60.json',
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
    const world = page.locator('[data-gorilla-x]');
    await expect(world).toHaveAttribute('data-gorilla-x', '120.00');
    if (modular)
      await expect(
        page.getByRole('tab', { name: 'Recorrido', exact: true }),
      ).toBeVisible();
    await page.getByRole('button', { name: 'Simular', exact: true }).click();
    await expect
      .poll(async () => Number(await world.getAttribute('data-gorilla-x')), {
        timeout: 20000,
      })
      .toBeGreaterThan(121);
    await page.getByRole('button', { name: 'Pausar', exact: true }).click();
    await expect(page.getByRole('button',{name:'Reanudar',exact:true})).toBeVisible();
    const held = await world.getAttribute('data-gorilla-x');
    await page.waitForTimeout(400);
    await expect(world).toHaveAttribute('data-gorilla-x', held!);
    const more = page.getByRole('button', {
      name: 'Más herramientas',
      exact: true,
    });
    if (await more.isVisible()) await more.click();
    await page.getByRole('menuitem', { name: 'Reiniciar programa y escena' }).click();
    await expect(world).toHaveAttribute('data-gorilla-x', '120.00');
    await expect(world).toHaveAttribute('data-gorilla-visits', '');
    if(!modular){
      await page.getByRole('button',{name:'Armar escena',exact:true}).click();
      const editor=page.getByRole('dialog',{name:'Editor de escenas',exact:true});
      const stride=editor.getByLabel('Longitud del paso (mm)',{exact:true});
      await expect(stride).toHaveValue('4');
      await stride.fill('3');
      await editor.getByRole('button',{name:/Cancelar cambios/}).click();
      await expect(stride).toHaveValue('4');
      await stride.fill('3');
      await editor.getByRole('button',{name:/Guardar cambios/}).click();
      await editor.getByRole('button',{name:'Deshacer último cambio',exact:true}).click();
      await expect(stride).toHaveValue('4');
      await editor.getByRole('button',{name:'Rehacer último cambio',exact:true}).click();
      await expect(stride).toHaveValue('3');
      await editor.getByRole('button',{name:'Guardar escena',exact:true}).click();
      await page.getByRole('button',{name:'Armar escena',exact:true}).click();
      await expect(stride).toHaveValue('3');
      await editor.getByRole('button',{name:'Cancelar',exact:true}).click();
    }
  });
