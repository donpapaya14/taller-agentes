import { expect, test } from '@playwright/test';
import { entrarComo, matriculasDelTablero, rutaDeLaPrimeraOrden } from './ayuda';

// El humo de la demostración: lo mínimo que tiene que funcionar en la dirección que se entrega,
// sin escribir nada en ella. Se lanza contra producción o contra la app levantada:
// URL_BASE=https://… DEMO_PASSWORD=… npm run smoke
const RUTAS_PUBLICAS = ['/', '/login', '/proceso'];

test.describe('la dirección de la demostración', () => {
  test('[P-7] /proceso responde 200 y cuenta cómo se construyó', async ({ page }) => {
    const respuesta = await page.goto('/proceso');

    expect(respuesta?.status()).toBe(200);
    await expect(page.locator('body')).toContainText('Cómo se construyó');
  });

  test('[P-7] ninguna respuesta de navegación pide cuenta de Vercel ni es un 401', async ({
    page,
  }) => {
    const sospechosas: string[] = [];
    page.on('response', (respuesta) => {
      if (!respuesta.request().isNavigationRequest()) return;
      const { hostname } = new URL(respuesta.url());
      const esDeVercel = hostname === 'vercel.com' || hostname.endsWith('.vercel.com');
      if (esDeVercel || respuesta.status() === 401) {
        sospechosas.push(`${respuesta.status()} ${respuesta.url()}`);
      }
    });

    for (const ruta of RUTAS_PUBLICAS) await page.goto(ruta);

    expect(sospechosas).toEqual([]);
  });

  test('[P-7] el jefe entra y ve al menos una matrícula en el tablero', async ({ page }) => {
    await entrarComo(page, 'jefe');

    await expect(page.locator('.matricula-caracteres').first()).toBeAttached();
    expect((await matriculasDelTablero(page)).length).toBeGreaterThan(0);
  });
});

test.describe('quién ve qué', () => {
  test('[P-7] el mecánico abre una orden en «Listo» y no ve «Entregar»', async ({
    page,
    context,
  }) => {
    const entregar = page.getByRole('button', { name: 'Entregar', exact: true });
    await entrarComo(page, 'mecanico');
    const orden = await rutaDeLaPrimeraOrden(page, 'listo');
    await page.goto(orden);

    await expect(page.getByRole('main')).toContainText('Listo');
    await expect(entregar).toHaveCount(0);

    // Sin esta comprobación, que el botón no esté podría ser que el botón ya no se llame así.
    await context.clearCookies();
    await entrarComo(page, 'jefe');
    await page.goto(orden);
    await expect(entregar).toBeVisible();
  });

  test('[P-7] el jefe del otro taller no ve ninguna de las matrículas del primero', async ({
    page,
    context,
  }) => {
    await entrarComo(page, 'jefe');
    await expect(page.locator('.matricula-caracteres').first()).toBeAttached();
    const delPrimero = await matriculasDelTablero(page);

    await context.clearCookies();
    await entrarComo(page, 'otro');
    await expect(page.locator('.matricula-caracteres').first()).toBeAttached();
    const delOtro = await matriculasDelTablero(page);

    // Que los dos tableros tengan matrículas es lo que da valor a la comparación.
    expect(delPrimero.length).toBeGreaterThan(0);
    expect(delOtro.length).toBeGreaterThan(0);
    expect(delOtro.filter((matricula) => delPrimero.includes(matricula))).toEqual([]);
  });
});

test.describe('lo que pasa con la sesión', () => {
  test('[C-1] con la sesión caducada, la siguiente acción lleva a /login y no a la pantalla de error', async ({
    page,
    context,
  }) => {
    await entrarComo(page, 'jefe');
    const avanzar = page.getByRole('button', { name: /^Pasar a/ }).first();
    await expect(avanzar).toBeVisible();

    // Con las cookies fuera no hay sesión: lo mismo que ver caducar la sesión con la pantalla abierta.
    await context.clearCookies();
    await avanzar.click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Algo ha fallado' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Entrar', exact: true })).toBeVisible();
  });
});
