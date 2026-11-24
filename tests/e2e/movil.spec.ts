import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { entrarComo, esperarLaPantalla, rutaDeLaPrimeraOrden } from './ayuda';

// jsdom no calcula el layout ni pinta: estas pruebas miden en un navegador real cada pantalla a
// 390 px (proyecto «movil») y a 1440 px (proyecto «escritorio»). Se lanzan con `npm run e2e` contra
// la app levantada: URL_BASE=http://127.0.0.1:3000 DEMO_PASSWORD=… npm run e2e
const ALTO_MINIMO_DE_ACCION = 48;
const IMPACTOS_GRAVES = ['serious', 'critical'];

// Todo botón y todo enlace con la clase de botón (min-h-toque, la que les da el alto) que se ve.
const ACCIONES = 'button, a.min-h-toque';

async function accionesBajas(page: Page): Promise<string[]> {
  const bajas: string[] = [];
  for (const accion of await page.locator(ACCIONES).all()) {
    const caja = await accion.boundingBox();
    if (caja !== null && caja.height < ALTO_MINIMO_DE_ACCION) {
      bajas.push(`«${(await accion.innerText()).trim()}» mide ${caja.height} px`);
    }
  }
  return bajas;
}

async function faltasGraves(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact != null && IMPACTOS_GRAVES.includes(impact))
    .map(
      ({ id, impact, nodes }) =>
        `${id} (${impact}): ${nodes.map((nodo) => nodo.target).join(' | ')}`,
    );
}

// Lo que se pide a cada pantalla. Con soft, un solo fallo no tapa a los demás: se ven todos de una vez.
async function comprobarLaPantalla(page: Page): Promise<void> {
  await esperarLaPantalla(page);
  const { pagina, ventana } = await page.evaluate(() => ({
    pagina: document.documentElement.scrollWidth,
    ventana: window.innerWidth,
  }));

  expect.soft(pagina, 'ancho de la página').toBeLessThanOrEqual(ventana);
  expect.soft(await accionesBajas(page), 'acciones de menos de 48 px de alto').toEqual([]);
  expect.soft(await faltasGraves(page), 'faltas graves o críticas de axe').toEqual([]);
}

const ENFOCABLES = 'a[href], button, input:not([type="hidden"]), select, textarea';

// Corre dentro del navegador. El navegador da por visible lo que está bajo la barra fija, así que no
// desplaza nada que ya esté ahí: se pone cada elemento justo en esa franja, se le da el foco igual
// que con el tabulador y se mira si sigue en parte bajo la barra. Desde lg la barra no es una caja
// (display: contents) y no tapa nada.
function enfocadosBajoLaBarra(enfocables: string): string[] {
  const barra = document.querySelector('nav[aria-label="Principal"]');
  if (barra === null) return [];
  const techo = barra.getBoundingClientRect().top;
  if (techo === 0) return [];

  // Pone el elemento en la franja de la barra, le da el foco y dice hasta dónde llega después (null
  // si no ha podido recibirlo: un elemento oculto no se enfoca).
  const bajoDelFoco = (elemento: HTMLElement): number | null => {
    window.scrollBy(0, elemento.getBoundingClientRect().bottom - (window.innerHeight - 1));
    elemento.focus();
    return document.activeElement === elemento ? elemento.getBoundingClientRect().bottom : null;
  };

  const tapados: string[] = [];
  for (const elemento of document.querySelectorAll<HTMLElement>(enfocables)) {
    const bottom = barra.contains(elemento) ? null : bajoDelFoco(elemento);
    if (bottom !== null && bottom > techo) {
      tapados.push(
        `«${elemento.innerText.trim().slice(0, 30)}» llega hasta ${bottom} px y la barra empieza en ${techo} px`,
      );
    }
  }
  return tapados;
}

test.describe('lo que se hace con el pulgar y con el teclado', () => {
  // WCAG 2.4.11: lo que recibe el foco no puede quedar tapado por contenido fijo de la página.
  test('[C-16][D-13] la barra fija de abajo no tapa lo que recibe el foco', async ({ page }) => {
    await entrarComo(page, 'jefe');
    await page.goto(await rutaDeLaPrimeraOrden(page));
    await esperarLaPantalla(page);

    expect(await page.evaluate(enfocadosBajoLaBarra, ENFOCABLES)).toEqual([]);
  });

  // Un segundo toque mientras la primera acción viaja encontraría la orden ya movida y acabaría en un
  // aviso de error. La petición se retiene para verla en vuelo y no llega al servidor: no mueve nada.
  test('[C-16][D-13] «Pasar a…» se desactiva mientras envía y un segundo toque no lanza otra acción', async ({
    page,
  }) => {
    await entrarComo(page, 'jefe');
    const avanzar = page.getByRole('button', { name: /^Pasar a/ }).first();
    await expect(avanzar).toBeVisible();
    const retenidas: Route[] = [];
    await page.route(
      (url) => url.pathname === '/tablero',
      async (ruta) => {
        if (ruta.request().method() === 'POST') retenidas.push(ruta);
        else await ruta.continue();
      },
    );

    await avanzar.click();
    await expect(avanzar).toBeDisabled();
    await avanzar.click({ force: true });

    expect(retenidas).toHaveLength(1);
    await retenidas[0].abort();
  });
});

test.describe('cada pantalla en el móvil', () => {
  test('[C-16][D-13] /login cabe en el móvil y es accesible', async ({ page }) => {
    await page.goto('/login');

    await comprobarLaPantalla(page);
  });

  test('[C-16][D-13] /tablero cabe en el móvil y es accesible', async ({ page }) => {
    await entrarComo(page, 'jefe');
    await page.goto('/tablero');

    await comprobarLaPantalla(page);
  });

  test('[C-16][D-13] /ordenes/[id] cabe en el móvil y es accesible', async ({ page }) => {
    await entrarComo(page, 'jefe');
    await page.goto(await rutaDeLaPrimeraOrden(page));

    await comprobarLaPantalla(page);
  });

  test('[C-16][D-13] /recambios cabe en el móvil y es accesible', async ({ page }) => {
    await entrarComo(page, 'jefe');
    await page.goto('/recambios');

    await comprobarLaPantalla(page);
  });

  test('[C-16][D-13] /proceso cabe en el móvil y es accesible', async ({ page }) => {
    await page.goto('/proceso');

    await comprobarLaPantalla(page);
  });
});
