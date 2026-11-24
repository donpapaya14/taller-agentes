import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { construirDocumento, type EntradaDocumento, LEYENDA_DEMO } from '@/nucleo/documento';
import { generarPdf } from './generar';

const ENTRADA: EntradaDocumento = {
  taller: {
    nombre: 'Talleres Vega',
    nif: 'B16725376',
    direccion: 'Calle de la Fragua, 14',
    telefono: '969 739 431',
  },
  cliente: { nombre: 'Lucía Ferrer Montoya', telefono: '34641682845' },
  vehiculo: { matricula: '3517XGB', marca: 'Seat', modelo: 'Ibiza' },
  orden: {
    estado: 'entregado',
    descripcion: 'Sustitución de las cuatro bujías',
    numeroFactura: 'F-2026-0001',
    fecha: '2026-11-23',
    manoObraMinutos: 60,
    precioHoraCentimos: 4500,
  },
  lineas: [
    { referencia: 'BUJ-NGK-04', nombre: 'Bujía', cantidad: 4, precioUnitarioCentimos: 690 },
    {
      referencia: 'FIL-ACE-01',
      nombre: 'Filtro de aceite',
      cantidad: 1,
      precioUnitarioCentimos: 899,
    },
  ],
};

const documentoCon = (cambios: Partial<EntradaDocumento>) =>
  construirDocumento({ ...ENTRADA, ...cambios });

const conDescripcion = (descripcion: string) =>
  documentoCon({ orden: { ...ENTRADA.orden, descripcion } });

// n recambios distintos y sin mano de obra: una fila cada uno.
const conRecambios = (cuantos: number) =>
  documentoCon({
    orden: { ...ENTRADA.orden, manoObraMinutos: 0 },
    lineas: Array.from({ length: cuantos }, (_, i) => ({
      referencia: `REF-${i + 1}`,
      nombre: `Recambio ${i + 1}`,
      cantidad: 1,
      precioUnitarioCentimos: 1000,
    })),
  });

// A4 y el margen que deja la composición.
const ANCHO_DE_PAGINA = 595.28;
const MARGEN = 48;

type Texto = { texto: string; x: number; y: number; tamano: number; fuente: string };

const WINANSI = new TextDecoder('windows-1252');
// Cada texto está en su propio bloque BT ... ET: se parte por donde empiezan.
const INICIO_DE_BLOQUE = 'BT\n';

// Lo que dibuja cada página. pdf-lib escribe cada texto como `<hex> Tj`, con la codificación de
// Helvetica (WinAnsi), detrás de su fuente y tamaño (`Tf`) y de su posición (`Tm`).
async function textosPorPagina(bytes: Uint8Array): Promise<Texto[][]> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((pagina) => {
    const contenido = pagina.node.Contents();
    const partes =
      contenido instanceof PDFArray
        ? Array.from({ length: contenido.size() }, (_, i) => contenido.lookup(i))
        : [contenido];
    const operadores = partes
      .filter((parte) => parte instanceof PDFRawStream)
      .map((parte) => Buffer.from(decodePDFRawStream(parte).decode()).toString('latin1'))
      .join('\n');

    return operadores
      .split(INICIO_DE_BLOQUE)
      .slice(1)
      .flatMap((bloque) => {
        const lineas = bloque.split('\n');
        const operacion = (operador: string) =>
          lineas.find((linea) => linea.endsWith(` ${operador}`))?.split(' ');
        const fuente = operacion('Tf'); // /Helvetica-123 10.5 Tf
        const posicion = operacion('Tm'); // 1 0 0 1 48 700 Tm
        const texto = operacion('Tj'); // <48656c6c6f> Tj
        if (!fuente || !posicion || !texto) return [];

        return {
          texto: WINANSI.decode(Buffer.from(texto[0].slice(1, -1), 'hex')),
          x: Number(posicion[4]),
          y: Number(posicion[5]),
          tamano: Number(fuente[1]),
          fuente: fuente[0].slice(1),
        };
      });
  });
}

// Dónde acaba un texto por la derecha, con las mismas métricas que usa el generador.
async function medidor() {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  return ({ texto, x, tamano, fuente }: Texto) =>
    x + (fuente.includes('Bold') ? negrita : normal).widthOfTextAtSize(texto, tamano);
}

const textosDe = async (documento: ReturnType<typeof construirDocumento>) =>
  (await textosPorPagina(await generarPdf(documento))).flat();

const soloTextos = (textos: Texto[]) => textos.map(({ texto }) => texto);

// Lo que se exige a cualquier PDF: la leyenda en cada página, nada más allá del margen derecho y
// nada por debajo de la raya del pie, que va justo encima de la leyenda (a dos líneas suyas).
async function comprobarQueTodoCabe(paginas: Texto[][]) {
  const borde = await medidor();
  for (const pagina of paginas) {
    const pie = pagina.find(({ texto }) => texto === LEYENDA_DEMO);
    expect(pie, 'leyenda').toBeDefined();
    for (const texto of pagina.filter((t) => t !== pie)) {
      expect(borde(texto), texto.texto).toBeLessThanOrEqual(ANCHO_DE_PAGINA - MARGEN + 0.5);
      expect(texto.y, texto.texto).toBeGreaterThan((pie as Texto).y + 2 * (pie as Texto).tamano);
    }
  }
}

describe('generarPdf: el archivo', () => {
  it('[C-8] genera un PDF válido de una página', async () => {
    const bytes = await generarPdf(conRecambios(3));

    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });

  it('[C-8] con 60 filas pagina', async () => {
    const bytes = await generarPdf(conRecambios(60));

    expect((await PDFDocument.load(bytes)).getPageCount()).toBeGreaterThanOrEqual(2);
  });

  it('[C-8] admite tildes, eñes y el símbolo del euro', async () => {
    const documento = documentoCon({ cliente: { nombre: 'Peña Muñoz', telefono: '34641682845' } });

    const textos = soloTextos(await textosDe(documento));

    expect(documento.totales.total).toContain('€');
    expect(textos).toContain('Peña Muñoz');
    expect(textos).toContain(documento.totales.total);
  });

  it('[C-8] una orden sin filas ni mano de obra también sale', async () => {
    const vacio = documentoCon({ lineas: [], orden: { ...ENTRADA.orden, manoObraMinutos: 0 } });

    const bytes = await generarPdf(vacio);

    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

describe('generarPdf: lo que lleva', () => {
  it('[C-8] una orden sin entregar se titula Presupuesto y no lleva número', async () => {
    const presupuesto = documentoCon({
      orden: { ...ENTRADA.orden, estado: 'listo', numeroFactura: null },
    });

    const textos = soloTextos(await textosDe(presupuesto));

    expect(textos).toContain('Presupuesto');
    expect(textos).not.toContain('Factura');
    expect(textos.filter((texto) => texto.startsWith('F-'))).toEqual([]);
  });

  it('[C-8] una orden entregada se titula Factura y lleva su número en el borde derecho', async () => {
    const textos = await textosDe(documentoCon({}));
    const borde = await medidor();
    const total = textos.find(({ texto }) => texto === documentoCon({}).totales.total);
    const numero = textos.find(({ texto }) => texto === 'F-2026-0001');

    expect(soloTextos(textos)).toContain('Factura');
    expect(numero).toBeDefined();
    expect(borde(numero as Texto)).toBeCloseTo(ANCHO_DE_PAGINA - MARGEN, 1);
    expect(borde(total as Texto)).toBeCloseTo(ANCHO_DE_PAGINA - MARGEN, 1);
  });

  it('[C-8] lleva la matrícula, las líneas, los totales y la leyenda de demostración', async () => {
    const documento = documentoCon({});

    const texto = soloTextos(await textosDe(documento)).join('\n');

    const esperados = [
      '3517XGB',
      'Bujía (BUJ-NGK-04)',
      'Filtro de aceite (FIL-ACE-01)',
      'Mano de obra',
      documento.totales.base,
      documento.totales.iva,
      documento.totales.total,
      LEYENDA_DEMO,
      'Talleres Vega',
      'B16725376',
      'Lucía Ferrer Montoya',
      '2026-11-23',
      'Sustitución de las cuatro bujías',
    ];
    for (const esperado of esperados) {
      expect(texto, esperado).toContain(esperado);
    }
  });
});

describe('generarPdf: varias páginas', () => {
  it('[C-8] la leyenda sale al pie de todas las páginas', async () => {
    const paginas = await textosPorPagina(await generarPdf(conRecambios(60)));

    expect(paginas.length).toBeGreaterThanOrEqual(2);
    for (const pagina of paginas) {
      expect(soloTextos(pagina)).toContain(LEYENDA_DEMO);
    }
  });

  it('[C-8] cada fila sale una vez y en orden, y los totales cierran la última página', async () => {
    const documento = conRecambios(60);

    const paginas = await textosPorPagina(await generarPdf(documento));

    const conceptos = paginas.flat().filter(({ texto }) => texto.startsWith('Recambio'));
    expect(soloTextos(conceptos)).toEqual(documento.filas.map(({ concepto }) => concepto));
    const textosDeLaUltima = soloTextos(paginas[paginas.length - 1]);
    expect(textosDeLaUltima).toContain(documento.totales.total);
    expect(soloTextos(paginas.slice(0, -1).flat())).not.toContain(documento.totales.total);
  });

  it('[C-8] las filas de las páginas nuevas llevan el encabezado de la tabla', async () => {
    const paginas = await textosPorPagina(await generarPdf(conRecambios(60)));

    for (const pagina of paginas.filter((p) =>
      p.some(({ texto }) => texto.startsWith('Recambio')),
    )) {
      expect(soloTextos(pagina)).toContain('Concepto');
    }
  });

  it('[C-8] una descripción muy larga sigue en la página siguiente sin perder palabras', async () => {
    const descripcion = Array.from({ length: 1500 }, () => 'tuerca').join(' ');

    const paginas = await textosPorPagina(await generarPdf(conDescripcion(descripcion)));

    const palabras = paginas.flat().flatMap(({ texto }) => texto.split(' '));
    await comprobarQueTodoCabe(paginas);
    expect(paginas.length).toBeGreaterThanOrEqual(2);
    expect(palabras.filter((palabra) => palabra === 'tuerca')).toHaveLength(1500);
  });
});

// El tamaño de la descripción y el número de filas mueven el final de cada tramo de la página.
describe('generarPdf: dónde cae cada salto de página', () => {
  // Con cada número de filas el final de la tabla cae en un sitio distinto de la página: los totales
  // tienen que ir a la siguiente cuando no caben, y nunca sobre el pie.
  it('[C-8] con cualquier número de filas todo cabe y los totales no se parten', async () => {
    for (let filas = 0; filas <= 70; filas += 1) {
      const paginas = await textosPorPagina(await generarPdf(conRecambios(filas)));

      await comprobarQueTodoCabe(paginas);
      const conTotales = paginas.filter((pagina) => soloTextos(pagina).includes('Base imponible'));
      expect(conTotales, `${filas} filas`).toHaveLength(1);
      const etiquetas = soloTextos(conTotales[0]);
      expect(etiquetas, `${filas} filas`).toContain('Total');
      expect(
        etiquetas.some((etiqueta) => etiqueta.startsWith('IVA')),
        `${filas} filas`,
      ).toBe(true);
    }
  });

  // Según lo larga que sea la descripción, la tabla empieza más arriba o más abajo de la página.
  it('[C-8] el encabezado de la tabla no se queda solo al final de una página', async () => {
    for (let lineas = 0; lineas <= 60; lineas += 1) {
      const documento = documentoCon({
        orden: { ...ENTRADA.orden, descripcion: 'otra línea\n'.repeat(lineas) },
      });

      const paginas = await textosPorPagina(await generarPdf(documento));

      await comprobarQueTodoCabe(paginas);
      for (const pagina of paginas.filter((p) => soloTextos(p).includes('Concepto'))) {
        const encabezado = pagina.find(({ texto }) => texto === 'Concepto') as Texto;
        const filasDebajo = pagina.filter(
          (texto) => texto.x === MARGEN && texto.y < encabezado.y && texto.texto !== LEYENDA_DEMO,
        );
        expect(filasDebajo, `${lineas} líneas`).not.toEqual([]);
      }
    }
  });
});

describe('generarPdf: texto que no cabe o no se dibuja', () => {
  it('[C-8] nada pasa del margen derecho ni invade el pie, ni con palabras más anchas que la columna', async () => {
    const largo = documentoCon({
      orden: { ...ENTRADA.orden, descripcion: `${'Z'.repeat(400)} y más cosas detrás` },
      lineas: [
        { referencia: 'R-1', nombre: 'W'.repeat(300), cantidad: 1, precioUnitarioCentimos: 100 },
      ],
    });

    const paginas = await textosPorPagina(await generarPdf(largo));

    await comprobarQueTodoCabe(paginas);
    // Cortadas o no, no se pierde ninguna letra de lo que no cabía.
    const letras = (letra: string) => soloTextos(paginas.flat()).join('').split(letra).length - 1;
    expect(letras('Z')).toBe(400);
    expect(letras('W')).toBe(300);
  });

  it('[C-8] un carácter que Helvetica no dibuja sale como ? y no rompe el PDF', async () => {
    const documento = documentoCon({
      cliente: { nombre: 'Łukasz 😀 Nowak', telefono: '34641682845' },
    });

    const textos = soloTextos(await textosDe(documento));

    expect(textos).toContain('?ukasz ? Nowak');
  });

  it('[C-8] los espacios finos y los saltos de línea de un texto no rompen el PDF', async () => {
    const documento = conDescripcion('Primera línea\nSegunda\u202Flínea\r\nTercera\u00A0línea');

    const textos = soloTextos(await textosDe(documento));

    expect(textos).toEqual(
      expect.arrayContaining(['Primera línea', 'Segunda línea', 'Tercera línea']),
    );
  });
});

describe('generarPdf: los totales', () => {
  it('[C-8] el total se distingue: negrita y más grande que la base y el IVA', async () => {
    const documento = documentoCon({});
    const textos = await textosDe(documento);
    const de = (importe: string) => textos.find(({ texto }) => texto === importe) as Texto;
    const { base, iva, total } = documento.totales;

    expect(de(total).fuente).toContain('Bold');
    expect(de(total).tamano).toBeGreaterThan(de(base).tamano);
    expect(de(base).fuente).not.toContain('Bold');
    expect(de(iva).tamano).toBe(de(base).tamano);
  });

  it('[C-8] las etiquetas de los totales van alineadas en la mitad derecha, junto a los importes', async () => {
    const textos = await textosDe(documentoCon({}));
    const etiquetas = textos.filter(
      ({ texto }) => texto === 'Base imponible' || texto === 'Total' || texto.startsWith('IVA'),
    );

    expect(etiquetas).toHaveLength(3);
    expect(new Set(etiquetas.map(({ x }) => x)).size).toBe(1);
    expect(etiquetas[0].x).toBeGreaterThan(ANCHO_DE_PAGINA / 2);
  });
});

describe('generarPdf: datos del taller', () => {
  it('[C-8] el NIF y el teléfono se escriben con su etiqueta', async () => {
    const textos = soloTextos(await textosDe(documentoCon({})));

    expect(textos).toEqual(expect.arrayContaining(['NIF B16725376', 'Tel. 969 739 431']));
  });

  it('[C-8] un NIF o un teléfono en blanco no dejan su etiqueta suelta', async () => {
    const sinDatos = documentoCon({ taller: { ...ENTRADA.taller, nif: '', telefono: '   ' } });

    const textos = soloTextos(await textosDe(sinDatos));

    expect(textos.filter((t) => t.startsWith('NIF') || t.startsWith('Tel.'))).toEqual([]);
    expect(textos).toContain('Talleres Vega');
  });
});
