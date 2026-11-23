import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Matricula } from '@/ui/Matricula';
import { Tablero, type OrdenTablero } from '@/ui/tablero/Tablero';

// jsdom no calcula el layout: estas pruebas miden el diseño en un navegador real. No piden sesión:
// cargan el CSS de una ruta pública y estática y le ponen dentro el tablero ya pintado por React.
// Se lanzan a mano: URL_BASE=http://127.0.0.1:3000 npx playwright test tests/e2e/tablero-visual.spec.ts
const RUTA_PUBLICA = '/proceso';
const ALTO = 900;
const ANCHO_MINIMO = 320;
const ANCHO_MAXIMO = 1920;
const TIEMPO_DEL_BARRIDO = 180_000;
const APARICION_MAXIMA_MS = 600;
// La rejilla del suelo se repite cada 64 px.
const CELDA_DEL_SUELO = 64;

const orden = (id: string, estado: OrdenTablero['estado'], matricula: string): OrdenTablero => ({
  id,
  matricula,
  estado,
  vehiculo: 'Seat León',
  cliente: 'Lucía Ferrer',
  descripcion: 'Ruido metálico al frenar',
});

// Una orden por columna, todas con la matrícula más larga que admite el formato (ocho caracteres).
const ORDENES = [
  orden('1', 'recibido', '6104 GZT'),
  orden('2', 'en_reparacion', 'AB1234CD'),
  orden('3', 'listo', '3388 NBC'),
  orden('4', 'entregado', 'XY9876ZW'),
];

// Debajo del tablero, la placa grande de una ficha: a ancho completo, con los 16 px de margen de página.
async function abrirTablero(page: Page) {
  await page.goto(RUTA_PUBLICA);
  const tablero = renderToStaticMarkup(
    createElement(Tablero, { ordenes: ORDENES, puedeEntregar: true }),
  );
  const ficha = renderToStaticMarkup(
    createElement(Matricula, { texto: '5821 KLM', tamano: 'grande' }),
  );
  await page.evaluate(
    ([html, placaGrande]) => {
      const envuelto = `<main class="flex min-h-dvh flex-col">${html}<div style="padding: 0 1rem">${placaGrande}</div></main>`;
      const documento = new DOMParser().parseFromString(envuelto, 'text/html');
      document.body.replaceChildren(...documento.body.childNodes);
    },
    [tablero, ficha],
  );
  // Sin la fuente de los datos las medidas valdrían para otra letra y la prueba daría un verde falso.
  await page.evaluate(() => document.fonts.ready);
  const fuenteCargada = await page.evaluate(() =>
    [...document.fonts].some(
      (fuente) => fuente.family.includes('Martian') && fuente.status === 'loaded',
    ),
  );
  expect(fuenteCargada, 'Martian Mono no se ha cargado').toBe(true);
}

// Corre dentro del navegador: los caracteres visibles de cada placa que no caben en su caja. Compara
// el ancho del texto entero (un Range mide también lo que queda oculto) con el de la caja menos su
// relleno, en decimales: scrollWidth redondea y se pierde un recorte de medio píxel.
function placasRecortadas(): string[] {
  return [...document.querySelectorAll<HTMLElement>('.matricula-caracteres')]
    .filter((caja) => caja.getClientRects().length > 0)
    .filter((caja) => {
      const texto = document.createRange();
      texto.selectNodeContents(caja);
      const estilo = getComputedStyle(caja);
      const relleno = parseFloat(estilo.paddingLeft) + parseFloat(estilo.paddingRight);
      const hueco = caja.getBoundingClientRect().width - relleno;
      return (
        texto.getBoundingClientRect().width > hueco + 0.01 || caja.scrollWidth > caja.clientWidth
      );
    })
    .map((caja) => caja.textContent ?? '');
}

// 1024, 1025, 1026 y 1040 se cuentan como «1024-1026 y 1040».
function rangos(numeros: number[]): string {
  const tramos: string[] = [];
  let inicio = 0;
  numeros.forEach((numero, indice) => {
    if (numeros[indice + 1] !== numero + 1) {
      tramos.push(inicio === indice ? `${numero}` : `${numeros[inicio]}-${numero}`);
      inicio = indice + 1;
    }
  });
  return tramos.join(' y ');
}

test.describe('la matrícula en el tablero', () => {
  test('[D-13] una matrícula de ocho caracteres no se recorta de 320 a 1920 px', async ({
    page,
  }) => {
    test.setTimeout(TIEMPO_DEL_BARRIDO);
    await abrirTablero(page);
    const recortadasEn = new Map<string, number[]>();

    for (let ancho = ANCHO_MINIMO; ancho <= ANCHO_MAXIMO; ancho += 1) {
      await page.setViewportSize({ width: ancho, height: ALTO });
      for (const texto of await page.evaluate(placasRecortadas)) {
        recortadasEn.set(texto, [...(recortadasEn.get(texto) ?? []), ancho]);
      }
    }

    const informe = [...recortadasEn].map(([texto, anchos]) => `«${texto}» a ${rangos(anchos)} px`);
    expect(informe).toEqual([]);
  });

  test('[D-13] una matrícula de cuarenta caracteres no ensancha la página', async ({ page }) => {
    await abrirTablero(page);
    await page.evaluate(() => {
      document.querySelectorAll('.matricula-caracteres').forEach((caja) => {
        caja.textContent = `1234 ${'ABCDEFGHIJ'.repeat(4)}`;
      });
    });
    const desbordes: string[] = [];

    for (const ancho of [ANCHO_MINIMO, 360, 390, 768, 1023, 1024, 1056, 1279, 1280, ANCHO_MAXIMO]) {
      await page.setViewportSize({ width: ancho, height: ALTO });
      const pagina = await page.evaluate(() => document.documentElement.scrollWidth);
      if (pagina > ancho) desbordes.push(`${ancho} px: la página mide ${pagina}`);
    }

    expect(desbordes).toEqual([]);
  });
});

// Corre dentro del navegador: cuántos colores distintos hay en la imagen. Un fondo liso da uno.
function coloresDistintos(base64: string): Promise<number> {
  const imagen = new Image();
  imagen.src = `data:image/png;base64,${base64}`;
  return imagen.decode().then(() => {
    const lienzo = document.createElement('canvas');
    lienzo.width = imagen.width;
    lienzo.height = imagen.height;
    const dibujo = lienzo.getContext('2d');
    if (!dibujo) throw new Error('El navegador no ofrece un lienzo 2D');
    dibujo.drawImage(imagen, 0, 0);
    const { data } = dibujo.getImageData(0, 0, lienzo.width, lienzo.height);
    const colores = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
      colores.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    }
    return colores.size;
  });
}

// Un recorte de la captura de la página entera: ocho píxeles de ancho en el margen izquierdo, que
// ningún contenido pinta, y a mitad de una celda de la rejilla del suelo, lejos de sus líneas.
async function coloresEnElMargen(page: Page, contexto: BrowserContext, desdeY: number) {
  const y = Math.floor(desdeY / CELDA_DEL_SUELO) * CELDA_DEL_SUELO + 8;
  const captura = await page.screenshot({
    fullPage: true,
    clip: { x: 4, y, width: 8, height: 40 },
  });
  const lienzo = await contexto.newPage();
  try {
    return await lienzo.evaluate(coloresDistintos, captura.toString('base64'));
  } finally {
    await lienzo.close();
  }
}

test.describe('el fondo y el movimiento', () => {
  test('el grano del fondo cubre toda la altura de la página a 390 px', async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await abrirTablero(page);
    await page.evaluate(() => {
      const relleno = document.createElement('div');
      relleno.style.height = '3000px';
      document.body.append(relleno);
    });
    const alturaDeLaPagina = await page.evaluate(() => document.documentElement.scrollHeight);

    const arriba = await coloresEnElMargen(page, context, 100);
    const abajo = await coloresEnElMargen(page, context, alturaDeLaPagina - 200);

    expect(alturaDeLaPagina).toBeGreaterThan(3000);
    expect(arriba, 'colores en el primer pantallazo').toBeGreaterThan(3);
    expect(abajo, 'colores en el último pantallazo').toBeGreaterThan(3);
  });

  test('ninguna tarjeta tarda más de 600 ms en estar a la vista', async ({ page }) => {
    await abrirTablero(page);

    const tarjetas = await page.evaluate(() =>
      [0, 1, 5, 40, 1000].map((turno) => {
        const tarjeta = document.createElement('div');
        tarjeta.className = 'entra-del-foso';
        tarjeta.style.setProperty('--turno', String(turno));
        document.body.append(tarjeta);
        const { animationDelay, animationDuration, animationName } = getComputedStyle(tarjeta);
        const milis = (tiempo: string) => parseFloat(tiempo) * (tiempo.endsWith('ms') ? 1 : 1000);
        return {
          animationName,
          retardo: milis(animationDelay),
          duracion: milis(animationDuration),
        };
      }),
    );

    // El escalón de 40 ms sigue ahí mientras no se llega al tope.
    expect(tarjetas.slice(0, 2).map(({ retardo }) => retardo)).toEqual([0, 40]);
    expect(tarjetas.every(({ animationName }) => animationName === 'sube-del-foso')).toBe(true);
    const tardanzas = tarjetas.map(({ retardo, duracion }) => retardo + duracion);
    expect(Math.max(...tardanzas)).toBeLessThanOrEqual(APARICION_MAXIMA_MS);
  });
});
