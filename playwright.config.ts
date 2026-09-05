import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000);
// Un destino explícito nunca debe caer silenciosamente en un servidor local.
const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL;
const baseURL = externalBaseURL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  // DEV sin empaquetar sobre SSH tiene mayor latencia que el runner local.
  // No relajar los límites originales del CI ni ocultar fallos con reintentos.
  timeout: externalBaseURL ? 90_000 : 30_000,
  expect: { timeout: externalBaseURL ? 30_000 : 10_000 },
  use: {
    baseURL,
    locale: 'es-AR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    ...(process.env.PLAYWRIGHT_CHROME === '1'
      ? [
          {
            name: 'chrome',
            use: { ...devices['Desktop Chrome'], channel: 'chrome' },
          },
        ]
      : []),
    ...(process.env.PLAYWRIGHT_EDGE === '1'
      ? [
          {
            name: 'edge',
            use: { ...devices['Desktop Edge'], channel: 'msedge' },
          },
        ]
      : []),
  ],
  webServer: externalBaseURL ? undefined : {
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
