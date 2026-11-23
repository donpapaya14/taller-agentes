import { expect, test, type Page } from '@playwright/test';

// jsdom no calcula el layout: estas pruebas miden en un navegador real las pantallas que se ven sin
// sesión. La 404 se pide a una ruta de /api/cron/, que el proxy deja pasar sin sesión y donde no hay
// nada. Se lanzan a mano: URL_BASE=http://127.0.0.1:3000 npx playwright test tests/e2e/pantallas-publicas.spec.ts
const PANTALLAS = ['/', '/login', '/proceso', '/api/cron/no-existe'];
const ALTO = 900;
const ANCHO_MINIMO = 320;
const ANCHO_MAXIMO = 1920;
// Hasta 480 px de 4 en 4, donde un titular largo se sale antes; de ahí a 1920, de 16 en 16, que
// pasa por 1024 y 1280, los anchos donde la maqueta cambia de columnas.
const PASO_DE_MOVIL = 4;
const PASO_DE_ESCRITORIO = 16;
const LIMITE_DE_MOVIL = 480;

function rango(desde: number, hasta: number, paso: number): number[] {
  return Array.from({ length: Math.floor((hasta - desde) / paso) + 1 }, (_, i) => desde + i * paso);
}

const ANCHOS = [
  ...rango(ANCHO_MINIMO, LIMITE_DE_MOVIL, PASO_DE_MOVIL),
  ...rango(LIMITE_DE_MOVIL + PASO_DE_ESCRITORIO, ANCHO_MAXIMO, PASO_DE_ESCRITORIO),
];

// Lo que se sale de su caja o de la pantalla, medido en el navegador: la página que se desplaza de
// lado, y cualquier elemento cuyo contenido es más ancho que él sin recortarse ni desplazarse.
function medirDesbordes(): string[] {
  const ancho = document.documentElement.clientWidth;
  const hallazgos: string[] = [];
  const sobrante = document.documentElement.scrollWidth - ancho;
  if (sobrante > 0) hallazgos.push(`la página se desplaza de lado ${sobrante} px`);
  for (const elemento of document.querySelectorAll('body *')) {
    if (elemento.clientWidth === 0 || getComputedStyle(elemento).overflowX !== 'visible') continue;
    if (elemento.scrollWidth > elemento.clientWidth + 1) {
      hallazgos.push(
        `${elemento.tagName.toLowerCase()} «${(elemento.textContent ?? '').trim().slice(0, 24)}» ` +
          `mide ${elemento.scrollWidth} px en una caja de ${elemento.clientWidth} px`,
      );
    }
  }
  return hallazgos;
}

async function desbordesPorAncho(page: Page): Promise<string[]> {
  const encontrados: string[] = [];
  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: ALTO });
    for (const hallazgo of await page.evaluate(medirDesbordes)) {
      encontrados.push(`${ancho} px: ${hallazgo}`);
    }
  }
  return encontrados;
}

for (const ruta of PANTALLAS) {
  test(`[D-13] ${ruta} no se sale de la pantalla de 320 a 1920 px`, async ({ page }) => {
    await page.goto(ruta);
    await page.evaluate(() => document.fonts.ready);

    expect(await desbordesPorAncho(page)).toEqual([]);
  });
}
