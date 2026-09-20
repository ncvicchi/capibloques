import { expect, test, type Page } from '@playwright/test';
import { DIYMALL_S3_PROFILE_ID, WEMOS_PROFILE_ID } from '../lib/board-profiles';
import { mockEditorSession } from './editor-fixture';

async function readDownload(page: Page) {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('menuitem', { name: 'Proyecto editable JSON' }).click();
  const stream = await (await downloadPromise).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString());
}

test.describe('perfiles de placa', () => {
  test.beforeEach(async ({ page }) => {
    await mockEditorSession(page);
    await page.goto('/');
    await expect(page.locator('.blocklySvg')).toBeVisible();
  });

  test('cambia a la DIYmall S3 N16R8 sin ocultar la decisión y la conserva al exportar', async ({ page }) => {
    await page.getByRole('button', { name: 'Armar escena', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Arma tu mundo' });
    const board = editor.getByLabel('Placa del proyecto');
    await expect(board).toHaveValue(WEMOS_PROFILE_ID);

    await board.selectOption(DIYMALL_S3_PROFILE_ID);
    const confirmation = page.getByRole('alertdialog', { name: '¿Cambiar la placa del proyecto?' });
    await expect(confirmation).toContainText('Los GPIO actuales se conservan');
    await confirmation.getByRole('button', { name: 'Cambiar a DIYmall S3' }).click();

    await expect(board).toHaveValue(DIYMALL_S3_PROFILE_ID);
    await expect(editor.getByText('16MB flash · 8 MB PSRAM', { exact: true })).toBeVisible();
    const undo = editor.getByRole('button', { name: 'Deshacer último cambio' });
    const redo = editor.getByRole('button', { name: 'Rehacer último cambio' });
    await undo.click();
    await expect(board).toHaveValue(WEMOS_PROFILE_ID);
    await redo.click();
    await expect(board).toHaveValue(DIYMALL_S3_PROFILE_ID);

    await editor.getByRole('button', { name: 'Auto conectar' }).click();
    await editor.getByRole('button', { name: 'Guardar escena' }).click();
    const exported = await readDownload(page);
    expect(exported.target).toEqual({
      family: 'esp32-s3',
      framework: 'arduino',
      coreMajor: 3,
      coreVersion: '3.3.11',
      boardProfile: DIYMALL_S3_PROFILE_ID,
      fqbn: 'esp32:esp32:esp32s3',
    });

    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    const guide = page.getByRole('dialog', { name: 'Conectar DIYmall S3 sin adivinar' });
    await expect(guide).toBeVisible();
    await expect(guide.getByText('16 MB flash · 8 MB PSRAM', { exact: true })).toBeVisible();
    await expect(guide).toContainText('GPIO35, 36 y 37');
  });
});
