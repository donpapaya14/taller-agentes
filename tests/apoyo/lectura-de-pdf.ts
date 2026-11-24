// Lo que comparten los tests del PDF: una orden de ejemplo y la lectura de lo que dibuja cada
// página, para mirar qué texto hay, de qué tamaño y en qué sitio.
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream, StandardFonts } from 'pdf-lib';
import { expect } from 'vitest';
import { generarPdf } from '@/adaptadores/pdf/generar';
import { construirDocumento, type EntradaDocumento, LEYENDA_DEMO } from '@/nucleo/documento';

export const ENTRADA: EntradaDocumento = {
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

export const documentoCon = (cambios: Partial<EntradaDocumento>) =>
  construirDocumento({ ...ENTRADA, ...cambios });

export const conDescripcion = (descripcion: string) =>
  documentoCon({ orden: { ...ENTRADA.orden, descripcion } });

// n recambios distintos y sin mano de obra: una fila cada uno.
export const conRecambios = (cuantos: number) =>
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
export const ANCHO_DE_PAGINA = 595.28;
export const MARGEN = 48;

export type Texto = { texto: string; x: number; y: number; tamano: number; fuente: string };

const WINANSI = new TextDecoder('windows-1252');
// Cada texto está en su propio bloque BT ... ET: se parte por donde empiezan.
const INICIO_DE_BLOQUE = 'BT\n';

// Lo que dibuja cada página. pdf-lib escribe cada texto como `<hex> Tj`, con la codificación de
// Helvetica (WinAnsi), detrás de su fuente y tamaño (`Tf`) y de su posición (`Tm`).
export async function textosPorPagina(bytes: Uint8Array): Promise<Texto[][]> {
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
export async function medidor() {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  return ({ texto, x, tamano, fuente }: Texto) =>
    x + (fuente.includes('Bold') ? negrita : normal).widthOfTextAtSize(texto, tamano);
}

export const textosDe = async (documento: ReturnType<typeof construirDocumento>) =>
  (await textosPorPagina(await generarPdf(documento))).flat();

export const soloTextos = (textos: Texto[]) => textos.map(({ texto }) => texto);

// Lo que se exige a cualquier PDF: la leyenda en cada página, nada más allá del margen derecho y
// nada por debajo de la raya del pie, que va justo encima de la leyenda (a dos líneas suyas).
export async function comprobarQueTodoCabe(paginas: Texto[][]) {
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
