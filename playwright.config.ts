import { defineConfig } from '@playwright/test';

const URL_LOCAL = 'http://127.0.0.1:3000';
const urlBase = process.env.URL_BASE;

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: [['json', { outputFile: 'reports/playwright.json' }], ['list']],
  use: { baseURL: urlBase ?? URL_LOCAL },
  projects: [
    { name: 'movil', use: { viewport: { width: 390, height: 844 } } },
    { name: 'escritorio', use: { viewport: { width: 1440, height: 900 } } },
  ],
  // Con URL_BASE se prueba un despliegue ya levantado; sin ella, la app se construye y arranca.
  webServer: urlBase ? undefined : { command: 'npm run build && npm run start', url: URL_LOCAL },
});
