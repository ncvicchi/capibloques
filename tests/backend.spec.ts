import { expect, test } from '@playwright/test';

// Sólo contra un entorno que realmente tenga API, nunca simularla en estos casos.
if (process.env.PLAYWRIGHT_API === '1') {
  test('base privada: API accesible por el mismo origen del editor', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Ingresar', exact: true })).toBeVisible();
    await expect(page.getByLabel('Editor visual de bloques')).toHaveCount(0);
    const result = await page.evaluate(async () => {
      const response = await fetch('/api/health/ready/');
      return { status: response.status, body: await response.json(), url: response.url };
    });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ status: 'ok' });
    expect(new URL(result.url).origin).toBe(new URL(page.url()).origin);
  });

  test('base privada: salud mínima, sin rutas de cuentas ni administrador', async ({ request }) => {
    expect((await request.get('/api/health/live/')).status()).toBe(200);
    expect((await request.post('/api/health/live/')).status()).toBe(403);
    expect((await request.get('/api/users/')).status()).toBe(404);
    expect((await request.get('/api/auth/editor-session/')).status()).toBe(401);
  });
}
